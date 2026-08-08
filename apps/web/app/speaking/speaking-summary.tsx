'use client'

import { useEffect, useRef } from 'react'

import type { SpeakingFeedback, SpeakingSession } from '@/lib/speaking-api'

import { SpeakingFeedbackPanel } from './speaking-feedback'
import { CheckIcon, HistoryIcon } from './speaking-icons'
import { SpeakingTranscript, formatDuration } from './speaking-transcript'

type SpeakingSummaryProps = {
  cachedFeedback?: SpeakingFeedback | null
  historyMode?: boolean
  onBack: () => void
  onStartAnother: () => void
  onPlayClosing?: () => void
  onFeedbackLoaded?: (feedback: SpeakingFeedback) => void
  onRetrySpeech?: () => void
  session: SpeakingSession
  speechError?: string | null
  speechReady?: boolean
}

function examLabel(session: SpeakingSession) {
  return session.exam_type === 'ielts' ? 'IELTS' : 'TOEFL'
}

function dateLabel(session: SpeakingSession) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(session.completed_at ?? session.updated_at))
}

function differenceLabel(milliseconds: number) {
  if (milliseconds === 0) return 'برابر با زمان پیشنهادی'
  return `${formatDuration(milliseconds)} ${milliseconds > 0 ? 'بیشتر' : 'کمتر'} از زمان پیشنهادی`
}

export function SpeakingSummary({
  cachedFeedback = null,
  historyMode = false,
  onBack,
  onFeedbackLoaded,
  onPlayClosing,
  onRetrySpeech,
  onStartAnother,
  session,
  speechError = null,
  speechReady = false,
}: SpeakingSummaryProps) {
  const completed = session.status === 'completed'
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <main className="min-h-svh bg-[var(--athena-canvas)] text-[var(--athena-ink)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--athena-border)] pb-5">
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 rounded-xl px-3 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-teal)]"
          >
            بازگشت به جلسه‌ها
          </button>
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--athena-rust)]">
            ATHENA · SPEAKING
          </p>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[1fr_0.8fr] lg:items-stretch">
          <div className="rounded-[1.75rem] bg-[var(--athena-ink)] p-6 text-white shadow-[0_24px_70px_rgba(24,48,45,0.16)] sm:p-8">
            <span className="grid size-14 place-items-center rounded-2xl bg-white/10 text-[#8ee0d2]">
              {completed ? (
                <CheckIcon className="size-7" />
              ) : (
                <HistoryIcon className="size-7" />
              )}
            </span>
            <p className="mt-7 text-xs font-bold tracking-[0.14em] text-[var(--athena-coral)]">
              {examLabel(session)} SPEAKING
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 text-3xl leading-tight font-black outline-none sm:text-4xl"
            >
              {completed
                ? historyMode
                  ? 'گزارش جلسهٔ تکمیل‌شده'
                  : 'تمرینت کامل شد'
                : 'متن جلسهٔ رهاشده'}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#b8c7c3]">
              {dateLabel(session)} ·{' '}
              {session.response_count.toLocaleString('fa-IR')} پاسخ ثبت‌شده
            </p>
            {session.topic_labels.length > 0 && (
              <div
                dir="ltr"
                lang="en"
                className="mt-4 flex flex-wrap gap-2 text-left"
              >
                {session.topic_labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-bold text-[#dce7e4]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-7 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-7 text-[#dce7e4]">
              هیچ نمره، تخمین باند یا تشخیص سطحی محاسبه نمی‌شود. بازخورد این
              صفحه فقط برای تمرین بعدی است.
            </div>
            <button
              type="button"
              onClick={onStartAnother}
              className="mt-5 min-h-12 w-full rounded-xl bg-white px-5 py-3 text-base font-bold text-[var(--athena-ink)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
            >
              شروع تمرین تازه
            </button>
            {speechReady && onPlayClosing && (
              <button
                type="button"
                onClick={onPlayClosing}
                className="mt-5 min-h-12 w-full rounded-2xl bg-[var(--athena-coral)] px-5 py-3 text-sm font-black text-[#3a2119] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
              >
                پخش پیام پایانی ممتحن
              </button>
            )}
            {speechError && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-950/25 p-4 text-sm leading-7 text-amber-100"
              >
                <p>{speechError}</p>
                {onRetrySpeech && (
                  <button
                    type="button"
                    onClick={onRetrySpeech}
                    className="mt-3 min-h-11 rounded-xl bg-white px-4 py-2 text-xs font-black text-[var(--athena-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    تلاش دوباره برای صدا
                  </button>
                )}
              </div>
            )}
          </div>

          <section
            aria-labelledby="session-details-title"
            className="rounded-2xl border border-[var(--athena-border)] bg-[var(--athena-paper)] p-5 shadow-[0_12px_32px_rgb(24_48_45/0.05)] sm:p-6"
          >
            <h2 id="session-details-title" className="text-lg font-bold">
              جزئیات جلسه
            </h2>
            <dl className="mt-5 divide-y divide-[var(--athena-border)]">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-[var(--athena-muted)]">
                  پاسخ‌های ثبت‌شده
                </dt>
                <dd className="text-lg font-bold">
                  {session.response_count.toLocaleString('fa-IR')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-[var(--athena-muted)]">
                  مجموع زمان صحبت
                </dt>
                <dd dir="ltr" className="font-mono text-lg font-bold">
                  {formatDuration(session.timing_summary.actual_duration_ms)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-7 text-[var(--athena-muted)]">
              زمان پیشنهادی{' '}
              <span dir="ltr" className="font-mono">
                {formatDuration(session.timing_summary.suggested_duration_ms)}
              </span>
              ؛ {differenceLabel(session.timing_summary.difference_ms)}. این
              زمان‌ها فقط جزئیات تمرین‌اند و نمره نیستند.
            </p>
          </section>
        </section>

        {completed && onFeedbackLoaded && (
          <SpeakingFeedbackPanel
            cachedFeedback={cachedFeedback}
            sessionId={session.id}
            onLoaded={onFeedbackLoaded}
          />
        )}

        <div className="mt-6">
          <SpeakingTranscript session={session} compact collapsible />
        </div>

        <div className="py-7">
          <button
            type="button"
            onClick={onBack}
            className="min-h-12 w-full rounded-xl border border-[var(--athena-border-strong)] bg-white px-6 py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)]"
          >
            بازگشت به تاریخچه
          </button>
        </div>
      </div>
    </main>
  )
}
