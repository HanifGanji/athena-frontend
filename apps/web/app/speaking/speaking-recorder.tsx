'use client'

import { useEffect, useRef } from 'react'

import type { SpeakingTurn } from '@/lib/speaking-api'

import type { SpeakingPhase } from './speaking-machine'
import type { SpeakingPhaseView } from './speaking-machine'
import { MicrophoneIcon, Spinner, StopIcon, UploadIcon } from './speaking-icons'
import { formatDuration } from './speaking-transcript'
import { useSpeakingRecorder } from './use-speaking-recorder'

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
  replacement: boolean
  view: SpeakingPhaseView
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
  replacement,
  view,
}: SpeakingRecorderProps) {
  const errorRef = useRef<HTMLDivElement | null>(null)
  const { chooseFile, elapsedMs, fileInputRef, startRecording, stopRecording } =
    useSpeakingRecorder({
      onError,
      onPhase,
      onPrepared,
      recorderMode: view.recorderMode,
    })

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

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
      className="sticky bottom-0 z-20 rounded-t-2xl border border-[var(--athena-border)] bg-[var(--athena-surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_36px_rgb(24_48_45/0.14)] sm:rounded-2xl lg:p-6"
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
                  : replacement
                    ? 'پاسخ جایگزین را ضبط کن'
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
        <div className="grid grid-cols-[1fr_auto] gap-2 lg:mt-6 lg:gap-3">
          <button
            type="button"
            onClick={startRecording}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--athena-teal)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#155e57]/15 transition hover:bg-[#104b46] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] lg:min-h-14 lg:gap-3 lg:rounded-2xl lg:px-6 lg:py-4"
          >
            <MicrophoneIcon className="size-5 lg:size-6" />
            {replacement ? 'ضبط پاسخ جایگزین' : 'شروع ضبط پاسخ'}
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
        <div className="lg:mt-6">
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
        <div className="lg:mt-6">
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
          <div className="mt-2 grid grid-cols-2 gap-2 lg:mt-4 lg:gap-3">
            <button
              type="button"
              onClick={onSubmit}
              className="min-h-12 rounded-xl bg-[var(--athena-teal)] px-4 py-3 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] lg:rounded-2xl lg:px-5"
            >
              {replacement ? 'ثبت پاسخ جایگزین' : 'ثبت این پاسخ'}
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
