import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SpeakingPage from '@/app/speaking/page'

const session = {
  id: 'session-1',
  exam_type: 'ielts',
  status: 'in_progress',
  created_at: '2026-08-02T10:00:00Z',
  updated_at: '2026-08-02T10:00:00Z',
  turns: [],
}

const turnResult = {
  turns: [
    {
      id: 'turn-1',
      role: 'learner',
      sequence: 1,
      text: 'I enjoy learning English.',
      created_at: '2026-08-02T10:01:00Z',
    },
    {
      id: 'turn-2',
      role: 'examiner',
      sequence: 2,
      text: 'Thank you. Your response has been recorded.',
      created_at: '2026-08-02T10:01:01Z',
    },
  ],
}

function json(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function fetchForSuccessfulFlow() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (url.endsWith('/speaking/sessions/')) return json(session, 201)
    if (url.endsWith('/turns/')) return json(turnResult, 201)
    if (url.endsWith('/turns/turn-2/speech/')) {
      return Promise.resolve(
        new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), {
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      )
    }
    if (url.endsWith('/complete/')) {
      return json({ ...session, status: 'completed', turns: turnResult.turns })
    }
    return json({ detail: `Unexpected request: ${url} ${init?.method}` }, 500)
  })
}

describe('SpeakingPage', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:examiner-speech')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts a session, uploads a file, renders both turns, plays speech, and completes', async () => {
    const fetchMock = fetchForSuccessfulFlow()
    render(<SpeakingPage />)

    fireEvent.change(screen.getByLabelText('نوع آزمون'), {
      target: { value: 'toefl' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'شروع جلسه' }))

    await screen.findByRole('heading', { name: 'پاسخ تازه' })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      exam_type: 'toefl',
    })

    const file = new File(['voice'], 'answer.webm', { type: 'audio/webm' })
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: { files: [file] },
    })
    expect(screen.getByText('answer.webm')).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'ارسال و تبدیل به متن' }),
    )

    expect(await screen.findByText('I enjoy learning English.')).toBeVisible()
    expect(
      screen.getByText('Thank you. Your response has been recorded.'),
    ).toBeVisible()
    const player = await screen.findByLabelText('پاسخ صوتی ممتحن')
    expect(player).toHaveAttribute('src', 'blob:examiner-speech')
    expect(screen.getByText(/صدا با هوش مصنوعی تولید شده/)).toBeVisible()

    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/turns/'),
    )
    const uploadRequest = uploadCall?.[1]
    expect(uploadRequest?.body).toBeInstanceOf(FormData)
    expect(new Headers(uploadRequest?.headers).has('Content-Type')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'پایان جلسه' }))
    expect(
      await screen.findByText('این جلسه کامل شده و پاسخ تازه‌ای نمی‌پذیرد.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'پایان جلسه' })).toBeDisabled()
  })

  it('records with MediaRecorder and submits the captured browser audio', async () => {
    fetchForSuccessfulFlow()
    const stopTrack = vi.fn()
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })

    class FakeMediaRecorder {
      state: RecordingState = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null

      constructor(readonly stream: MediaStream) {}

      start() {
        this.state = 'recording'
      }

      stop() {
        this.ondataavailable?.({
          data: new Blob(['recording'], { type: 'audio/webm' }),
        } as BlobEvent)
        this.state = 'inactive'
        this.onstop?.()
      }
    }

    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    render(<SpeakingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'شروع جلسه' }))
    await screen.findByRole('heading', { name: 'پاسخ تازه' })

    fireEvent.click(screen.getByRole('button', { name: 'شروع ضبط' }))
    expect(
      await screen.findByRole('button', { name: 'توقف ضبط' }),
    ).toBeVisible()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    fireEvent.click(screen.getByRole('button', { name: 'توقف ضبط' }))
    expect(await screen.findByText('ضبط آمادهٔ ارسال است.')).toBeVisible()
    expect(stopTrack).toHaveBeenCalledOnce()

    fireEvent.click(
      screen.getByRole('button', { name: 'ارسال و تبدیل به متن' }),
    )
    expect(await screen.findByText('I enjoy learning English.')).toBeVisible()
  })

  it('shows a useful fallback when microphone permission is denied', async () => {
    fetchForSuccessfulFlow()
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError'),
      )
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    vi.stubGlobal('MediaRecorder', class {})

    render(<SpeakingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'شروع جلسه' }))
    await screen.findByRole('heading', { name: 'پاسخ تازه' })
    fireEvent.click(screen.getByRole('button', { name: 'شروع ضبط' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'اجازهٔ دسترسی به میکروفن داده نشد',
    )
    expect(screen.getByLabelText('انتخاب فایل صوتی')).toBeInTheDocument()
  })
})
