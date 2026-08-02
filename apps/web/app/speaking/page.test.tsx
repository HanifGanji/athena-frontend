import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SpeakingPage from '@/app/speaking/page'

function audioResponse() {
  return Promise.resolve(
    new Response(new Blob(['examiner mp3'], { type: 'audio/mpeg' }), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    }),
  )
}

function fetchForSuccessfulResponse() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (url.endsWith('/speaking/respond/')) return audioResponse()
    return Promise.resolve(
      new Response(
        JSON.stringify({
          detail: `Unexpected request: ${url} ${init?.method}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  })
}

function installMicrophone() {
  const stopTrack = vi.fn()
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  return { getUserMedia, stopTrack }
}

describe('SpeakingPage', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=speaking-test-token; path=/'
    let objectUrlSequence = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:speaking-${++objectUrlSequence}`,
    )
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('enters practice without requesting microphone access or starting a recording', async () => {
    const fetchMock = fetchForSuccessfulResponse()
    const { getUserMedia } = installMicrophone()
    vi.stubGlobal('MediaRecorder', class {})
    render(<SpeakingPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'TOEFL Speaking practice' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))

    expect(
      await screen.findByRole('heading', {
        name: 'وقتی آماده‌ای، ضبط را شروع کن',
      }),
    ).toBeVisible()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'شروع ضبط پاسخ' })).toBeVisible()
    expect(screen.queryByText('متن جلسه')).not.toBeInTheDocument()
  })

  it('uploads one stateless answer and renders only the examiner voice response', async () => {
    const fetchMock = fetchForSuccessfulResponse()
    render(<SpeakingPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'TOEFL Speaking practice' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))

    const file = new File(['learner voice'], 'answer.webm', {
      type: 'audio/webm',
    })
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: { files: [file] },
    })

    expect(await screen.findByText('answer.webm')).toBeVisible()
    expect(screen.getByLabelText('بازبینی پاسخ ضبط‌شده')).toHaveAttribute(
      'src',
      'blob:speaking-1',
    )
    fireEvent.click(screen.getByRole('button', { name: 'ارسال پاسخ' }))

    const player = await screen.findByLabelText('پاسخ صوتی ممتحن')
    expect(player).toHaveAttribute('src', 'blob:speaking-2')
    expect(
      screen.queryByText('I enjoy learning English.'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Thank you. Your response has been recorded.'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('متن جلسه')).not.toBeInTheDocument()

    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/speaking/respond/'),
    )
    const uploadRequest = uploadCall?.[1]
    expect(uploadRequest?.body).toBeInstanceOf(FormData)
    const formData = uploadRequest?.body as FormData
    expect(formData.get('exam_type')).toBe('toefl')
    expect((formData.get('audio') as File).name).toBe('answer.webm')
    expect(uploadRequest?.credentials).toBe('include')
    expect(new Headers(uploadRequest?.headers).has('Content-Type')).toBe(false)
    expect(new Headers(uploadRequest?.headers).get('X-CSRFToken')).toBe(
      'speaking-test-token',
    )

    fireEvent.click(screen.getByRole('button', { name: 'پایان تمرین' }))
    expect(
      await screen.findByRole('heading', { name: 'تمرین تمام شد' }),
    ).toBeVisible()
    expect(screen.getByText(/هیچ فایل صوتی یا متنی ذخیره نشد/)).toBeVisible()
  })

  it('records only after the explicit click and replaces the first take when re-recording', async () => {
    const fetchMock = fetchForSuccessfulResponse()
    const { getUserMedia, stopTrack } = installMicrophone()
    let recordingNumber = 0

    class FakeMediaRecorder {
      state: RecordingState = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null

      constructor(readonly stream: MediaStream) {}

      start() {
        recordingNumber += 1
        this.state = 'recording'
      }

      stop() {
        const contents =
          recordingNumber === 1 ? 'first' : 'replacement recording'
        this.ondataavailable?.({
          data: new Blob([contents], { type: 'audio/webm' }),
        } as BlobEvent)
        this.state = 'inactive'
        this.onstop?.()
      }
    }

    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    render(<SpeakingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))

    expect(getUserMedia).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'شروع ضبط پاسخ' }))
    expect(
      await screen.findByRole('button', { name: 'توقف ضبط' }),
    ).toBeVisible()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    fireEvent.click(screen.getByRole('button', { name: 'توقف ضبط' }))

    expect(await screen.findByText('پاسخ ضبط‌شده')).toBeVisible()
    expect(screen.getByRole('button', { name: 'ضبط دوباره' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'ضبط دوباره' }))
    expect(
      await screen.findByRole('button', { name: 'توقف ضبط' }),
    ).toBeVisible()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'توقف ضبط' }))

    await screen.findByText('پاسخ ضبط‌شده')
    fireEvent.click(screen.getByRole('button', { name: 'ارسال پاسخ' }))
    await screen.findByLabelText('پاسخ صوتی ممتحن')

    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/speaking/respond/'),
    )
    const formData = uploadCall?.[1]?.body as FormData
    const submittedAudio = formData.get('audio') as File
    expect(submittedAudio.size).toBe(new Blob(['replacement recording']).size)
    expect(stopTrack).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('shows an accessible file fallback when microphone permission is denied', async () => {
    fetchForSuccessfulResponse()
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
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))
    fireEvent.click(screen.getByRole('button', { name: 'شروع ضبط پاسخ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'اجازهٔ دسترسی به میکروفن داده نشد',
    )
    expect(screen.getByLabelText('انتخاب فایل صوتی')).toBeInTheDocument()
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
  })

  it('never renders transcript-like text from a failed response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'خطا: PRIVATE TRANSCRIPT I enjoy learning English.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    render(<SpeakingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'answer.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ارسال پاسخ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'پاسخ صوتی ممتحن آماده نشد',
    )
    expect(screen.queryByText(/PRIVATE TRANSCRIPT/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/I enjoy learning English/),
    ).not.toBeInTheDocument()
  })

  it('does not create a response URL when submission finishes after unmount', async () => {
    let resolveResponse: (response: Response) => void = () => undefined
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        }),
    )
    const { unmount } = render(<SpeakingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))
    fireEvent.change(screen.getByLabelText('انتخاب فایل صوتی'), {
      target: {
        files: [new File(['voice'], 'answer.webm', { type: 'audio/webm' })],
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'ارسال پاسخ' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())

    unmount()
    resolveResponse(
      new Response(new Blob(['examiner mp3'], { type: 'audio/mpeg' }), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:speaking-1')
  })

  it('stops a microphone stream that arrives after the practice page unmounts', async () => {
    const stopTrack = vi.fn()
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream
    let resolveStream: (stream: MediaStream) => void = () => undefined
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
    const recorderConstructor = vi.fn()
    vi.stubGlobal(
      'MediaRecorder',
      class {
        constructor() {
          recorderConstructor()
        }
      },
    )

    const { unmount } = render(<SpeakingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))
    fireEvent.click(screen.getByRole('button', { name: 'شروع ضبط پاسخ' }))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())

    unmount()
    resolveStream(stream)

    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
    expect(recorderConstructor).not.toHaveBeenCalled()
  })

  it('detaches a queued recorder stop callback when the page unmounts', async () => {
    const { stopTrack } = installMicrophone()
    let flushQueuedStop: () => void = () => undefined

    class FakeMediaRecorder {
      state: RecordingState = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null

      constructor() {
        flushQueuedStop = () => this.emitQueuedStop()
      }

      start() {
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
      }

      emitQueuedStop() {
        this.ondataavailable?.({
          data: new Blob(['late recording'], { type: 'audio/webm' }),
        } as BlobEvent)
        this.onstop?.()
      }
    }

    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    const { unmount } = render(<SpeakingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'ورود به محیط تمرین' }))
    fireEvent.click(screen.getByRole('button', { name: 'شروع ضبط پاسخ' }))
    await screen.findByRole('button', { name: 'توقف ضبط' })
    fireEvent.click(screen.getByRole('button', { name: 'توقف ضبط' }))

    unmount()
    flushQueuedStop()

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()
  })
})
