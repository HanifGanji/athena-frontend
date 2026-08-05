'use client'

import { useEffect, useRef } from 'react'

import type { SpeakingSessionSummary } from '@/lib/speaking-api'

import { HistoryIcon, Spinner } from './speaking-icons'
import type { HistoryStatus } from './speaking-machine'

type SpeakingHistoryProps = {
  error: string | null
  onInspect: (session: SpeakingSessionSummary) => void
  onResume: (session: SpeakingSessionSummary) => void
  onRetry: () => void
  sessions: SpeakingSessionSummary[]
  status: HistoryStatus
}

function statusLabel(status: SpeakingSessionSummary['status']) {
  if (status === 'completed') return 'تکمیل‌شده'
  if (status === 'abandoned') return 'رهاشده'
  return 'در حال انجام'
}

function examLabel(examType: SpeakingSessionSummary['exam_type']) {
  return examType === 'ielts' ? 'IELTS' : 'TOEFL'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  }).format(new Date(value))
}

export function SpeakingHistory({
  error,
  onInspect,
  onResume,
  onRetry,
  sessions,
  status,
}: SpeakingHistoryProps) {
  const errorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (status === 'error') errorRef.current?.focus()
  }, [status])

  return (
    <section aria-labelledby="speaking-history-title" className="pb-16 pt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--athena-rust)]">
            تاریخچهٔ تمرین
          </p>
          <h2 id="speaking-history-title" className="mt-2 text-2xl font-black">
            جلسه‌های اخیر
          </h2>
        </div>
        <HistoryIcon className="size-6 text-[var(--athena-muted)]" />
      </div>

      {status === 'loading' && (
        <div aria-label="در حال بارگذاری تاریخچه" className="grid gap-3">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-[1.4rem] border border-[var(--athena-border)] bg-white/55 motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-7 text-amber-900 outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
        >
          <p>{error ?? 'تاریخچهٔ جلسه‌ها بارگذاری نشد.'}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-900 px-5 py-2 text-xs font-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
          >
            <Spinner className="hidden size-4" />
            تلاش دوباره
          </button>
        </div>
      )}

      {status === 'ready' && sessions.length === 0 && (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--athena-border)] bg-white/45 px-6 py-8 text-center">
          <p className="font-black">هنوز جلسه‌ای نداری.</p>
          <p className="mt-2 text-sm leading-7 text-[var(--athena-muted)]">
            بعد از اولین تمرین، متن جلسه اینجا می‌ماند.
          </p>
        </div>
      )}

      {status === 'ready' && sessions.length > 0 && (
        <div className="grid gap-3">
          {sessions.map((session) => {
            const progress = Math.round(
              (session.response_count / session.required_response_count) * 100,
            )
            return (
              <article
                key={session.id}
                className="grid gap-4 rounded-[1.4rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] p-5 shadow-[0_12px_36px_rgba(24,48,45,0.055)] sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      dir="ltr"
                      lang="en"
                      className="rounded-full bg-[var(--athena-mint)] px-3 py-1 text-xs font-black text-[var(--athena-teal)]"
                    >
                      {examLabel(session.exam_type)}
                    </span>
                    <span className="rounded-full bg-[var(--athena-sand)] px-3 py-1 text-xs font-bold text-[var(--athena-muted)]">
                      {statusLabel(session.status)}
                    </span>
                    <span className="text-xs text-[var(--athena-muted)]">
                      {formatDate(session.updated_at)}
                    </span>
                  </div>
                  {session.topic_labels.length > 0 && (
                    <div
                      dir="ltr"
                      lang="en"
                      className="mt-3 flex flex-wrap gap-1.5 text-left"
                    >
                      {session.topic_labels.map((label) => (
                        <span
                          key={label}
                          className="rounded-lg border border-[var(--athena-border)] bg-white px-2 py-1 text-[10px] font-bold text-[var(--athena-muted)]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                    <p className="font-black">
                      {session.response_count.toLocaleString('fa-IR')} از{' '}
                      {session.required_response_count.toLocaleString('fa-IR')}{' '}
                      پاسخ
                    </p>
                    <span
                      dir="ltr"
                      className="font-mono text-xs text-[var(--athena-muted)]"
                    >
                      {progress}%
                    </span>
                  </div>
                  <div
                    aria-label={`${progress} درصد پیشرفت`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={progress}
                    role="progressbar"
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--athena-sand)]"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--athena-teal)] transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    session.status === 'in_progress'
                      ? onResume(session)
                      : onInspect(session)
                  }
                  className="min-h-11 rounded-xl border border-[var(--athena-border-strong)] bg-white px-5 py-3 text-sm font-black text-[var(--athena-ink)] transition hover:border-[var(--athena-teal)] hover:bg-[var(--athena-mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-teal)]"
                >
                  {session.status === 'in_progress'
                    ? 'ادامهٔ جلسه'
                    : 'دیدن متن جلسه'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
