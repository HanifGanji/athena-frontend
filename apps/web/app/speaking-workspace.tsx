'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { type SpeakingExamType, speakingApi } from '@/lib/speaking-api'

const acceptedAudioFormats = '.flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm'

type PracticePhase =
  | 'ready'
  | 'requesting_permission'
  | 'recording'
  | 'stopping'
  | 'review'
  | 'submitting'
  | 'response_ready'
  | 'completed'

type PreparedAudio = {
  blob: Blob
  durationSeconds: number | null
  filename: string
  label: string
  previewUrl: string
}

function recordingFilename(mimeType: string) {
  if (mimeType.includes('mp4')) return 'speaking-recording.mp4'
  if (mimeType.includes('ogg')) return 'speaking-recording.ogg'
  return 'speaking-recording.webm'
}

function examLabel(examType: SpeakingExamType) {
  return examType === 'ielts' ? 'IELTS' : 'TOEFL'
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

function MicrophoneIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="8" y="3" width="8" height="12" rx="4" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  )
}

function HeadphonesIcon({ className = 'size-7' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3ZM20 14a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z" />
    </svg>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-5 animate-spin rounded-full border-2 border-current border-l-transparent"
    />
  )
}

function ExaminerStage({ phase }: { phase: PracticePhase }) {
  return (
    <section
      dir="rtl"
      className="relative overflow-hidden rounded-[1.75rem] bg-[#18302d] p-6 text-white shadow-[0_24px_70px_rgba(24,48,45,0.15)] sm:p-8 lg:min-h-[36rem]"
    >
      <div
        aria-hidden="true"
        className="absolute -top-20 -left-24 size-64 rounded-full bg-[#286f67]/45 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 -bottom-24 size-72 rounded-full bg-[#a14e32]/25 blur-3xl"
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#f0ac87]">
              EXAMINER CHANNEL
            </p>
            <h2 className="mt-2 text-xl font-black">فضای ممتحن</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-[10px] font-black text-[#dcebe5]">
            <span
              className={`size-2 rounded-full ${
                phase === 'response_ready'
                  ? 'animate-pulse bg-[#78d7c9]'
                  : 'bg-white/35'
              }`}
            />
            {phase === 'response_ready' ? 'پاسخ آماده' : 'در انتظار پاسخ شما'}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="relative">
            {phase === 'response_ready' && (
              <span className="absolute inset-[-1rem] animate-ping rounded-full border border-[#78d7c9]/35" />
            )}
            <div className="relative grid size-28 place-items-center rounded-full border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:size-32">
              <HeadphonesIcon className="size-11 text-[#dcebe5]" />
            </div>
          </div>
          <p className="mt-7 text-lg font-black">ممتحن آتنا</p>
          <p className="mt-3 max-w-sm text-xs leading-7 text-[#b8c7c3] sm:text-sm">
            این نسخه محتوای سؤال یا مسیر گفت‌وگو را تعیین نمی‌کند و فقط تجربهٔ
            ضبط و دریافت پاسخ صوتی را شبیه‌سازی می‌کند.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-[#dcebe5]">
              <HeadphonesIcon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-black">از هدفون استفاده کن</p>
              <p className="mt-1 text-[11px] leading-5 text-[#9fb1ad]">
                پاسخ ممتحن فقط به‌صورت صدا پخش می‌شود و متنی نمایش داده نخواهد
                شد.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function phaseAnnouncement(phase: PracticePhase) {
  switch (phase) {
    case 'requesting_permission':
      return 'در حال آماده‌سازی میکروفن.'
    case 'recording':
      return 'ضبط پاسخ شروع شد.'
    case 'stopping':
      return 'در حال آماده‌سازی صدای ضبط‌شده.'
    case 'review':
      return 'ضبط آمادهٔ بازبینی است.'
    case 'submitting':
      return 'پاسخ ارسال شد؛ در حال آماده‌سازی صدای ممتحن.'
    case 'response_ready':
      return 'پاسخ صوتی ممتحن آماده است.'
    case 'completed':
      return 'تمرین پایان یافت.'
    default:
      return 'برای شروع ضبط، دکمهٔ شروع ضبط پاسخ را بزنید.'
  }
}

function phaseTitle(phase: PracticePhase) {
  switch (phase) {
    case 'requesting_permission':
      return 'میکروفن در حال آماده‌شدن است'
    case 'recording':
      return 'پاسخ شما در حال ضبط است'
    case 'stopping':
      return 'ضبط را آماده می‌کنیم'
    case 'review':
      return 'پاسخت را بررسی کن'
    case 'submitting':
      return 'منتظر پاسخ ممتحن باش'
    case 'response_ready':
      return 'پاسخ ممتحن آماده است'
    case 'completed':
      return 'تمرین تمام شد'
    default:
      return 'وقتی آماده‌ای، ضبط را شروع کن'
  }
}

export function SpeakingWorkspace() {
  const [examType, setExamType] = useState<SpeakingExamType>('ielts')
  const [practiceStarted, setPracticeStarted] = useState(false)
  const [phase, setPhase] = useState<PracticePhase>('ready')
  const [preparedAudio, setPreparedAudio] = useState<PreparedAudio | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [speechUrl, setSpeechUrl] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const mountedRef = useRef(true)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardRecordingRef = useRef(false)
  const recordingStartedAtRef = useRef<number | null>(null)
  const preparedAudioRef = useRef<PreparedAudio | null>(null)
  const speechUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const workspaceHeadingRef = useRef<HTMLHeadingElement | null>(null)

  const busy = [
    'requesting_permission',
    'recording',
    'stopping',
    'submitting',
  ].includes(phase)

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function replacePreparedAudio(nextAudio: PreparedAudio | null) {
    if (preparedAudioRef.current) {
      URL.revokeObjectURL(preparedAudioRef.current.previewUrl)
    }
    preparedAudioRef.current = nextAudio
    setPreparedAudio(nextAudio)
    if (!nextAudio && fileInputRef.current) fileInputRef.current.value = ''
  }

  function prepareAudio(
    blob: Blob,
    filename: string,
    label: string,
    durationSeconds: number | null,
  ) {
    replacePreparedAudio({
      blob,
      durationSeconds,
      filename,
      label,
      previewUrl: URL.createObjectURL(blob),
    })
  }

  function replaceSpeechUrl(nextUrl: string | null) {
    if (speechUrlRef.current) URL.revokeObjectURL(speechUrlRef.current)
    speechUrlRef.current = nextUrl
    setSpeechUrl(nextUrl)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const recorder = recorderRef.current
      if (recorder) {
        recorder.ondataavailable = null
        recorder.onstop = null
        if (recorder.state !== 'inactive') recorder.stop()
        recorderRef.current = null
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (preparedAudioRef.current) {
        URL.revokeObjectURL(preparedAudioRef.current.previewUrl)
      }
      if (speechUrlRef.current) URL.revokeObjectURL(speechUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'recording') return

    const updateTimer = () => {
      const startedAt = recordingStartedAtRef.current
      if (startedAt === null) return
      setRecordingSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      )
    }

    updateTimer()
    const interval = window.setInterval(updateTimer, 250)
    return () => window.clearInterval(interval)
  }, [phase])

  useEffect(() => {
    if (practiceStarted) workspaceHeadingRef.current?.focus()
  }, [practiceStarted])

  function startPractice() {
    setError(null)
    setPhase('ready')
    setPracticeStarted(true)
  }

  async function startRecording() {
    if (busy || phase === 'response_ready' || phase === 'completed') return

    setError(null)
    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        'ضبط صدا در این مرورگر در دسترس نیست؛ می‌توانید از فایل صوتی استفاده کنید.',
      )
      return
    }

    setPhase('requesting_permission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      discardRecordingRef.current = false

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const chunks = chunksRef.current
        const mimeType = recorder.mimeType || chunks[0]?.type || 'audio/webm'
        const startedAt = recordingStartedAtRef.current
        const durationSeconds =
          startedAt === null
            ? null
            : Math.max(1, Math.round((Date.now() - startedAt) / 1000))

        if (!discardRecordingRef.current && chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType })
          prepareAudio(
            blob,
            recordingFilename(mimeType),
            'پاسخ ضبط‌شده',
            durationSeconds,
          )
          setPhase('review')
        } else if (!discardRecordingRef.current) {
          setError('صدایی ضبط نشد؛ دوباره تلاش کنید.')
          setPhase('ready')
        }

        chunksRef.current = []
        recorderRef.current = null
        recordingStartedAtRef.current = null
        stopTracks()
      }

      recorder.start()
      replacePreparedAudio(null)
      replaceSpeechUrl(null)
      recordingStartedAtRef.current = Date.now()
      setRecordingSeconds(0)
      setPhase('recording')
    } catch (reason) {
      if (!mountedRef.current) return
      stopTracks()
      recorderRef.current = null
      chunksRef.current = []
      recordingStartedAtRef.current = null
      const denied =
        reason instanceof DOMException && reason.name === 'NotAllowedError'
      setError(
        denied
          ? 'اجازهٔ دسترسی به میکروفن داده نشد. دسترسی را فعال کنید یا فایل صوتی انتخاب کنید.'
          : 'میکروفن آماده نشد؛ اتصال آن را بررسی کنید یا فایل صوتی انتخاب کنید.',
      )
      setPhase(preparedAudioRef.current ? 'review' : 'ready')
    }
  }

  function stopRecording(discard = false) {
    const recorder = recorderRef.current
    discardRecordingRef.current = discard
    setPhase('stopping')
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else {
      stopTracks()
      setPhase(
        discard ? 'ready' : preparedAudioRef.current ? 'review' : 'ready',
      )
    }
  }

  function chooseFile(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    replaceSpeechUrl(null)
    prepareAudio(file, file.name, file.name, null)
    setPhase('review')
  }

  function discardPreparedAudio() {
    replacePreparedAudio(null)
    setError(null)
    setPhase('ready')
  }

  async function submitAudio() {
    if (!preparedAudio || phase !== 'review') return
    setPhase('submitting')
    setError(null)
    replaceSpeechUrl(null)

    try {
      const speech = await speakingApi.respond(
        examType,
        preparedAudio.blob,
        preparedAudio.filename,
      )
      if (!mountedRef.current) return
      replaceSpeechUrl(URL.createObjectURL(speech))
      replacePreparedAudio(null)
      setPhase('response_ready')
    } catch {
      if (!mountedRef.current) return
      setError('پاسخ صوتی ممتحن آماده نشد. ضبط شما برای تلاش دوباره آماده است.')
      setPhase('review')
    }
  }

  function finishPractice() {
    replacePreparedAudio(null)
    replaceSpeechUrl(null)
    setError(null)
    setPhase('completed')
  }

  function startAnotherPractice() {
    replacePreparedAudio(null)
    replaceSpeechUrl(null)
    setError(null)
    setRecordingSeconds(0)
    setPhase('ready')
  }

  function leavePractice() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      discardRecordingRef.current = true
      recorder.stop()
    } else {
      stopTracks()
    }
    replacePreparedAudio(null)
    replaceSpeechUrl(null)
    setError(null)
    setRecordingSeconds(0)
    setPhase('ready')
    setPracticeStarted(false)
  }

  if (!practiceStarted) {
    return (
      <main className="relative min-h-svh overflow-hidden bg-[#f4f1e8] text-[#18302d]">
        <div
          aria-hidden="true"
          className="absolute -top-36 -left-28 size-96 rounded-full bg-[#dcebe5] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute right-[-10rem] bottom-[-8rem] size-[30rem] rounded-full bg-[#f3dfd6]/75 blur-3xl"
        />

        <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col px-5 py-7 sm:px-8 lg:py-10">
          <header className="flex items-center justify-between border-b border-[#18302d]/15 pb-5">
            <Link
              href="/"
              aria-label="بازگشت به صفحهٔ اصلی"
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155e57]"
            >
              <p className="font-mono text-[10px] tracking-[0.25em] text-[#a14e32]">
                ATHENA · SPEAKING
              </p>
              <p className="mt-1 text-2xl font-black">آتنا</p>
            </Link>
            <span className="rounded-full border border-[#155e57]/20 bg-white/70 px-3 py-2 text-xs font-black text-[#155e57] sm:px-4">
              حالت تمرین
            </span>
          </header>

          <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-16">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#155e57]/15 bg-[#dcebe5]/60 px-4 py-2 text-xs font-black text-[#155e57]">
                <span className="size-2 rounded-full bg-[#155e57]" />
                تجربهٔ صوتی، بدون ذخیره‌سازی
              </div>
              <h1 className="max-w-3xl text-5xl leading-[1.12] font-black tracking-[-0.045em] sm:text-7xl">
                مثل روز آزمون،
                <span className="block text-[#155e57]">
                  فقط روی صحبت تمرکز کن.
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-sm leading-8 text-[#52625f] sm:text-base">
                ضبط فقط با فشردن دکمه شروع می‌شود. قبل از ارسال می‌توانی صدایت
                را بشنوی و دوباره ضبط کنی؛ بعد از ارسال هم فقط پاسخ صوتی ممتحن
                را دریافت می‌کنی.
              </p>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ['۰۱', 'ضبط با اجازهٔ شما'],
                  ['۰۲', 'بازبینی و ضبط دوباره'],
                  ['۰۳', 'پاسخ فقط به‌صورت صوتی'],
                ].map(([number, label]) => (
                  <div
                    key={number}
                    className="rounded-2xl border border-[#18302d]/10 bg-white/55 p-4"
                  >
                    <p className="font-mono text-[10px] text-[#a14e32]">
                      {number}
                    </p>
                    <p className="mt-2 text-xs leading-6 font-black">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <section
              aria-labelledby="setup-title"
              className="rounded-[2rem] border border-[#18302d]/10 bg-[#fffdf8] p-6 shadow-[0_24px_80px_rgba(24,48,45,0.1)] sm:p-8"
            >
              <p className="font-mono text-[10px] tracking-[0.2em] text-[#a14e32]">
                TEST SETUP
              </p>
              <h2 id="setup-title" className="mt-2 text-2xl font-black">
                محیط تمرینت را انتخاب کن
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#5f6f6b]">
                این نسخه روی تجربهٔ ضبط و پاسخ صوتی تمرکز دارد؛ محتوای سؤال و
                مدیریت گفت‌وگو بعداً اضافه می‌شود.
              </p>

              <fieldset className="mt-7">
                <legend className="mb-3 text-xs font-black text-[#52625f]">
                  نوع آزمون
                </legend>
                <div className="grid grid-cols-2 gap-3" dir="ltr">
                  {(['ielts', 'toefl'] as const).map((type) => {
                    const selected = examType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        lang="en"
                        aria-label={`${examLabel(type)} Speaking practice`}
                        aria-pressed={selected}
                        onClick={() => setExamType(type)}
                        className={`rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] ${
                          selected
                            ? 'border-[#155e57] bg-[#dcebe5]/70 text-[#123f3a]'
                            : 'border-[#18302d]/12 bg-white text-[#52625f] hover:border-[#155e57]/45'
                        }`}
                      >
                        <span className="block text-lg font-black">
                          {examLabel(type)}
                        </span>
                        <span className="mt-1 block text-[11px] opacity-70">
                          Speaking practice
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={startPractice}
                className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#18302d] px-6 py-4 text-sm font-black text-white transition hover:bg-[#155e57] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155e57]"
              >
                ورود به محیط تمرین
                <span aria-hidden="true" dir="ltr">
                  ←
                </span>
              </button>
              <p className="mt-4 text-center text-[11px] leading-6 text-[#65716e]">
                ورود به محیط تمرین، میکروفن را خودکار روشن نمی‌کند.
              </p>
            </section>
          </section>
        </div>
      </main>
    )
  }

  const responseStep = phase === 'response_ready' || phase === 'completed'
  const recordingStep = [
    'requesting_permission',
    'recording',
    'stopping',
    'review',
    'submitting',
  ].includes(phase)

  return (
    <main className="min-h-svh bg-[#edf1ed] text-[#18302d]">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {phaseAnnouncement(phase)}
      </p>

      <header className="border-b border-[#18302d]/10 bg-[#fffdf8]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              href="/"
              aria-label="بازگشت به صفحهٔ اصلی"
              className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155e57]"
            >
              <span className="text-xl font-black">آتنا</span>
            </Link>
            <span aria-hidden="true" className="h-6 w-px bg-[#18302d]/15" />
            <div className="min-w-0">
              <p
                dir="ltr"
                lang="en"
                className="truncate font-mono text-[10px] tracking-[0.14em] text-[#a14e32]"
              >
                {examLabel(examType)} SPEAKING
              </p>
              <p className="truncate text-xs font-black text-[#52625f]">
                تمرین آزمایشی
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-[#dcebe5] px-3 py-2 text-[11px] font-black text-[#155e57] sm:inline-flex">
              ذخیره نمی‌شود
            </span>
            <button
              type="button"
              onClick={leavePractice}
              disabled={busy}
              className="rounded-xl border border-[#18302d]/15 px-3 py-2 text-xs font-black transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] disabled:cursor-not-allowed disabled:opacity-45 sm:px-4"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <div
        dir="ltr"
        className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-8 sm:py-8 lg:grid-cols-[1.14fr_0.86fr] lg:gap-7"
      >
        <section
          dir="rtl"
          aria-labelledby="recorder-title"
          className="flex min-h-[36rem] min-w-0 flex-col rounded-[1.75rem] border border-[#18302d]/10 bg-[#fffdf8] p-5 shadow-[0_20px_60px_rgba(24,48,45,0.08)] sm:p-8"
        >
          <ol className="grid grid-cols-3 gap-2" aria-label="مراحل تمرین">
            {[
              { active: phase === 'ready', label: 'آماده‌سازی', number: '۱' },
              { active: recordingStep, label: 'ضبط پاسخ', number: '۲' },
              { active: responseStep, label: 'پاسخ ممتحن', number: '۳' },
            ].map((step) => (
              <li
                key={step.number}
                aria-current={step.active ? 'step' : undefined}
                className={`rounded-xl px-2 py-2.5 text-center text-[10px] font-black transition sm:text-xs ${
                  step.active
                    ? 'bg-[#dcebe5] text-[#155e57]'
                    : 'bg-[#f0eee7] text-[#52625f]'
                }`}
              >
                <span className="ml-1 opacity-65">{step.number}</span>
                {step.label}
              </li>
            ))}
          </ol>

          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
            <p className="font-mono text-[10px] tracking-[0.18em] text-[#a14e32]">
              YOUR RESPONSE
            </p>
            <h1
              ref={workspaceHeadingRef}
              id="recorder-title"
              tabIndex={-1}
              className="mt-2 max-w-xl text-2xl font-black outline-none sm:text-3xl"
            >
              {phaseTitle(phase)}
            </h1>

            {phase === 'ready' && (
              <div className="mt-8 flex w-full max-w-md flex-col items-center">
                <button
                  type="button"
                  onClick={startRecording}
                  className="group grid size-28 place-items-center rounded-full bg-[#155e57] text-white shadow-[0_14px_40px_rgba(21,94,87,0.28)] transition hover:-translate-y-1 hover:bg-[#124f49] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#155e57] sm:size-32"
                >
                  <span className="flex flex-col items-center gap-2">
                    <MicrophoneIcon className="size-8" />
                    <span className="text-xs font-black">شروع ضبط پاسخ</span>
                  </span>
                </button>
                <p className="mt-5 text-xs leading-6 text-[#5f6f6b]">
                  ضبط خودکار شروع نمی‌شود؛ برای روشن‌شدن میکروفن دکمه را بزن.
                </p>
              </div>
            )}

            {phase === 'requesting_permission' && (
              <div className="mt-9 flex flex-col items-center text-[#155e57]">
                <span className="grid size-24 place-items-center rounded-full bg-[#dcebe5]">
                  <Spinner />
                </span>
                <p className="mt-5 text-xs leading-6 text-[#5f6f6b]">
                  درخواست دسترسی میکروفن را در مرورگر تأیید کن.
                </p>
              </div>
            )}

            {phase === 'recording' && (
              <div className="mt-8 flex w-full max-w-md flex-col items-center">
                <div className="relative grid size-28 place-items-center rounded-full border-2 border-[#b44b42]/20 bg-[#fff0ed] sm:size-32">
                  <span className="absolute inset-2 animate-ping rounded-full border border-[#b44b42]/25" />
                  <div className="relative">
                    <span className="mx-auto mb-2 block size-3 animate-pulse rounded-full bg-[#b44b42]" />
                    <span
                      role="timer"
                      aria-label={`مدت ضبط ${formatClock(recordingSeconds)}`}
                      dir="ltr"
                      className="font-mono text-xl font-black text-[#8f302c]"
                    >
                      {formatClock(recordingSeconds)}
                    </span>
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-7 flex h-8 items-center gap-1"
                >
                  {[14, 24, 34, 20, 38, 28, 16, 32, 22, 36, 18, 26].map(
                    (height, index) => (
                      <span
                        key={`${height}-${index}`}
                        className="w-1 animate-pulse rounded-full bg-[#b44b42]/65"
                        style={{ height, animationDelay: `${index * 70}ms` }}
                      />
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => stopRecording()}
                  className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#9b3f38] px-6 py-4 text-sm font-black text-white transition hover:bg-[#82342f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9b3f38]"
                >
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-sm bg-white"
                  />
                  توقف ضبط
                </button>
              </div>
            )}

            {phase === 'stopping' && (
              <div className="mt-9 flex flex-col items-center text-[#155e57]">
                <span className="grid size-24 place-items-center rounded-full bg-[#dcebe5]">
                  <Spinner />
                </span>
                <p className="mt-5 text-xs text-[#5f6f6b]">
                  چند لحظه برای آماده‌شدن فایل صبر کن.
                </p>
              </div>
            )}

            {phase === 'review' && preparedAudio && (
              <div className="mt-7 w-full max-w-lg text-right">
                <div className="min-w-0 rounded-2xl border border-[#155e57]/15 bg-[#eef5f2] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#155e57] text-white">
                        <MicrophoneIcon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black">
                          {preparedAudio.label}
                        </p>
                        <p className="mt-1 text-[10px] text-[#5f6f6b]">
                          {preparedAudio.durationSeconds === null
                            ? 'فایل صوتی انتخاب‌شده'
                            : `${formatClock(preparedAudio.durationSeconds)} دقیقه`}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[#155e57]">
                      آمادهٔ ارسال
                    </span>
                  </div>
                  <audio
                    controls
                    src={preparedAudio.previewUrl}
                    aria-label="بازبینی پاسخ ضبط‌شده"
                    className="w-full min-w-0"
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={submitAudio}
                    className="order-1 rounded-2xl bg-[#155e57] px-5 py-4 text-sm font-black text-white transition hover:bg-[#124f49] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#155e57] sm:order-2"
                  >
                    ارسال پاسخ
                  </button>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="order-2 flex items-center justify-center gap-2 rounded-2xl border border-[#18302d]/18 bg-white px-5 py-4 text-sm font-black transition hover:border-[#155e57]/45 hover:bg-[#f7faf8] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#155e57] sm:order-1"
                  >
                    <MicrophoneIcon className="size-5" />
                    ضبط دوباره
                  </button>
                </div>
                <button
                  type="button"
                  onClick={discardPreparedAudio}
                  className="mx-auto mt-4 block rounded-lg px-3 py-2 text-xs font-black text-[#6a5e59] underline decoration-[#6a5e59]/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57]"
                >
                  حذف این ضبط
                </button>
              </div>
            )}

            {phase === 'submitting' && (
              <div className="mt-9 flex w-full max-w-md flex-col items-center">
                <span className="grid size-24 place-items-center rounded-full bg-[#dcebe5] text-[#155e57]">
                  <Spinner />
                </span>
                <p className="mt-5 text-xs leading-6 text-[#5f6f6b]">
                  صدا به‌صورت موقت پردازش می‌شود؛ متن یا فایل آن ذخیره نخواهد
                  شد.
                </p>
              </div>
            )}

            {phase === 'response_ready' && speechUrl && (
              <div className="mt-7 w-full max-w-lg text-right">
                <div className="min-w-0 rounded-2xl bg-[#18302d] p-5 text-white shadow-[0_16px_45px_rgba(24,48,45,0.15)]">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-[#dcebe5]">
                      <HeadphonesIcon className="size-6" />
                    </span>
                    <div>
                      <p className="text-sm font-black">پاسخ صوتی ممتحن</p>
                      <p className="mt-1 text-[10px] text-[#a8b8b4]">
                        برای شنیدن، دکمهٔ پخش را بزن.
                      </p>
                    </div>
                  </div>
                  <audio
                    aria-label="پاسخ صوتی ممتحن"
                    controls
                    src={speechUrl}
                    onError={() =>
                      setError('پخش پاسخ صوتی ناموفق بود؛ دوباره تلاش کنید.')
                    }
                    className="w-full min-w-0"
                  />
                  <p className="mt-4 text-[10px] leading-5 text-[#9fb1ad]">
                    این صدا با هوش مصنوعی تولید شده است. هیچ رونوشتی نمایش داده
                    یا ذخیره نمی‌شود.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={finishPractice}
                  className="mt-4 w-full rounded-2xl border border-[#18302d]/18 bg-white px-5 py-4 text-sm font-black transition hover:border-[#155e57]/45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#155e57]"
                >
                  پایان تمرین
                </button>
              </div>
            )}

            {phase === 'completed' && (
              <div className="mt-8 flex w-full max-w-md flex-col items-center">
                <span className="grid size-24 place-items-center rounded-full bg-[#dcebe5] text-3xl text-[#155e57]">
                  ✓
                </span>
                <p className="mt-5 text-xs leading-6 text-[#5f6f6b]">
                  تمرین بسته شد و هیچ فایل صوتی یا متنی ذخیره نشد.
                </p>
                <button
                  type="button"
                  onClick={startAnotherPractice}
                  className="mt-6 w-full rounded-2xl bg-[#155e57] px-5 py-4 text-sm font-black text-white transition hover:bg-[#124f49] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#155e57]"
                >
                  شروع تمرین جدید
                </button>
              </div>
            )}
          </div>

          {(phase === 'ready' || phase === 'review') && (
            <details className="rounded-2xl border border-[#18302d]/10 bg-[#f6f4ed] px-4 py-3 text-xs text-[#52625f] open:pb-4">
              <summary className="cursor-pointer font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57]">
                میکروفن در دسترس نیست؟
              </summary>
              <div className="mt-3 border-t border-[#18302d]/10 pt-3">
                <p className="mb-3 leading-6">
                  فقط برای ادامهٔ تمرین می‌توانی فایل صوتی آماده بارگذاری کنی.
                </p>
                <label className="block cursor-pointer rounded-xl border border-dashed border-[#155e57]/35 bg-white p-3 text-center font-black text-[#155e57] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#155e57] hover:bg-[#eef5f2]">
                  انتخاب فایل صوتی
                  <input
                    ref={fileInputRef}
                    type="file"
                    aria-label="انتخاب فایل صوتی"
                    accept={acceptedAudioFormats}
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
              </div>
            </details>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-[#b44b42]/15 bg-[#fff0ed] p-4 text-xs leading-6 font-bold text-[#842f2b]"
            >
              {error}
            </div>
          )}
        </section>

        <ExaminerStage phase={phase} />
      </div>

      <footer className="mx-auto max-w-6xl px-5 pb-7 text-center text-[11px] leading-6 text-[#5f6f6b] sm:px-8">
        صدای شما فقط برای ساخت پاسخ صوتی پردازش می‌شود و در پایگاه دادهٔ آتنا
        ذخیره نخواهد شد.
      </footer>
    </main>
  )
}
