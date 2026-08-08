'use client'

import { useEffect, useRef } from 'react'

import type { SpeakingSession, SpeakingTurn } from '@/lib/speaking-api'

import { HeadphonesIcon, PauseIcon, PlayIcon, Spinner } from './speaking-icons'
import type { SpeakingPhaseView } from './speaking-machine'
import { formatDuration, stageLabel } from './speaking-transcript'

type SpeakingExaminerProps = {
  onPause: () => void
  onPlay: () => void
  playbackState: 'not_started' | 'playing' | 'paused' | 'ended'
  prompt: SpeakingTurn | null
  session: SpeakingSession
  speechUrl: string | null
  view: SpeakingPhaseView
}

export function SpeakingExaminer({
  onPause,
  onPlay,
  playbackState,
  prompt,
  session,
  speechUrl,
  view,
}: SpeakingExaminerProps) {
  const promptRegionRef = useRef<HTMLDivElement | null>(null)
  const loading = view.examinerMode === 'loading'
  const playing = view.examinerMode === 'playing'
  const canPlay = Boolean(speechUrl) && !playing
  const repeatHidden = prompt?.kind === 'repeat_sentence' && prompt.is_hidden

  useEffect(() => {
    if (prompt && speechUrl) promptRegionRef.current?.focus()
  }, [prompt, speechUrl])

  return (
    <section
      aria-labelledby="examiner-stage-title"
      className="relative overflow-hidden rounded-2xl bg-[var(--athena-ink)] p-5 text-white shadow-[0_18px_48px_rgb(24_48_45/0.16)] sm:p-7"
    >
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.12em] text-[var(--athena-coral)]">
              {prompt ? stageLabel(prompt.stage) : 'SPEAKING SESSION'}
            </p>
            <h2 id="examiner-stage-title" className="mt-2 text-xl font-bold">
              ممتحن آتنا
            </h2>
          </div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 text-xs font-semibold text-[#dcebe5]">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${
                playing
                  ? 'animate-pulse bg-[#78d7c9] motion-reduce:animate-none'
                  : 'bg-white/40'
              }`}
            />
            {view.examinerStatus}
          </span>
        </div>

        <div className="grid min-h-[13rem] place-items-center py-6 text-center sm:min-h-[17rem] sm:py-8">
          <div
            ref={promptRegionRef}
            tabIndex={-1}
            className="w-full max-w-2xl rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--athena-ink)]"
          >
            <div className="mx-auto grid size-16 place-items-center rounded-full border border-white/15 bg-white/10 sm:size-24">
              {loading ? (
                <Spinner className="size-7" />
              ) : playing ? (
                <span
                  className="flex h-8 items-center gap-1"
                  aria-hidden="true"
                >
                  {[13, 24, 18, 30, 16, 26].map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className="w-1 animate-pulse rounded-full bg-[#78d7c9] motion-reduce:animate-none"
                      style={{ height, animationDelay: `${index * 80}ms` }}
                    />
                  ))}
                </span>
              ) : (
                <HeadphonesIcon className="size-8 text-[#dcebe5]" />
              )}
            </div>

            {prompt ? (
              repeatHidden ? (
                <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-dashed border-white/20 bg-black/10 px-5 py-5">
                  <p className="text-sm font-black">فقط گوش کن و تکرار کن</p>
                  <p className="mt-2 text-xs leading-6 text-[#b8c7c3]">
                    متن جمله بعد از ثبت پاسخت نمایش داده می‌شود.
                  </p>
                </div>
              ) : (
                <p
                  dir="ltr"
                  lang="en"
                  className="mx-auto mt-6 max-w-2xl whitespace-pre-line text-left text-lg leading-8 font-semibold text-[#f6faf8] sm:text-xl sm:leading-9"
                >
                  {prompt.transcript}
                </p>
              )
            ) : (
              <p className="mt-6 text-sm text-[#b8c7c3]">
                جلسه را برای سؤال بعدی آماده می‌کنیم.
              </p>
            )}

            {prompt?.suggested_duration_ms && (
              <p className="mt-5 text-xs text-[#a8b8b4]">
                {session.exam_type === 'ielts'
                  ? 'پیشنهاد آتنا'
                  : 'زمان پیشنهادی'}
                :{' '}
                <span dir="ltr" className="font-mono font-bold text-white">
                  {formatDuration(prompt.suggested_duration_ms)}
                </span>
              </p>
            )}

            {playing ? (
              <button
                type="button"
                onClick={onPause}
                className="mx-auto mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <PauseIcon className="size-5" />
                توقف موقت
              </button>
            ) : canPlay ? (
              <button
                type="button"
                onClick={onPlay}
                className="mx-auto mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--athena-coral)] px-6 py-3 text-base font-bold text-[#3a2119] shadow-lg shadow-black/15 transition hover:bg-[#ffc4a3] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <PlayIcon className="size-5" />
                {playbackState === 'paused'
                  ? 'ادامهٔ پخش'
                  : playbackState === 'ended'
                    ? 'پخش دوباره'
                    : 'پخش سؤال'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-[11px] text-[#b8c7c3]">
          <p>ضبط پس از پایان صدای ممتحن فعال می‌شود.</p>
        </div>
      </div>
    </section>
  )
}
