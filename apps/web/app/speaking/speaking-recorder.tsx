'use client'

import { useEffect, useRef, useState } from 'react'

import type { SpeakingTurn } from '@/lib/speaking-api'

import type { SpeakingPhase } from './speaking-machine'
import { MicrophoneIcon, Spinner, StopIcon, UploadIcon } from './speaking-icons'
import { formatDuration } from './speaking-transcript'

const acceptedAudioFormats = '.flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm'

export type PreparedTake = {
  blob: Blob
  clientEventId: string
  durationMs: number
  filename: string
  label: string
  previewUrl: string
}

type SpeakingRecorderProps = {
  error: string | null
  onDiscard: () => void
  onError: (message: string) => void
  onPhase: (phase: SpeakingPhase) => void
  onPrepared: (take: PreparedTake) => void
  onSubmit: () => void
  phase: SpeakingPhase
  prepared: PreparedTake | null
  prompt: SpeakingTurn | null
}

function recordingFilename(mimeType: string) {
  if (mimeType.includes('mp4')) return 'athena-speaking.mp4'
  if (mimeType.includes('ogg')) return 'athena-speaking.ogg'
  return 'athena-speaking.webm'
}

function metadataDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file)
    const audio = new Audio()
    const cleanup = () => {
      audio.removeAttribute('src')
      URL.revokeObjectURL(previewUrl)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration * 1000)
      cleanup()
      if (Number.isFinite(duration) && duration >= 250) resolve(duration)
      else reject(new Error('invalid duration'))
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('metadata unavailable'))
    }
    audio.src = previewUrl
  })
}

export function SpeakingRecorder({
  error,
  onDiscard,
  onError,
  onPhase,
  onPrepared,
  onSubmit,
  phase,
  prepared,
  prompt,
}: SpeakingRecorderProps) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const discardRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
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
      }
      stopTracks()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'recording') return
    const update = () => {
      if (startedAtRef.current !== null) {
        setElapsedMs(
          Math.max(0, Math.round(performance.now() - startedAtRef.current)),
        )
      }
    }
    update()
    const interval = window.setInterval(update, 200)
    return () => window.clearInterval(interval)
  }, [phase])

  async function startRecording() {
    if (
      !['ready_to_record', 'local_review', 'recoverable_error'].includes(phase)
    ) {
      return
    }
    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      onError(
        'ضبط مستقیم در این مرورگر در دسترس نیست. یک فایل صوتی انتخاب کنید.',
      )
      return
    }

    onPhase('requesting_permission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const recorder = new MediaRecorder(stream)
      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      discardRef.current = false
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const durationMs = Math.max(
          250,
          Math.round(
            performance.now() - (startedAtRef.current ?? performance.now()),
          ),
        )
        const mimeType =
          recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm'
        if (
          mountedRef.current &&
          !discardRef.current &&
          chunksRef.current.length
        ) {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          onPrepared({
            blob,
            clientEventId: crypto.randomUUID(),
            durationMs,
            filename: recordingFilename(mimeType),
            label: 'پاسخ ضبط‌شده',
            previewUrl: URL.createObjectURL(blob),
          })
          onPhase('local_review')
        } else if (mountedRef.current && !discardRef.current) {
          onError('صدایی ضبط نشد. دوباره تلاش کنید یا فایل صوتی انتخاب کنید.')
        }
        chunksRef.current = []
        startedAtRef.current = null
        recorderRef.current = null
        stopTracks()
      }
      recorder.start()
      startedAtRef.current = performance.now()
      setElapsedMs(0)
      onPhase('recording')
    } catch (reason) {
      stopTracks()
      recorderRef.current = null
      startedAtRef.current = null
      const denied =
        reason instanceof DOMException && reason.name === 'NotAllowedError'
      onError(
        denied
          ? 'اجازهٔ میکروفن داده نشد. دسترسی مرورگر را فعال کنید یا فایل صوتی انتخاب کنید.'
          : 'میکروفن آماده نشد. اتصال دستگاه را بررسی کنید یا فایل صوتی انتخاب کنید.',
      )
    }
  }

  function stopRecording(discard = false) {
    discardRef.current = discard
    onPhase('stopping_recording')
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else {
      stopTracks()
      onPhase(discard ? 'ready_to_record' : 'recoverable_error')
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return
    onPhase('stopping_recording')
    try {
      const durationMs = await metadataDuration(file)
      if (!mountedRef.current) return
      onPrepared({
        blob: file,
        clientEventId: crypto.randomUUID(),
        durationMs,
        filename: file.name,
        label: file.name,
        previewUrl: URL.createObjectURL(file),
      })
      onPhase('local_review')
    } catch {
      if (mountedRef.current) {
        onError(
          'مدت فایل صوتی خوانده نشد. فایل دیگری انتخاب کنید یا پاسخ را ضبط کنید.',
        )
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const reviewVisible =
    prepared && ['local_review', 'recoverable_error'].includes(phase)
  const waiting = [
    'requesting_permission',
    'stopping_recording',
    'submitting',
  ].includes(phase)
  const recorderReady = phase === 'ready_to_record'
  const suggested = prompt?.suggested_duration_ms ?? 0

  return (
    <section
      aria-labelledby="recorder-title"
      className="rounded-[1.75rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] p-5 shadow-[0_18px_55px_rgba(24,48,45,0.07)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--athena-rust)]">
            YOUR RESPONSE
          </p>
          <h2 id="recorder-title" className="mt-1 text-xl font-black">
            {phase === 'recording'
              ? 'آزادانه صحبت کن'
              : reviewVisible
                ? 'پاسخت را بررسی کن'
                : waiting
                  ? 'چند لحظه صبر کن'
                  : 'نوبت پاسخ توست'}
          </h2>
        </div>
        {prompt?.suggested_duration_ms && (
          <span className="rounded-full bg-[var(--athena-sand)] px-3 py-2 text-[10px] font-black text-[var(--athena-muted)]">
            پیشنهاد <span dir="ltr">{formatDuration(suggested)}</span>
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-800"
        >
          {error}
        </div>
      )}

      {recorderReady && (
        <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={startRecording}
            className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[var(--athena-teal)] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#155e57]/15 transition hover:-translate-y-0.5 hover:bg-[#104b46] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] motion-reduce:transform-none"
          >
            <MicrophoneIcon className="size-6" />
            شروع ضبط پاسخ
          </button>
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--athena-border-strong)] bg-white px-5 py-4 text-sm font-black transition hover:border-[var(--athena-teal)] hover:bg-[var(--athena-mint)] focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-[var(--athena-teal)]">
            <UploadIcon className="size-5" />
            فایل صوتی
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedAudioFormats}
              aria-label="انتخاب فایل صوتی"
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {phase === 'recording' && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#fff0ed] px-5 py-4 text-[#8f302c]">
            <span className="flex items-center gap-2 text-sm font-black">
              <span className="size-3 animate-pulse rounded-full bg-[#b44b42] motion-reduce:animate-none" />
              در حال ضبط
            </span>
            <span
              role="timer"
              aria-label={`مدت ضبط ${formatDuration(elapsedMs)}`}
              dir="ltr"
              className="font-mono text-xl font-black"
            >
              {formatDuration(elapsedMs)} / {formatDuration(suggested)}
            </span>
          </div>
          <p className="mt-3 text-xs leading-6 text-[var(--athena-muted)]">
            زمان فقط برای مقایسه است؛ ضبط خودکار متوقف نمی‌شود و هیچ جریمه‌ای
            ندارد.
          </p>
          <button
            type="button"
            onClick={() => stopRecording()}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#9b3f38] px-5 py-3 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#9b3f38]"
          >
            <StopIcon className="size-5" />
            توقف ضبط
          </button>
        </div>
      )}

      {waiting && (
        <div className="mt-7 flex min-h-28 flex-col items-center justify-center rounded-2xl bg-[var(--athena-mint)] text-center text-[var(--athena-teal)]">
          <Spinner className="size-6" />
          <p className="mt-3 text-xs font-bold">
            {phase === 'submitting'
              ? 'صدا موقتاً پردازش و متن انگلیسی ثبت می‌شود.'
              : phase === 'requesting_permission'
                ? 'درخواست مرورگر برای میکروفن را بررسی کن.'
                : 'در حال آماده‌سازی فایل صوتی…'}
          </p>
        </div>
      )}

      {reviewVisible && prepared && (
        <div className="mt-6">
          <div className="rounded-2xl border border-[var(--athena-border-strong)] bg-[var(--athena-mint)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{prepared.label}</p>
                <p className="mt-1 text-[10px] text-[var(--athena-muted)]">
                  مدت ثبت‌شده:{' '}
                  <span dir="ltr">{formatDuration(prepared.durationMs)}</span>
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[var(--athena-teal)]">
                هنوز ارسال نشده
              </span>
            </div>
            <audio
              controls
              src={prepared.previewUrl}
              aria-label="بازبینی پاسخ ضبط‌شده"
              className="w-full min-w-0"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onSubmit}
              className="min-h-12 rounded-2xl bg-[var(--athena-teal)] px-5 py-3 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)]"
            >
              ثبت این پاسخ
            </button>
            <button
              type="button"
              onClick={startRecording}
              className="min-h-12 rounded-2xl border border-[var(--athena-border-strong)] bg-white px-5 py-3 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)]"
            >
              ضبط دوباره
            </button>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            className="mx-auto mt-3 block min-h-11 rounded-lg px-3 py-2 text-xs font-black text-[var(--athena-muted)] underline decoration-current/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--athena-teal)]"
          >
            حذف این برداشت
          </button>
        </div>
      )}
    </section>
  )
}
