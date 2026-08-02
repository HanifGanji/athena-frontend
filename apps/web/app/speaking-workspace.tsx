'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import {
  type SpeakingExamType,
  type SpeakingSession,
  type SpeakingTurn,
  speakingApi,
} from '@/lib/speaking-api'

const acceptedAudioFormats = '.flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm'

type PreparedAudio = {
  blob: Blob
  filename: string
  label: string
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}

function recordingFilename(mimeType: string) {
  if (mimeType.includes('mp4')) return 'speaking-recording.mp4'
  if (mimeType.includes('ogg')) return 'speaking-recording.ogg'
  return 'speaking-recording.webm'
}

function examLabel(examType: SpeakingExamType) {
  return examType === 'ielts' ? 'IELTS' : 'TOEFL'
}

export function SpeakingWorkspace() {
  const [examType, setExamType] = useState<SpeakingExamType>('ielts')
  const [session, setSession] = useState<SpeakingSession | null>(null)
  const [turns, setTurns] = useState<SpeakingTurn[]>([])
  const [preparedAudio, setPreparedAudio] = useState<PreparedAudio | null>(null)
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [speechUrl, setSpeechUrl] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardRecordingRef = useRef(false)
  const speechUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function replaceSpeechUrl(nextUrl: string | null) {
    if (speechUrlRef.current) URL.revokeObjectURL(speechUrlRef.current)
    speechUrlRef.current = nextUrl
    setSpeechUrl(nextUrl)
  }

  useEffect(
    () => () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (speechUrlRef.current) URL.revokeObjectURL(speechUrlRef.current)
    },
    [],
  )

  async function startSession() {
    setStarting(true)
    setSessionError(null)
    try {
      const nextSession = await speakingApi.startSession(examType)
      setSession(nextSession)
      setTurns(nextSession.turns ?? [])
    } catch (reason) {
      setSessionError(errorMessage(reason, 'شروع جلسه ناموفق بود.'))
    } finally {
      setStarting(false)
    }
  }

  async function startRecording() {
    setRecordingError(null)
    setUploadError(null)
    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setRecordingError(
        'ضبط صدا در این مرورگر در دسترس نیست؛ یک فایل صوتی انتخاب کنید.',
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
        if (!discardRecordingRef.current && chunks.length > 0) {
          setPreparedAudio({
            blob: new Blob(chunks, { type: mimeType }),
            filename: recordingFilename(mimeType),
            label: 'ضبط آمادهٔ ارسال است.',
          })
        } else if (!discardRecordingRef.current) {
          setRecordingError('صدایی ضبط نشد؛ دوباره تلاش کنید.')
        }
        chunksRef.current = []
        recorderRef.current = null
        stopTracks()
      }

      recorder.start()
      setPreparedAudio(null)
      setRecording(true)
    } catch (reason) {
      stopTracks()
      recorderRef.current = null
      chunksRef.current = []
      const denied =
        reason instanceof DOMException && reason.name === 'NotAllowedError'
      setRecordingError(
        denied
          ? 'اجازهٔ دسترسی به میکروفن داده نشد. دسترسی را فعال کنید یا فایل صوتی انتخاب کنید.'
          : 'میکروفن آماده نشد؛ اتصال آن را بررسی کنید یا فایل صوتی انتخاب کنید.',
      )
    }
  }

  function stopRecording(discard = false) {
    const recorder = recorderRef.current
    discardRecordingRef.current = discard
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else stopTracks()
    setRecording(false)
  }

  function chooseFile(file: File | undefined) {
    if (!file) return
    setRecordingError(null)
    setUploadError(null)
    setPreparedAudio({ blob: file, filename: file.name, label: file.name })
  }

  async function submitAudio() {
    if (!session || !preparedAudio) return
    setSubmitting(true)
    setUploadError(null)
    setPlaybackError(null)
    replaceSpeechUrl(null)

    try {
      const result = await speakingApi.submitAudio(
        session.id,
        preparedAudio.blob,
        preparedAudio.filename,
      )
      const nextTurns = [...turns, ...result.turns].sort(
        (left, right) => left.sequence - right.sequence,
      )
      setTurns(nextTurns)
      setPreparedAudio(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      const examinerTurn = result.turns.find((turn) => turn.role === 'examiner')
      if (!examinerTurn) {
        setPlaybackError('متن ثبت شد، اما پاسخ ممتحن برای پخش آماده نشد.')
        return
      }

      // The transcript is already durable; speech is a separate retryable request.
      try {
        const speech = await speakingApi.synthesizeTurn(
          session.id,
          examinerTurn.id,
        )
        replaceSpeechUrl(URL.createObjectURL(speech))
      } catch (reason) {
        setPlaybackError(
          `متن ثبت شد، اما ساخت صدای ممتحن ناموفق بود: ${errorMessage(
            reason,
            'خطای ناشناخته',
          )}`,
        )
      }
    } catch (reason) {
      setUploadError(
        errorMessage(reason, 'ارسال یا تبدیل صدا به متن ناموفق بود.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function completeSession() {
    if (!session) return
    setCompleting(true)
    setSessionError(null)
    if (recording) stopRecording(true)
    setPreparedAudio(null)

    try {
      const completed = await speakingApi.completeSession(session.id)
      setSession({ ...session, ...completed, status: 'completed' })
      if (completed.turns) setTurns(completed.turns)
    } catch (reason) {
      setSessionError(errorMessage(reason, 'پایان جلسه ثبت نشد.'))
    } finally {
      setCompleting(false)
    }
  }

  const active = session?.status === 'in_progress'

  return (
    <main className="min-h-svh bg-[#f4f1e8] text-[#18302d]">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="flex items-center justify-between border-b border-[#18302d]/15 pb-5">
          <Link href="/" aria-label="بازگشت به صفحهٔ اصلی">
            <p className="font-mono text-[10px] tracking-[0.25em] text-[#a14e32]">
              ATHENA · SPEAKING LAB
            </p>
            <p className="mt-1 text-2xl font-black">آتنا</p>
          </Link>
          <span className="rounded-full border border-[#155e57]/25 bg-white/60 px-4 py-2 text-xs font-bold text-[#155e57]">
            نسخهٔ آزمایشی
          </span>
        </header>

        <section className="grid gap-8 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-20">
          <div>
            <p className="mb-4 text-sm font-bold text-[#a14e32]">
              آزمایشگاه Speaking
            </p>
            <h1 className="text-5xl leading-[1.15] font-black tracking-[-0.04em] sm:text-7xl">
              صدایت را ضبط کن؛
              <span className="block text-[#155e57]">متنت را ببین.</span>
            </h1>
          </div>
          <p className="text-sm leading-8 text-[#52625f] sm:text-base">
            یک پاسخ کوتاه انگلیسی ضبط یا بارگذاری کن. این نسخه فقط تبدیل صدا به
            متن و پاسخ ثابت ممتحن را آزمایش می‌کند و هنوز ارزیابی یا نمره‌ای
            ارائه نمی‌دهد.
          </p>
        </section>

        {!session ? (
          <section className="rounded-[2rem] border border-[#18302d]/12 bg-[#fffdf8] p-6 shadow-[0_16px_50px_rgba(24,48,45,0.06)] sm:p-8">
            <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="grid gap-2 text-sm font-black">
                نوع آزمون
                <select
                  value={examType}
                  onChange={(event) =>
                    setExamType(event.target.value as SpeakingExamType)
                  }
                  className="rounded-2xl border border-[#18302d]/20 bg-white px-4 py-3 text-[#18302d] outline-none focus:border-[#155e57]"
                >
                  <option value="ielts">IELTS</option>
                  <option value="toefl">TOEFL</option>
                </select>
              </label>
              <button
                type="button"
                onClick={startSession}
                disabled={starting}
                className="rounded-2xl bg-[#155e57] px-7 py-3.5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
              >
                {starting ? 'در حال شروع…' : 'شروع جلسه'}
              </button>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[2rem] border border-[#18302d]/12 bg-[#fffdf8] p-6 shadow-[0_16px_50px_rgba(24,48,45,0.06)] sm:p-8">
              <div className="mb-7 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.18em] text-[#a14e32]">
                    {examLabel(session.exam_type)} · SESSION
                  </p>
                  <h2 className="mt-1 text-xl font-black">پاسخ تازه</h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    active
                      ? 'bg-[#dcebe5] text-[#155e57]'
                      : 'bg-[#ece8dc] text-[#59635f]'
                  }`}
                >
                  {active ? 'در حال اجرا' : 'پایان‌یافته'}
                </span>
              </div>

              {active ? (
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={recording ? () => stopRecording() : startRecording}
                    className={`w-full rounded-2xl px-6 py-4 text-sm font-black text-white transition ${
                      recording
                        ? 'bg-[#a14e32]'
                        : 'bg-[#18302d] hover:bg-[#155e57]'
                    }`}
                  >
                    {recording ? 'توقف ضبط' : 'شروع ضبط'}
                  </button>

                  <div className="flex items-center gap-3 text-xs text-[#77817e]">
                    <span className="h-px flex-1 bg-[#18302d]/12" />
                    یا فایل صوتی
                    <span className="h-px flex-1 bg-[#18302d]/12" />
                  </div>

                  <label className="block cursor-pointer rounded-2xl border border-dashed border-[#155e57]/35 bg-[#dcebe5]/35 p-4 text-center text-sm font-bold text-[#155e57] hover:bg-[#dcebe5]/60">
                    انتخاب فایل صوتی
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={acceptedAudioFormats}
                      onChange={(event) => chooseFile(event.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>

                  {preparedAudio && (
                    <p className="rounded-xl bg-[#ece8dc] px-4 py-3 text-xs font-bold text-[#59635f]">
                      {preparedAudio.label}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={submitAudio}
                    disabled={!preparedAudio || recording || submitting}
                    className="w-full rounded-2xl bg-[#e57d55] px-6 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {submitting
                      ? 'در حال تبدیل صدا به متن…'
                      : 'ارسال و تبدیل به متن'}
                  </button>
                </div>
              ) : (
                <p className="rounded-2xl bg-[#ece8dc] p-5 text-sm leading-7 text-[#59635f]">
                  این جلسه کامل شده و پاسخ تازه‌ای نمی‌پذیرد.
                </p>
              )}

              <button
                type="button"
                onClick={completeSession}
                disabled={!active || completing}
                className="mt-7 w-full rounded-2xl border border-[#18302d]/20 px-6 py-3 text-sm font-black disabled:opacity-45"
              >
                {completing ? 'در حال ثبت…' : 'پایان جلسه'}
              </button>
            </section>

            <section
              aria-labelledby="transcript-title"
              className="rounded-[2rem] bg-[#18302d] p-6 text-white shadow-[0_20px_60px_rgba(24,48,45,0.16)] sm:p-8"
            >
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.18em] text-[#f0ac87]">
                    DURABLE TEXT RECORD
                  </p>
                  <h2 id="transcript-title" className="mt-1 text-xl font-black">
                    متن جلسه
                  </h2>
                </div>
                <span className="font-mono text-xs text-[#a8b8b4]">
                  {turns.length.toString().padStart(2, '0')} TURNS
                </span>
              </div>

              {turns.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm leading-7 text-[#a8b8b4]">
                  بعد از ارسال صدا، متن پاسخ تو و ممتحن اینجا نمایش داده می‌شود.
                </p>
              ) : (
                <ol className="space-y-4">
                  {turns.map((turn) => (
                    <li
                      key={turn.id}
                      className={`rounded-2xl p-4 ${
                        turn.role === 'learner'
                          ? 'bg-white/8'
                          : 'bg-[#dcebe5] text-[#18302d]'
                      }`}
                    >
                      <p className="mb-2 text-[10px] font-black tracking-[0.15em] opacity-65">
                        {turn.role === 'learner' ? 'YOU' : 'AI EXAMINER'} ·{' '}
                        {turn.sequence.toString().padStart(2, '0')}
                      </p>
                      <p dir="ltr" className="text-left text-sm leading-7">
                        {turn.text}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {speechUrl && (
                <div className="mt-6 rounded-2xl bg-white/8 p-4">
                  <p className="mb-3 text-xs font-bold text-[#dcebe5]">
                    پاسخ صوتی ممتحن
                  </p>
                  <audio
                    aria-label="پاسخ صوتی ممتحن"
                    controls
                    src={speechUrl}
                    onError={() =>
                      setPlaybackError(
                        'پخش صدا ناموفق بود؛ دوباره پاسخ را ارسال کنید.',
                      )
                    }
                    className="w-full"
                  />
                  <p className="mt-3 text-[11px] leading-5 text-[#a8b8b4]">
                    این صدا با هوش مصنوعی تولید شده است.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        {(sessionError || recordingError || uploadError || playbackError) && (
          <div
            role="alert"
            className="mt-6 rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-800"
          >
            {sessionError ?? recordingError ?? uploadError ?? playbackError}
          </div>
        )}

        <p className="mt-7 text-xs leading-6 text-[#6f7f7b]">
          فایل صوتی فقط برای پردازش ارسال می‌شود؛ متن گفتگو رکورد ماندگار این
          نسخه است. این مسیر آزمایشی پیش از استفادهٔ عمومی به احراز هویت و
          محدودیت درخواست نیاز دارد.
        </p>
      </div>
    </main>
  )
}
