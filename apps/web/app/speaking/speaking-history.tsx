import type { SpeakingSessionSummary } from '@/lib/speaking-api'

import { HistoryIcon } from './speaking-icons'

type SpeakingHistoryProps = {
  onInspect: (session: SpeakingSessionSummary) => void
  onResume: (session: SpeakingSessionSummary) => void
  sessions: SpeakingSessionSummary[]
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
  onInspect,
  onResume,
  sessions,
}: SpeakingHistoryProps) {
  return (
    <section aria-labelledby="speaking-history-title" className="pb-16 pt-5">
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

      {sessions.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--athena-border)] bg-white/45 px-6 py-9 text-center">
          <p className="font-black">هنوز جلسه‌ای نداری.</p>
          <p className="mt-2 text-sm leading-7 text-[var(--athena-muted)]">
            اولین تمرینت را از کارت‌های بالا شروع کن؛ متن جلسه بعداً همین‌جا
            می‌ماند.
          </p>
        </div>
      ) : (
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
