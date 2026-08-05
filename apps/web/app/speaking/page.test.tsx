import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SpeakingPage from '@/app/speaking/page'
import { AUTH_REQUIRED_EVENT } from '@/lib/api-client'
import type {
  SpeakingSession,
  SpeakingSessionSummary,
  SpeakingTurn,
} from '@/lib/speaking-api'

const now = '2026-08-05T10:00:00Z'

function turn(
  overrides: Partial<SpeakingTurn> & Pick<SpeakingTurn, 'id' | 'kind' | 'role'>,
): SpeakingTurn {
  return {
    created_at: now,
    duration_difference_ms: null,
    is_hidden: false,
    item_index: null,
    prompt_id: null,
    recording_duration_ms: null,
    sequence: 1,
    stage: '',
    suggested_duration_ms: null,
    transcript: '',
    ...overrides,
  }
}

const greeting = turn({
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'greeting',
  role: 'examiner',
  transcript: 'Welcome to your speaking practice.',
})

const repeatPrompt = turn({
  id: '00000000-0000-4000-8000-000000000002',
  is_hidden: true,
  item_index: 0,
  kind: 'repeat_sentence',
  role: 'examiner',
  sequence: 2,
  stage: 'toefl_repeat',
  suggested_duration_ms: 8_000,
  transcript: null,
})

const visibleRepeatPrompt = {
  ...repeatPrompt,
  is_hidden: false,
  transcript: 'Please bring your notebook today.',
}

const secondRepeatPrompt = turn({
  id: '00000000-0000-4000-8000-000000000004',
  is_hidden: true,
  item_index: 1,
  kind: 'repeat_sentence',
  role: 'examiner',
  sequence: 4,
  stage: 'toefl_repeat',
  suggested_duration_ms: 8_000,
  transcript: null,
})

const answer = turn({
  duration_difference_ms: -3_750,
  id: '00000000-0000-4000-8000-000000000003',
  item_index: 0,
  kind: 'answer',
  prompt_id: repeatPrompt.id,
  recording_duration_ms: 4_250,
  role: 'learner',
  sequence: 3,
  stage: 'toefl_repeat',
  transcript: 'Please bring your notebook today.',
})

const closing = turn({
  id: '00000000-0000-4000-8000-000000000005',
  kind: 'closing',
  role: 'examiner',
  sequence: 4,
  stage: 'completed',
  transcript: 'Thank you. Your practice session is complete.',
})

function session(overrides: Partial<SpeakingSession> = {}): SpeakingSession {
  return {
    abandoned_at: null,
    completed_at: null,
    current_item_index: 0,
    current_prompt_id: null,
    current_stage: '',
    exam_type: 'toefl',
    id: '10000000-0000-4000-8000-000000000001',
    prompt_version: 'speaking-v1',
    required_response_count: 11,
    response_count: 0,
    started_at: now,
    status: 'in_progress',
    timing_summary: {
      actual_duration_ms: 0,
      difference_ms: 0,
      suggested_duration_ms: 0,
    },
    turns: [greeting],
    updated_at: now,
    ...overrides,
  }
}

const createdSession = session()
const promptedSession = session({
  current_prompt_id: repeatPrompt.id,
  current_stage: 'toefl_repeat',
  turns: [greeting, repeatPrompt],
})
const committedSession = session({
  current_prompt_id: null,
  current_stage: 'toefl_repeat',
  response_count: 1,
  timing_summary: {
    actual_duration_ms: 4_250,
    difference_ms: -3_750,
    suggested_duration_ms: 8_000,
  },
  turns: [greeting, visibleRepeatPrompt, answer],
})
const nextPromptSession = session({
  current_item_index: 1,
  current_prompt_id: secondRepeatPrompt.id,
  current_stage: 'toefl_repeat',
  response_count: 1,
  timing_summary: committedSession.timing_summary,
  turns: [greeting, visibleRepeatPrompt, answer, secondRepeatPrompt],
})

type ErrorReply = { payload?: Record<string, unknown>; status: number }
type Reply = SpeakingSession | ErrorReply

type Scenario = {
  advances?: Reply[]
  created?: Reply
  detail?: Reply
  list?: SpeakingSessionSummary[]
  responses?: Reply[]
  speeches?: (ErrorReply | Blob)[]
}

function isErrorReply(reply: Reply | Blob): reply is ErrorReply {
  return (
    !(reply instanceof Blob) &&
    'status' in reply &&
    typeof reply.status === 'number'
  )
}

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function installScenario(scenario: Scenario = {}) {
  const advances = [...(scenario.advances ?? [promptedSession])]
  const responses = [...(scenario.responses ?? [committedSession])]
  const speeches = [
    ...(scenario.speeches ?? [new Blob(['mp3'], { type: 'audio/mpeg' })]),
  ]
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url.endsWith('/speaking/sessions/') && method === 'GET') {
      return jsonResponse(scenario.list ?? [])
    }
    if (url.endsWith('/speaking/sessions/') && method === 'POST') {
      const reply = scenario.created ?? createdSession
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply, 201)
    }
    if (url.endsWith('/advance/')) {
      const reply = advances.shift() ?? promptedSession
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply)
    }
    if (url.endsWith('/responses/')) {
      const reply = responses.shift() ?? committedSession
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply)
    }
    if (url.endsWith('/speech/')) {
      const reply =
        speeches.shift() ?? new Blob(['mp3'], { type: 'audio/mpeg' })
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : Promise.resolve(
            new Response(reply, {
              status: 200,
              headers: { 'Content-Type': 'audio/mpeg' },
            }),
          )
    }
    if (url.includes('/speaking/sessions/') && method === 'GET') {
      const reply = scenario.detail ?? promptedSession
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply)
    }
    if (url.endsWith('/abandon/')) {
      return jsonResponse(
        session({
          abandoned_at: now,
          status: 'abandoned',
          turns: committedSession.turns,
        }),
      )
    }
    return jsonResponse({ detail: `Unexpected ${method} ${url}` }, 500)
  })
}

let audioPlay: ReturnType<typeof vi.fn<() => Promise<void>>>
let audioInstances: FakeAudio[]

class FakeAudio {
  duration = 4.25
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  preload = ''
  private currentSrc = ''

  constructor(src?: string) {
    if (src) this.currentSrc = src
    audioInstances.push(this)
  }

  set src(value: string) {
    this.currentSrc = value
    queueMicrotask(() => this.onloadedmetadata?.())
  }

  get src() {
    return this.currentSrc
  }

  play() {
    return audioPlay()
  }

  pause() {}

  removeAttribute() {
    this.currentSrc = ''
  }

  end() {
    this.onended?.()
  }
}

function installMicrophone(result: 'ready' | 'denied' = 'ready') {
  const stopTrack = vi.fn()
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream
  const getUserMedia =
    result === 'ready'
      ? vi.fn().mockResolvedValue(stream)
      : vi
          .fn()
          .mockRejectedValue(
            new DOMException('Permission denied', 'NotAllowedError'),
          )
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  return { getUserMedia, stopTrack, stream }
}

async function reachPrompt() {
  await screen.findByRole('heading', {
    name: 'کدام ساختار را تمرین می‌کنی؟',
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'TOEFL Speaking · Current practice' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'شروع تمرین TOEFL' }))
  await screen.findByText('فقط گوش کن و تکرار کن')
}

describe('SpeakingPage', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=speaking-test-token; path=/'
    audioInstances = []
    audioPlay = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('Audio', FakeAudio)
    let objectUrlSequence = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:speaking-${++objectUrlSequence}`,
    )
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('checks the microphone, creates the selected exam, autoplays, then enables recording', async () => {
    const fetchMock = installScenario()
    const { getUserMedia, stopTrack } = installMicrophone()
    render(<SpeakingPage />)

    await screen.findByRole('heading', {
      name: 'کدام ساختار را تمرین می‌کنی؟',
    })
    fireEvent.click(screen.getByRole('button', { name: 'بررسی میکروفن' }))
    expect(await screen.findByText(/میکروفن آماده است/)).toBeVisible()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(stopTrack).toHaveBeenCalledOnce()

    fireEvent.click(
      screen.getByRole('button', { name: 'TOEFL Speaking · Current practice' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'شروع تمرین TOEFL' }))
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    expect(audioPlay).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).not.toBeInTheDocument()

    act(() => audioInstances.at(-1)?.end())
    expect(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'تمرین Speaking TOEFL' }),
    ).toHaveFocus()

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/speaking/sessions/') && init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      exam_type: 'toefl',
    })
  })

  it('uses a prominent play fallback when browser autoplay is blocked', async () => {
    installScenario()
    installMicrophone()
    audioPlay.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    render(<SpeakingPage />)

    await reachPrompt()

    const play = await screen.findByRole('button', {
      name: 'پخش صدای ممتحن',
    })
    expect(play).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).not.toBeInTheDocument()

    audioPlay.mockResolvedValue(undefined)
    fireEvent.click(play)
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    act(() => audioInstances.at(-1)?.end())
    expect(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).toBeVisible()
  })

  it('keeps the active TOEFL repeat sentence hidden until submission, then continues automatically', async () => {
    const fetchMock = installScenario({
      advances: [promptedSession, nextPromptSession],
      responses: [committedSession],
      speeches: [
        new Blob(['first mp3'], { type: 'audio/mpeg' }),
        new Blob(['second mp3'], { type: 'audio/mpeg' }),
      ],
    })
    installMicrophone()
    render(<SpeakingPage />)
    await reachPrompt()

    expect(
      screen.queryByText('Please bring your notebook today.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByText('متن این جمله بعد از ثبت پاسخ نمایش داده می‌شود.')
        .length,
    ).toBeGreaterThanOrEqual(1)
    act(() => audioInstances.at(-1)?.end())

    const file = new File(['learner voice'], 'answer.webm', {
      type: 'audio/webm',
    })
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: { files: [file] },
    })
    expect(await screen.findByText('answer.webm')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت این پاسخ' }))

    await waitFor(() => {
      expect(
        screen.getAllByText('Please bring your notebook today.').length,
      ).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getByText(/۱ از ۱۱ پاسخ ثبت شده/)).toBeVisible()
    expect(screen.getByText('در حال پخش')).toBeVisible()

    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/responses/'),
    )
    const formData = uploadCall?.[1]?.body as FormData
    expect(formData.get('prompt_id')).toBe(repeatPrompt.id)
    expect(formData.get('recording_duration_ms')).toBe('4250')
    expect(formData.get('client_event_id')).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('records without auto-stop, supports re-recording, and releases media resources', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    installScenario()
    const { getUserMedia, stopTrack } = installMicrophone()
    let take = 0
    class FakeMediaRecorder {
      mimeType = 'audio/webm'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null
      state: RecordingState = 'inactive'

      constructor(readonly stream: MediaStream) {}

      start() {
        take += 1
        this.state = 'recording'
      }

      stop() {
        this.ondataavailable?.({
          data: new Blob([take === 1 ? 'first' : 'replacement'], {
            type: 'audio/webm',
          }),
        } as BlobEvent)
        this.state = 'inactive'
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())

    fireEvent.click(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    )
    await act(() => vi.advanceTimersByTimeAsync(180_000))
    expect(screen.getByRole('button', { name: 'توقف ضبط' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'توقف ضبط' }))
    expect(await screen.findByText('پاسخ ضبط‌شده')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'ضبط دوباره' }))
    expect(getUserMedia).toHaveBeenCalledTimes(3)
    fireEvent.click(await screen.findByRole('button', { name: 'توقف ضبط' }))
    await screen.findByText('پاسخ ضبط‌شده')

    expect(stopTrack).toHaveBeenCalledTimes(3)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('keeps a local take available after STT or rate-limit errors', async () => {
    installScenario({
      responses: [
        {
          status: 429,
          payload: { detail: 'too many', code: 'throttled' },
        },
      ],
    })
    installMicrophone()
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'retry.webm', { type: 'audio/webm' })],
      },
    })
    await screen.findByText('retry.webm')
    fireEvent.click(screen.getByRole('button', { name: 'ثبت این پاسخ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'درخواست‌ها کمی زیاد شده است',
    )
    expect(screen.getByText('retry.webm')).toBeVisible()
    expect(screen.getByRole('button', { name: 'ثبت این پاسخ' })).toBeVisible()
  })

  it('shows committed history and retries next-question generation without reuploading', async () => {
    const fetchMock = installScenario({
      advances: [
        promptedSession,
        {
          status: 503,
          payload: { detail: 'provider failed', code: 'provider_unavailable' },
        },
        nextPromptSession,
      ],
      responses: [committedSession],
    })
    installMicrophone()
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'answer.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت این پاسخ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'پاسخ قبلی ذخیره شده است',
    )
    expect(
      screen.getAllByText('Please bring your notebook today.').length,
    ).toBeGreaterThanOrEqual(2)
    const uploadsBeforeRetry = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/responses/'),
    ).length
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/responses/'),
      ),
    ).toHaveLength(uploadsBeforeRetry)
  })

  it('recovers from TTS failure and never enables recording before playback', async () => {
    installScenario({
      speeches: [
        {
          status: 503,
          payload: { detail: 'tts failed', code: 'provider_unavailable' },
        },
        new Blob(['retry mp3'], { type: 'audio/mpeg' }),
      ],
    })
    installMicrophone()
    render(<SpeakingPage />)
    await reachPrompt()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'صدای ممتحن آماده نشد',
    )
    expect(
      screen.queryByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    act(() => audioInstances.at(-1)?.end())
    expect(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).toBeVisible()
  })

  it('resumes in-progress sessions and opens completed text history', async () => {
    const inProgressSummary: SpeakingSessionSummary = promptedSession
    const completed = session({
      id: '20000000-0000-4000-8000-000000000002',
      completed_at: now,
      current_item_index: 11,
      current_prompt_id: null,
      current_stage: 'completed',
      required_response_count: 11,
      response_count: 11,
      status: 'completed',
      timing_summary: {
        actual_duration_ms: 120_000,
        difference_ms: 10_000,
        suggested_duration_ms: 110_000,
      },
      turns: [greeting, visibleRepeatPrompt, answer],
    })
    const completedSummary: SpeakingSessionSummary = completed
    const fetchMock = installScenario({
      detail: promptedSession,
      list: [inProgressSummary, completedSummary],
    })
    installMicrophone()
    render(<SpeakingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'ادامهٔ جلسه' }))
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes(promptedSession.id) &&
          !String(url).endsWith('/speech/') &&
          init?.method === 'GET',
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith('/speaking/sessions/') &&
          init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('renders completion metrics, transcript, and the explicit no-score message', async () => {
    const completed = session({
      completed_at: now,
      current_item_index: 11,
      current_stage: 'completed',
      required_response_count: 11,
      response_count: 11,
      status: 'completed',
      timing_summary: {
        actual_duration_ms: 120_000,
        difference_ms: 10_000,
        suggested_duration_ms: 110_000,
      },
      turns: [greeting, visibleRepeatPrompt, answer],
    })
    installScenario({ detail: completed, list: [completed] })
    installMicrophone()
    render(<SpeakingPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'دیدن متن جلسه' }),
    )
    const summaryHeading = await screen.findByRole('heading', {
      name: 'گزارش جلسهٔ تکمیل‌شده',
    })
    expect(summaryHeading).toBeVisible()
    expect(summaryHeading).toHaveFocus()
    expect(screen.getByText('02:00')).toBeVisible()
    expect(screen.getByText('01:50')).toBeVisible()
    expect(screen.getByText(/هیچ نمره، بازخورد یا تخمین باندی/)).toBeVisible()
    expect(
      screen.getAllByText('Please bring your notebook today.'),
    ).toHaveLength(2)
  })

  it('moves directly to completion after the final accepted response and plays the closing', async () => {
    const onePromptSession = session({
      current_prompt_id: repeatPrompt.id,
      current_stage: 'toefl_repeat',
      required_response_count: 1,
      turns: [greeting, repeatPrompt],
    })
    const completed = session({
      completed_at: now,
      current_item_index: 1,
      current_prompt_id: null,
      current_stage: 'completed',
      required_response_count: 1,
      response_count: 1,
      status: 'completed',
      timing_summary: committedSession.timing_summary,
      turns: [greeting, visibleRepeatPrompt, answer, closing],
    })
    const fetchMock = installScenario({
      advances: [onePromptSession],
      responses: [completed],
      speeches: [
        new Blob(['prompt mp3'], { type: 'audio/mpeg' }),
        new Blob(['closing mp3'], { type: 'audio/mpeg' }),
      ],
    })
    installMicrophone()
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'final.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت این پاسخ' }))

    expect(
      await screen.findByRole('heading', { name: 'تمرینت کامل شد' }),
    ).toBeVisible()
    expect(screen.getByText(/هیچ نمره، بازخورد یا تخمین باندی/)).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/advance/')),
    ).toHaveLength(1)
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/speech/')),
    ).toHaveLength(2)
  })

  it('keeps abandon available on mobile, supports Escape, and requires confirmation', async () => {
    const fetchMock = installScenario()
    installMicrophone()
    render(<SpeakingPage />)
    await reachPrompt()

    const abandon = screen.getByRole('button', { name: 'رها کردن جلسه' })
    fireEvent.click(abandon)
    expect(
      screen.getByRole('dialog', { name: 'این جلسه رها شود؟' }),
    ).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(abandon).toHaveFocus()

    fireEvent.click(abandon)
    fireEvent.click(screen.getByRole('button', { name: 'بله، رها شود' }))
    expect(
      await screen.findByRole('heading', { name: 'متن جلسهٔ رهاشده' }),
    ).toBeVisible()
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith('/abandon/')),
    ).toBe(true)
  })

  it('shows the upload fallback after permission denial and announces expired auth', async () => {
    const fetchMock = installScenario({
      created: { status: 401, payload: { detail: 'expired' } },
    })
    installMicrophone('denied')
    const authRequired = vi.fn()
    window.addEventListener(AUTH_REQUIRED_EVENT, authRequired)
    render(<SpeakingPage />)

    await screen.findByRole('heading', {
      name: 'کدام ساختار را تمرین می‌کنی؟',
    })
    fireEvent.click(screen.getByRole('button', { name: 'بررسی میکروفن' }))
    expect(await screen.findByText(/دسترسی میکروفن داده نشد/)).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'IELTS Speaking practice' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'شروع تمرین IELTS' }))
    await waitFor(() => expect(authRequired).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalled()
    window.removeEventListener(AUTH_REQUIRED_EVENT, authRequired)
  })

  it('stops a late microphone stream and revokes media URLs on unmount', async () => {
    installScenario()
    let resolveStream: (stream: MediaStream) => void = () => undefined
    const stopTrack = vi.fn()
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve
        }),
    )
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    const { unmount } = render(<SpeakingPage />)
    await screen.findByRole('heading', {
      name: 'کدام ساختار را تمرین می‌کنی؟',
    })
    fireEvent.click(screen.getByRole('button', { name: 'بررسی میکروفن' }))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())

    unmount()
    resolveStream(stream)
    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
  })
})
