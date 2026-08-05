'use client'

import { useEffect, useRef, useState } from 'react'

import type { SpeakingTurn } from '@/lib/speaking-api'

import type { SpeakingPhase } from './speaking-machine'
import type { SpeakingPhaseView } from './speaking-machine'
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
  answerCommitted: boolean
  error: string | null
  longWait: boolean
  onDiscard: () => void
  onError: (message: string) => void
  onPhase: (phase: SpeakingPhase) => void
  onPrepared: (take: PreparedTake) => void
  onSubmit: () => void
  prepared: PreparedTake | null
  prompt: SpeakingTurn | null
  view: SpeakingPhaseView
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
  answerCommitted,
  error,
  longWait,
  onDiscard,
  onError,
  onPhase,
  onPrepared,
  onSubmit,
  prepared,
  prompt,
  view,
}: SpeakingRecorderProps) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const discardRef = useRef(false)
  const errorRef = useRef<HTMLDivElement | null>(null)
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
    if (error) errorRef.current?.focus()
  }, [error])

  useEffect(() => {
    if (view.recorderMode !== 'recording') return
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
  }, [view.recorderMode])

  async function startRecording() {
    if (!['ready', 'review', 'error'].includes(view.recorderMode)) {
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

  const reviewVisible = prepared && (view.showPreparedTake || answerCommitted)
  const waiting = [
    'permission',
    'preparing_take',
    'submitting',
    'waiting_next',
  ].includes(view.recorderMode)
  const recorderReady = view.recorderMode === 'ready'
  const suggested = prompt?.suggested_duration_ms ?? 0
  const canEditTake =
    !answerCommitted && ['review', 'error'].includes(view.recorderMode)

  return (
    <section
      aria-labelledby="recorder-title"
      className="rounded-t-[1.4rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] p-3 shadow-[0_-12px_40px_rgba(24,48,45,0.12)] lg:rounded-[1.75rem] lg:p-7 lg:shadow-[0_18px_55px_rgba(24,48,45,0.07)]"
    >
      <h2 id="recorder-title" className="sr-only">
        کنترل پاسخ
      </h2>
      <div className="hidden flex-wrap items-start justify-between gap-3 lg:flex">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--athena-rust)]">
            YOUR RESPONSE
          </p>
          <h2 className="mt-1 text-xl font-black">
            {view.recorderMode === 'recording'
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
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-800 outline-none lg:mt-5 lg:mb-0 lg:rounded-2xl"
        >
          {error}
        </div>
      )}

      {recorderReady && (
        <div className="sticky bottom-0 z-20 -mx-3 -mb-3 grid grid-cols-[1fr_auto] gap-2 border-t border-[var(--athena-border)] bg-[var(--athena-paper)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(24,48,45,0.12)] lg:static lg:mx-0 lg:mb-0 lg:mt-7 lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <button
            type="button"
            onClick={startRecording}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--athena-teal)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#155e57]/15 transition hover:bg-[#104b46] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] lg:min-h-14 lg:gap-3 lg:rounded-2xl lg:px-6 lg:py-4"
          >
            <MicrophoneIcon className="size-5 lg:size-6" />
            شروع ضبط پاسخ
          </button>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--athena-border-strong)] bg-white px-4 py-3 text-sm font-black transition hover:border-[var(--athena-teal)] hover:bg-[var(--athena-mint)] focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-[var(--athena-teal)] lg:min-h-14 lg:rounded-2xl lg:px-5 lg:py-4">
            <UploadIcon className="size-5" />
            <span className="sr-only sm:not-sr-only">فایل صوتی</span>
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

      {view.recorderMode === 'recording' && (
        <div className="sticky bottom-0 z-20 -mx-3 -mb-3 border-t border-[var(--athena-border)] bg-[var(--athena-paper)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(24,48,45,0.12)] lg:static lg:mx-0 lg:mb-0 lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#fff0ed] px-4 py-3 text-[#8f302c] lg:rounded-2xl lg:px-5 lg:py-4">
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
          <p className="mt-3 hidden text-xs leading-6 text-[var(--athena-muted)] lg:block">
            زمان فقط برای مقایسه است؛ ضبط خودکار متوقف نمی‌شود و هیچ جریمه‌ای
            ندارد.
          </p>
          <button
            type="button"
            onClick={() => stopRecording()}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#9b3f38] px-5 py-3 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#9b3f38] lg:mt-4 lg:rounded-2xl"
          >
            <StopIcon className="size-5" />
            توقف ضبط
          </button>
        </div>
      )}

      {reviewVisible && prepared && (
        <div className="lg:mt-6">
          <div className="rounded-xl border border-[var(--athena-border-strong)] bg-[var(--athena-mint)] p-3 lg:rounded-2xl lg:p-4">
            <div className="mb-2 flex items-center justify-between gap-3 lg:mb-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{prepared.label}</p>
                <p className="mt-1 hidden text-[10px] text-[var(--athena-muted)] sm:block">
                  مدت ثبت‌شده:{' '}
                  <span dir="ltr">{formatDuration(prepared.durationMs)}</span>
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[var(--athena-teal)]">
                {answerCommitted
                  ? 'پاسخ ثبت شد'
                  : view.recorderMode === 'submitting'
                    ? 'در حال ثبت'
                    : 'هنوز ارسال نشده'}
              </span>
            </div>
            <audio
              controls
              src={prepared.previewUrl}
              aria-label="بازبینی پاسخ ضبط‌شده"
              className="w-full min-w-0"
            />
          </div>
          {longWait && (
            <p className="mt-2 text-center text-xs font-black text-[var(--athena-teal)]">
              {answerCommitted
                ? 'پاسخ شما ثبت شده است.'
                : 'ضبط شما روی این دستگاه محفوظ است.'}
            </p>
          )}
        </div>
      )}

      {waiting && (
        <div className="sticky bottom-0 z-20 -mx-3 -mb-3 border-t border-[var(--athena-border)] bg-[var(--athena-paper)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(24,48,45,0.12)] lg:static lg:mx-0 lg:mb-0 lg:mt-7 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex min-h-16 items-center justify-center gap-3 rounded-xl bg-[var(--athena-mint)] px-4 py-3 text-center text-[var(--athena-teal)] lg:min-h-28 lg:flex-col lg:rounded-2xl">
            <Spinner className="size-5 lg:size-6" />
            <p className="text-xs font-bold lg:mt-1">
              {view.recorderMode === 'permission'
                ? 'صدا برای تبدیل به متن ارسال می‌شود؛ در سابقه فقط متن پاسخ نگه‌داری می‌شود.'
                : (view.primaryStatus ?? 'در حال آماده‌سازی فایل صوتی…')}
            </p>
          </div>
        </div>
      )}

      {canEditTake && (
        <>
          <div className="sticky bottom-0 z-20 -mx-3 -mb-3 mt-2 grid grid-cols-2 gap-2 border-t border-[var(--athena-border)] bg-[var(--athena-paper)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(24,48,45,0.12)] lg:static lg:mx-0 lg:mb-0 lg:mt-4 lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <button
              type="button"
              onClick={onSubmit}
              className="min-h-12 rounded-xl bg-[var(--athena-teal)] px-4 py-3 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] lg:rounded-2xl lg:px-5"
            >
              ثبت این پاسخ
            </button>
            <button
              type="button"
              onClick={startRecording}
              className="min-h-12 rounded-xl border border-[var(--athena-border-strong)] bg-white px-4 py-3 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] lg:rounded-2xl lg:px-5"
            >
              ضبط دوباره
            </button>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            className="mx-auto mt-1 hidden min-h-11 rounded-lg px-3 py-2 text-xs font-black text-[var(--athena-muted)] underline decoration-current/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--athena-teal)] lg:block"
          >
            حذف این برداشت
          </button>
        </>
      )}
    </section>
  )
}
