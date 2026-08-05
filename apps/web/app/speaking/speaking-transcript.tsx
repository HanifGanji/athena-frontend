'use client'

import { useEffect, useMemo, useRef } from 'react'

import type { SpeakingSession, SpeakingStage } from '@/lib/speaking-api'

type SpeakingTranscriptProps = {
  compact?: boolean
  session: SpeakingSession
}

export function stageLabel(stage: SpeakingStage) {
  const labels: Record<SpeakingStage, string> = {
    '': 'Speaking',
    completed: 'Completed',
    ielts_part_1: 'IELTS · Part 1',
    ielts_part_2_follow_up: 'IELTS · Part 2',
    ielts_part_2_long: 'IELTS · Part 2',
    ielts_part_3: 'IELTS · Part 3',
    toefl_interview: 'TOEFL · Interview',
    toefl_repeat: 'TOEFL · Listen & Repeat',
  }
  return labels[stage]
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.round(Math.abs(milliseconds) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

function timingLabel(actual: number, suggested: number, difference: number) {
  if (difference === 0) return `${formatDuration(actual)} · برابر با پیشنهاد`
  const relation = difference > 0 ? 'بیشتر' : 'کمتر'
  return `${formatDuration(actual)} از ${formatDuration(suggested)} · ${formatDuration(difference)} ${relation}`
}

export function SpeakingTranscript({
  compact = false,
  session,
}: SpeakingTranscriptProps) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const promptById = useMemo(
    () => new Map(session.turns.map((turn) => [turn.id, turn])),
    [session.turns],
  )
  const lastTurn = session.turns.at(-1)

  useEffect(() => {
    if (compact) return
    if (typeof endRef.current?.scrollIntoView === 'function') {
      const reduceMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      endRef.current.scrollIntoView({
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    }
  }, [compact, session.turns.length])

  return (
    <section
      aria-labelledby={
        compact ? 'history-transcript-title' : 'live-transcript-title'
      }
      className={
        compact
          ? 'rounded-[1.5rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] p-5 sm:p-7'
          : 'flex min-h-0 flex-col rounded-[1.5rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] shadow-[0_16px_45px_rgba(24,48,45,0.06)]'
      }
    >
      <div
        className={
          compact
            ? 'mb-5 flex items-end justify-between gap-3'
            : 'flex items-end justify-between gap-3 border-b border-[var(--athena-border)] px-5 py-4'
        }
      >
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--athena-rust)]">
            ENGLISH TRANSCRIPT
          </p>
          <h2
            id={compact ? 'history-transcript-title' : 'live-transcript-title'}
            className="mt-1 text-lg font-black"
          >
            متن جلسه
          </h2>
        </div>
        <span className="rounded-full bg-[var(--athena-mint)] px-3 py-1.5 text-[10px] font-black text-[var(--athena-teal)]">
          فقط متن‌های ثبت‌شده
        </span>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {lastTurn
          ? `یک نوبت جدید از ${lastTurn.role === 'examiner' ? 'ممتحن' : 'شما'} ثبت شد.`
          : ''}
      </p>

      <div
        className={
          compact
            ? 'space-y-4'
            : 'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 lg:max-h-[calc(100svh-13rem)]'
        }
        dir="ltr"
        lang="en"
      >
        {session.turns.map((turn) => {
          const learner = turn.role === 'learner'
          const prompt = turn.prompt_id
            ? promptById.get(turn.prompt_id)
            : undefined
          return (
            <article
              key={turn.id}
              className={`rounded-2xl border p-4 text-left ${
                learner
                  ? 'ml-5 border-[var(--athena-peach-border)] bg-[var(--athena-peach)]'
                  : 'mr-5 border-[var(--athena-border)] bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={`text-xs font-black ${
                    learner
                      ? 'text-[var(--athena-rust-dark)]'
                      : 'text-[var(--athena-teal)]'
                  }`}
                >
                  {learner ? 'You' : 'Examiner'}
                </p>
                <span className="font-mono text-[9px] tracking-[0.08em] text-[var(--athena-muted)]">
                  {stageLabel(turn.stage)}
                </span>
              </div>
              {turn.is_hidden ? (
                <p
                  dir="rtl"
                  lang="fa"
                  className="mt-3 rounded-xl border border-dashed border-[var(--athena-border-strong)] bg-[var(--athena-sand)] px-3 py-3 text-right text-xs leading-6 text-[var(--athena-muted)]"
                >
                  متن این جمله بعد از ثبت پاسخ نمایش داده می‌شود.
                </p>
              ) : (
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[var(--athena-ink)]">
                  {turn.transcript}
                </p>
              )}
              {learner &&
                turn.recording_duration_ms !== null &&
                prompt?.suggested_duration_ms !== null &&
                prompt?.suggested_duration_ms !== undefined &&
                turn.duration_difference_ms !== null && (
                  <p
                    dir="rtl"
                    lang="fa"
                    className="mt-3 border-t border-current/10 pt-3 text-right text-[10px] font-bold text-[var(--athena-muted)]"
                  >
                    {timingLabel(
                      turn.recording_duration_ms,
                      prompt.suggested_duration_ms,
                      turn.duration_difference_ms,
                    )}
                  </p>
                )}
            </article>
          )
        })}
        <div ref={endRef} />
      </div>
    </section>
  )
}
