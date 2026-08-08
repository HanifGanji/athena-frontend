import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SpeakingPage from '@/app/speaking/page'
import { AUTH_REQUIRED_EVENT } from '@/lib/api-client'
import type {
  SpeakingFeedback,
  SpeakingSession,
  SpeakingSessionSummary,
  SpeakingTurn,
} from '@/lib/speaking-api'

const now = '2026-08-05T10:00:00Z'

const feedbackResource: SpeakingFeedback = {
  generated_at: now,
  improvements: [
    {
      explanation: 'برای طبیعی‌تر شدن، از ساختار کامل‌تر استفاده کن.',
      improved_version: 'I usually study in the library after class.',
      learner_excerpt: 'I study library after class.',
    },
    {
      explanation: 'رابط جمله کمک می‌کند پاسخ روشن‌تر شنیده شود.',
      improved_version: 'Because it is quiet, I can focus more easily.',
      learner_excerpt: 'It is quiet. I focus easy.',
    },
  ],
  next_goal: {
    practice: 'در تمرین بعدی، هر پاسخ را با یک دلیل و یک مثال ادامه بده.',
    title: 'پاسخ را یک گام گسترش بده',
  },
  session_id: '10000000-0000-4000-8000-000000000001',
  strengths: [
    {
      evidence: 'پاسخ‌ها مستقیم و مرتبط با سؤال بودند.',
      title: 'تمرکز خوب روی سؤال',
    },
    {
      evidence: 'برای توضیح تجربه از مثال شخصی استفاده کردی.',
      title: 'مثال شخصی روشن',
    },
  ],
}

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
    review: null,
    revision: 1,
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

const reviewedAnswer = turn({
  ...answer,
  review: {
    issue_code: null,
    message: '',
    replacement_allowed: false,
    reviewed_at: now,
    verdict: 'clear',
  },
})

const warnedAnswer = turn({
  ...answer,
  review: {
    issue_code: 'off_topic',
    message: 'این پاسخ به پرسش مرتبط نیست؛ می‌توانی دوباره ضبط کنی.',
    replacement_allowed: true,
    reviewed_at: now,
    verdict: 'warning',
  },
})

const replacementAnswer = turn({
  ...answer,
  id: answer.id,
  recording_duration_ms: 6_000,
  review: null,
  revision: 2,
  transcript: 'A replacement learner response.',
})

const secondWarnedAnswer = turn({
  ...replacementAnswer,
  review: {
    issue_code: 'off_topic',
    message: 'پاسخ جایگزین هم به پرسش مرتبط نیست.',
    replacement_allowed: false,
    reviewed_at: now,
    verdict: 'warning',
  },
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
    topic_labels: ['Campus life'],
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
const reviewedSession = session({
  ...committedSession,
  turns: [greeting, visibleRepeatPrompt, reviewedAnswer],
})
const warnedSession = session({
  ...committedSession,
  turns: [greeting, visibleRepeatPrompt, warnedAnswer],
})
const replacementSession = session({
  ...committedSession,
  timing_summary: {
    actual_duration_ms: 6_000,
    difference_ms: -2_000,
    suggested_duration_ms: 8_000,
  },
  turns: [greeting, visibleRepeatPrompt, replacementAnswer],
})
const secondWarnedSession = session({
  ...replacementSession,
  turns: [greeting, visibleRepeatPrompt, secondWarnedAnswer],
})
const nextPromptSession = session({
  current_item_index: 1,
  current_prompt_id: secondRepeatPrompt.id,
  current_stage: 'toefl_repeat',
  response_count: 1,
  timing_summary: committedSession.timing_summary,
  turns: [greeting, visibleRepeatPrompt, reviewedAnswer, secondRepeatPrompt],
})

type ErrorReply = { payload?: Record<string, unknown>; status: number }
type Reply = SpeakingSession | ErrorReply

type Scenario = {
  advances?: Reply[]
  created?: Reply
  detail?: Reply
  list?: SpeakingSessionSummary[]
  listHandler?: () => Promise<Response>
  responses?: (Promise<Response> | Reply)[]
  replacements?: (Promise<Response> | Reply)[]
  reviews?: (Promise<Response> | Reply)[]
  speeches?: (ErrorReply | Blob | Promise<Response>)[]
  feedbacks?: (ErrorReply | Promise<Response> | SpeakingFeedback)[]
}

function isErrorReply(
  reply: Reply | SpeakingFeedback | Blob,
): reply is ErrorReply {
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function installScenario(scenario: Scenario = {}) {
  const advances = [...(scenario.advances ?? [nextPromptSession])]
  const responses = [...(scenario.responses ?? [committedSession])]
  const replacements = [...(scenario.replacements ?? [])]
  const reviews = [...(scenario.reviews ?? [reviewedSession])]
  const speeches = [
    ...(scenario.speeches ?? [new Blob(['mp3'], { type: 'audio/mpeg' })]),
  ]
  const feedbacks = [...(scenario.feedbacks ?? [])]
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url.endsWith('/speaking/sessions/') && method === 'GET') {
      if (scenario.listHandler) return scenario.listHandler()
      return jsonResponse(scenario.list ?? [])
    }
    if (url.endsWith('/speaking/sessions/') && method === 'POST') {
      const reply = scenario.created ?? promptedSession
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
      if (reply instanceof Promise) return reply
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply)
    }
    if (url.endsWith('/review/')) {
      const reply = reviews.shift() ?? reviewedSession
      if (reply instanceof Promise) return reply
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply)
    }
    if (url.endsWith('/replacement/')) {
      const reply = replacements.shift()
      if (!reply) {
        return jsonResponse({ detail: 'Unexpected replacement request' }, 500)
      }
      if (reply instanceof Promise) return reply
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply)
    }
    if (url.endsWith('/speech/')) {
      const reply =
        speeches.shift() ?? new Blob(['mp3'], { type: 'audio/mpeg' })
      if (reply instanceof Promise) return reply
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : Promise.resolve(
            new Response(reply, {
              status: 200,
              headers: { 'Content-Type': 'audio/mpeg' },
            }),
          )
    }
    if (url.endsWith('/feedback/')) {
      const reply = feedbacks.shift()
      if (!reply) {
        return jsonResponse({ detail: 'Unexpected feedback request' }, 500)
      }
      if (reply instanceof Promise) return reply
      return isErrorReply(reply)
        ? jsonResponse(reply.payload ?? { detail: 'failed' }, reply.status)
        : jsonResponse(reply, 201)
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

  it('renders exam selection immediately while history loads independently', async () => {
    const history = deferred<Response>()
    installScenario({ listHandler: () => history.promise })
    render(<SpeakingPage />)

    expect(
      await screen.findByRole('heading', {
        name: 'کدام ساختار را تمرین می‌کنی؟',
      }),
    ).toBeVisible()
    expect(screen.getByLabelText('در حال بارگذاری تاریخچه')).toBeVisible()

    history.resolve(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(await screen.findByText('هنوز جلسه‌ای نداری.')).toBeVisible()
    expect(screen.getByText('۱۶ پاسخ · حدود ۹ دقیقه صحبت')).toBeVisible()
    expect(screen.getByText('۱۱ پاسخ · حدود ۴ دقیقه صحبت')).toBeVisible()
  })

  it('shows five recent sessions and places older history behind native disclosure', async () => {
    const sessions = Array.from({ length: 7 }, (_, index) =>
      session({
        completed_at: now,
        id: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        status: 'completed',
      }),
    )
    installScenario({ list: sessions })
    render(<SpeakingPage />)

    expect(
      await screen.findAllByRole('button', { name: 'دیدن متن جلسه' }),
    ).toHaveLength(5)
    const disclosure = screen.getByText('جلسه‌های قدیمی‌تر').closest('summary')!
    expect(disclosure).toBeVisible()
    fireEvent.click(disclosure)
    expect(screen.getByText('۲ جلسه')).toBeVisible()
  })

  it('labels an unfinished zero-answer session as not started', async () => {
    installScenario({ list: [promptedSession] })
    render(<SpeakingPage />)

    expect(await screen.findByText('شروع‌نشده')).toBeVisible()
    expect(screen.getByRole('button', { name: 'ادامهٔ تمرین' })).toBeVisible()
  })

  it('shows an inline focused history error and retries without blocking start', async () => {
    let attempts = 0
    installScenario({
      listHandler: () => {
        attempts += 1
        return jsonResponse(
          attempts === 1 ? { detail: 'history failed' } : [],
          attempts === 1 ? 503 : 200,
        )
      },
    })
    render(<SpeakingPage />)

    expect(
      await screen.findByRole('button', { name: 'شروع تمرین IELTS' }),
    ).toBeVisible()
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('تاریخچهٔ جلسه‌ها بارگذاری نشد')
    expect(error).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(await screen.findByText('هنوز جلسه‌ای نداری.')).toBeVisible()
    expect(attempts).toBe(2)
  })

  it('uses the prompt returned by creation, autoplays, and asks for no microphone permission before recording', async () => {
    const fetchMock = installScenario()
    const { getUserMedia, stopTrack } = installMicrophone()
    render(<SpeakingPage />)

    await screen.findByRole('heading', {
      name: 'کدام ساختار را تمرین می‌کنی؟',
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'TOEFL Speaking · Current practice' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'شروع تمرین TOEFL' }))
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    expect(audioPlay).toHaveBeenCalledOnce()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(stopTrack).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByText('فقط گوش کن و تکرار کن').closest('[tabindex="-1"]'),
    ).toHaveFocus()
    expect(
      screen.getByText('گفت‌وگو تا اینجا').closest('details'),
    ).not.toHaveAttribute('open')

    act(() => audioInstances.at(-1)?.end())
    expect(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).toBeVisible()
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/speaking/sessions/') && init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      exam_type: 'toefl',
    })
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/advance/')),
    ).toHaveLength(0)
  })

  it('falls back to advance when an older creation response has no open prompt', async () => {
    const fetchMock = installScenario({
      advances: [promptedSession],
      created: createdSession,
    })
    render(<SpeakingPage />)
    await screen.findByRole('heading', {
      name: 'کدام ساختار را تمرین می‌کنی؟',
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'TOEFL Speaking · Current practice' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'شروع تمرین TOEFL' }))

    expect(await screen.findByText('فقط گوش کن و تکرار کن')).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/advance/')),
    ).toHaveLength(1)
  })

  it('uses a prominent play fallback when browser autoplay is blocked', async () => {
    installScenario()
    installMicrophone()
    audioPlay.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    render(<SpeakingPage />)

    await reachPrompt()

    const play = await screen.findByRole('button', {
      name: 'پخش سؤال',
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
      advances: [nextPromptSession],
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
    expect(screen.getByText(/پاسخ ۲ از ۱۱/)).toBeVisible()
    expect(screen.getByText('در حال پخش')).toBeVisible()

    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/responses/'),
    )
    const formData = uploadCall?.[1]?.body as FormData
    expect(formData.get('prompt_id')).toBe(repeatPrompt.id)
    expect(formData.get('recording_duration_ms')).toBe('4250')
    expect(formData.get('client_event_id')).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('pauses on a flagged review and lets the learner continue unchanged', async () => {
    const fetchMock = installScenario({
      advances: [nextPromptSession],
      responses: [committedSession],
      reviews: [warnedSession],
    })
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'flagged.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت این پاسخ' }))

    expect(
      await screen.findByText(
        'این پاسخ به پرسش مرتبط نیست؛ می‌توانی دوباره ضبط کنی.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'ضبط پاسخ جایگزین' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'ادامه با همین پاسخ' }),
    ).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/advance/')),
    ).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'ادامه با همین پاسخ' }))
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/advance/')),
    ).toHaveLength(1)
  })

  it('replaces a flagged response once, reviews revision two, then allows continuation only', async () => {
    const fetchMock = installScenario({
      advances: [nextPromptSession],
      replacements: [replacementSession],
      responses: [committedSession],
      reviews: [warnedSession, secondWarnedSession],
    })
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['first'], 'first.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت این پاسخ' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'ضبط پاسخ جایگزین' }),
    )

    expect(
      screen.getByRole('button', { name: 'ضبط پاسخ جایگزین' }),
    ).toBeVisible()
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['second'], 'second.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'ثبت پاسخ جایگزین' }),
    )

    expect(
      await screen.findByText('پاسخ جایگزین هم به پرسش مرتبط نیست.'),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'ضبط پاسخ جایگزین' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'ادامه با همین پاسخ' }),
    ).toBeVisible()
    const replacementCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/replacement/'),
    )
    const replacementForm = replacementCall?.[1]?.body as FormData
    expect(replacementForm.get('expected_revision')).toBe('1')
    expect(replacementForm.get('recording_duration_ms')).toBe('4250')
  })

  it('keeps a failed replacement take locally and leaves the committed answer in the transcript', async () => {
    installScenario({
      replacements: [
        {
          payload: { code: 'provider_unavailable', detail: 'failed' },
          status: 503,
        },
      ],
      responses: [committedSession],
      reviews: [warnedSession],
    })
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['first'], 'first.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت این پاسخ' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'ضبط پاسخ جایگزین' }),
    )
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [
          new File(['second'], 'replacement.webm', { type: 'audio/webm' }),
        ],
      },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'ثبت پاسخ جایگزین' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'پاسخ قبلی محفوظ است',
    )
    expect(screen.getByText('replacement.webm')).toBeVisible()
    expect(
      screen.getAllByText('Please bring your notebook today.').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('continues automatically with a saved answer when its review is unavailable', async () => {
    const fetchMock = installScenario({
      advances: [nextPromptSession],
      responses: [committedSession],
      reviews: [
        {
          payload: { code: 'provider_unavailable', detail: 'failed' },
          status: 503,
        },
      ],
    })
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'saved.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت این پاسخ' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'بررسی کوتاه آن فعلاً انجام نشد',
    )
    expect(await screen.findByText('در حال پخش')).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/advance/')),
    ).toHaveLength(1)
  })

  it('supports pause, continue, and replay while recording remains locked', async () => {
    installScenario()
    render(<SpeakingPage />)
    await reachPrompt()

    const pause = await screen.findByRole('button', { name: 'توقف موقت' })
    expect(
      screen.queryByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).not.toBeInTheDocument()
    fireEvent.click(pause)
    const resume = await screen.findByRole('button', { name: 'ادامهٔ پخش' })
    expect(
      screen.queryByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).not.toBeInTheDocument()
    fireEvent.click(resume)
    act(() => audioInstances.at(-1)?.end())
    expect(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'پخش دوباره' }))
    expect(
      screen.queryByRole('button', { name: 'شروع ضبط پاسخ' }),
    ).not.toBeInTheDocument()
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
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    fireEvent.click(await screen.findByRole('button', { name: 'توقف ضبط' }))
    await screen.findByText('پاسخ ضبط‌شده')

    expect(stopTrack).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('confirms exit while a recording is active or still being prepared', async () => {
    installScenario()
    installMicrophone()
    class DeferredStopMediaRecorder {
      mimeType = 'audio/webm'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null
      state: RecordingState = 'inactive'

      constructor(readonly stream: MediaStream) {}

      start() {
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
      }
    }
    vi.stubGlobal('MediaRecorder', DeferredStopMediaRecorder)
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())

    fireEvent.click(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    )
    await screen.findByRole('button', { name: 'توقف ضبط' })
    const exit = screen.getByRole('button', {
      name: 'خروج و ادامه بعداً',
    })
    fireEvent.click(exit)
    expect(screen.getByRole('dialog', { name: 'خروج بدون ثبت؟' })).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'توقف ضبط' }))
    fireEvent.click(exit)
    expect(screen.getByRole('dialog', { name: 'خروج بدون ثبت؟' })).toBeVisible()
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

  it('keeps the recorded take visible and reassures after six seconds before commit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const response = deferred<Response>()
    installScenario({ responses: [response.promise] })
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [
          new File(['voice'], 'slow-upload.webm', { type: 'audio/webm' }),
        ],
      },
    })
    await screen.findByText('slow-upload.webm')
    fireEvent.click(screen.getByRole('button', { name: 'ثبت این پاسخ' }))

    expect(screen.getByText('slow-upload.webm')).toBeVisible()
    expect(screen.getAllByText('در حال ثبت پاسخ…').length).toBeGreaterThan(0)
    await act(() => vi.advanceTimersByTimeAsync(6_000))
    expect(screen.getByText('ضبط شما روی این دستگاه محفوظ است.')).toBeVisible()

    response.resolve(
      new Response(JSON.stringify(committedSession), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(await screen.findByText('در حال پخش')).toBeVisible()
  })

  it('releases a committed take while the next speech is loading', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const nextSpeech = deferred<Response>()
    installScenario({
      advances: [nextPromptSession],
      responses: [committedSession],
      speeches: [
        new Blob(['first mp3'], { type: 'audio/mpeg' }),
        nextSpeech.promise,
      ],
    })
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'committed.webm', { type: 'audio/webm' })],
      },
    })
    await screen.findByText('committed.webm')
    fireEvent.click(screen.getByRole('button', { name: 'ثبت این پاسخ' }))

    await waitFor(() =>
      expect(screen.queryByText('committed.webm')).not.toBeInTheDocument(),
    )
    expect(
      (await screen.findAllByText('صدا در حال آماده‌شدن است…')).length,
    ).toBeGreaterThan(0)
    nextSpeech.resolve(
      new Response(new Blob(['next mp3'], { type: 'audio/mpeg' }), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    )
    expect(await screen.findByText('در حال پخش')).toBeVisible()
  })

  it('shows committed history and retries next-question generation without reuploading', async () => {
    const fetchMock = installScenario({
      advances: [
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

  it('restores an unresolved review warning on resume before advancing', async () => {
    const fetchMock = installScenario({
      detail: warnedSession,
      list: [warnedSession],
    })
    render(<SpeakingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'ادامهٔ تمرین' }))

    expect(
      await screen.findByText(
        'این پاسخ به پرسش مرتبط نیست؛ می‌توانی دوباره ضبط کنی.',
      ),
    ).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/review/')),
    ).toHaveLength(0)
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/advance/')),
    ).toHaveLength(0)
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
    expect(screen.getByText(/هیچ نمره، تخمین باند یا تشخیص سطحی/)).toBeVisible()
    expect(
      screen.getAllByText('Please bring your notebook today.'),
    ).toHaveLength(2)
  })

  it('loads structured feedback on demand, retries provider errors, and reuses cached content', async () => {
    const completed = session({
      completed_at: now,
      current_item_index: 11,
      current_prompt_id: null,
      current_stage: 'completed',
      required_response_count: 11,
      response_count: 11,
      status: 'completed',
      turns: [greeting, visibleRepeatPrompt, answer],
    })
    const firstFeedback = deferred<Response>()
    const fetchMock = installScenario({
      detail: completed,
      feedbacks: [firstFeedback.promise, feedbackResource],
      list: [completed],
    })
    render(<SpeakingPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'دیدن متن جلسه' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'دریافت بازخورد' }),
    )
    expect(
      screen.getAllByText('در حال آماده‌سازی بازخورد…').length,
    ).toBeGreaterThan(0)

    firstFeedback.resolve(
      new Response(
        JSON.stringify({
          detail: 'provider failed',
          code: 'provider_unavailable',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('بازخورد آماده نشد')
    expect(error).toHaveFocus()
    expect(
      screen.queryByRole('button', { name: 'دریافت بازخورد' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))

    const goalHeading = await screen.findByRole('heading', {
      name: 'پاسخ را یک گام گسترش بده',
    })
    expect(goalHeading).toBeVisible()
    expect(goalHeading).toHaveFocus()
    expect(await screen.findByText('بازخورد آماده شد.')).toBeInTheDocument()
    expect(screen.getByText('تمرکز خوب روی سؤال')).toBeVisible()
    const excerpt = screen.getByText('I study library after class.')
    expect(excerpt).toHaveAttribute('dir', 'ltr')
    expect(excerpt).toHaveAttribute('lang', 'en')
    expect(screen.getAllByText('نسخهٔ پیشنهادی')).toHaveLength(2)
    expect(screen.getByText('پاسخ را یک گام گسترش بده')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'بازگشت به جلسه‌ها' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'دیدن متن جلسه' }),
    )
    expect(await screen.findByText('تمرکز خوب روی سؤال')).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/feedback/'),
      ),
    ).toHaveLength(2)
  })

  it('aborts feedback on navigation and ignores a late stale result', async () => {
    const completed = session({
      completed_at: now,
      current_item_index: 11,
      current_prompt_id: null,
      current_stage: 'completed',
      required_response_count: 11,
      response_count: 11,
      status: 'completed',
      turns: [greeting, visibleRepeatPrompt, answer],
    })
    const pendingFeedback = deferred<Response>()
    const fetchMock = installScenario({
      detail: completed,
      feedbacks: [pendingFeedback.promise],
      list: [completed],
    })
    render(<SpeakingPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'دیدن متن جلسه' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'دریافت بازخورد' }),
    )
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).endsWith('/feedback/'),
        ),
      ).toBe(true),
    )
    const feedbackCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/feedback/'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'بازگشت به جلسه‌ها' }))
    expect(feedbackCall?.[1]?.signal?.aborted).toBe(true)

    await act(async () => {
      pendingFeedback.resolve(
        new Response(JSON.stringify(feedbackResource), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      await Promise.resolve()
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'دیدن متن جلسه' }),
    )
    expect(
      await screen.findByRole('button', { name: 'دریافت بازخورد' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'نقطه‌های قوت' }),
    ).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/feedback/'),
      ),
    ).toHaveLength(1)
  })

  it('moves directly to completion after the final accepted response and plays the closing', async () => {
    const onePromptSession = session({
      current_prompt_id: repeatPrompt.id,
      current_stage: 'toefl_repeat',
      required_response_count: 1,
      turns: [greeting, repeatPrompt],
    })
    const finalCommitted = session({
      current_item_index: 0,
      current_prompt_id: null,
      current_stage: 'toefl_repeat',
      required_response_count: 1,
      response_count: 1,
      timing_summary: committedSession.timing_summary,
      turns: [greeting, visibleRepeatPrompt, answer],
    })
    const finalReviewed = session({
      ...finalCommitted,
      turns: [greeting, visibleRepeatPrompt, reviewedAnswer],
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
      created: onePromptSession,
      advances: [completed],
      responses: [finalCommitted],
      reviews: [finalReviewed],
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
    expect(screen.getByText(/هیچ نمره، تخمین باند یا تشخیص سطحی/)).toBeVisible()
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

    const abandon = screen.getByRole('button', {
      name: 'پایان دادن به جلسه',
    })
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

  it('confirms خروج بدون ثبت for an unsent take', async () => {
    const fetchMock = installScenario()
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'unsent.webm', { type: 'audio/webm' })],
      },
    })
    await screen.findByText('unsent.webm')

    const athena = screen.getByRole('button', {
      name: 'خروج و ادامه بعداً',
    })
    const background = athena.closest('main')?.firstElementChild
    fireEvent.click(athena)
    expect(screen.getByRole('dialog', { name: 'خروج بدون ثبت؟' })).toBeVisible()
    expect(background).toHaveAttribute('aria-hidden', 'true')
    expect(background).toHaveAttribute('inert')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(athena).toHaveFocus()
    expect(background).not.toHaveAttribute('aria-hidden')
    expect(background).not.toHaveAttribute('inert')

    fireEvent.click(athena)
    fireEvent.click(screen.getByRole('button', { name: 'خروج بدون ثبت' }))

    expect(
      await screen.findByRole('heading', {
        name: 'کدام ساختار را تمرین می‌کنی؟',
      }),
    ).toBeVisible()
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith('/abandon/')),
    ).toBe(false)
  })

  it('aborts a slow request on clean exit and ignores its stale completion', async () => {
    const nextSpeech = deferred<Response>()
    const fetchMock = installScenario({
      advances: [nextPromptSession],
      responses: [committedSession],
      speeches: [
        new Blob(['first mp3'], { type: 'audio/mpeg' }),
        nextSpeech.promise,
      ],
    })
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'saved.webm', { type: 'audio/webm' })],
      },
    })
    await screen.findByText('saved.webm')
    fireEvent.click(screen.getByRole('button', { name: 'ثبت این پاسخ' }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).endsWith('/speech/'),
        ),
      ).toHaveLength(2)
    })
    const speechSignal = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/speech/'),
    )[1]?.[1]?.signal

    fireEvent.click(screen.getByRole('button', { name: 'خروج و ادامه بعداً' }))
    expect(speechSignal?.aborted).toBe(true)
    expect(
      await screen.findByRole('heading', {
        name: 'کدام ساختار را تمرین می‌کنی؟',
      }),
    ).toBeVisible()

    nextSpeech.resolve(
      new Response(new Blob(['late mp3'], { type: 'audio/mpeg' }), {
        status: 200,
      }),
    )
    await act(async () => Promise.resolve())
    expect(
      screen.queryByRole('heading', { name: 'تمرین Speaking TOEFL' }),
    ).not.toBeInTheDocument()
  })

  it('announces expired auth when session creation fails', async () => {
    const fetchMock = installScenario({
      created: { status: 401, payload: { detail: 'expired' } },
    })
    const authRequired = vi.fn()
    window.addEventListener(AUTH_REQUIRED_EVENT, authRequired)
    render(<SpeakingPage />)

    await screen.findByRole('heading', {
      name: 'کدام ساختار را تمرین می‌کنی؟',
    })
    fireEvent.click(screen.getByRole('button', { name: 'شروع تمرین IELTS' }))
    await waitFor(() => expect(authRequired).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalled()
    window.removeEventListener(AUTH_REQUIRED_EVENT, authRequired)
  })

  it('shows the upload fallback after microphone permission is denied', async () => {
    installScenario()
    const { getUserMedia } = installMicrophone('denied')
    vi.stubGlobal('MediaRecorder', class {})
    render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())

    fireEvent.click(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'اجازهٔ میکروفن داده نشد',
    )
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(screen.getByLabelText('انتخاب فایل صوتی')).toBeInTheDocument()
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
    vi.stubGlobal('MediaRecorder', class {})
    const { unmount } = render(<SpeakingPage />)
    await reachPrompt()
    act(() => audioInstances.at(-1)?.end())
    fireEvent.click(
      await screen.findByRole('button', { name: 'شروع ضبط پاسخ' }),
    )
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    expect(
      screen.getByText(
        'صدا برای تبدیل به متن ارسال می‌شود؛ در سابقه فقط متن پاسخ نگه‌داری می‌شود.',
      ),
    ).toBeVisible()

    unmount()
    resolveStream(stream)
    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
  })
})
