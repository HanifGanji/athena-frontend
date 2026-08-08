'use client'

import type { SpeakingTurn } from '@/lib/speaking-api'

type SpeakingReviewAttentionProps = {
  answer: SpeakingTurn
  onContinue: () => void
  onReplace: () => void
}

export function SpeakingReviewAttention({
  answer,
  onContinue,
  onReplace,
}: SpeakingReviewAttentionProps) {
  const review = answer.review
  if (!review || review.verdict === 'clear') return null

  const warning = review.verdict === 'warning'

  return (
    <section
      aria-labelledby="speaking-review-title"
      role="alert"
      className={`sticky bottom-0 z-20 rounded-t-2xl border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_36px_rgb(24_48_45/0.14)] sm:rounded-2xl sm:p-5 ${
        warning
          ? 'border-[var(--athena-error-border)] bg-[var(--athena-error-surface)]'
          : 'border-[var(--athena-warning-border)] bg-[var(--athena-warning-surface)]'
      }`}
    >
      <p className="text-sm font-semibold text-[var(--athena-muted)]">
        {warning ? 'این پاسخ ممکن است مشکل داشته باشد' : 'یک نکته پیش از ادامه'}
      </p>
      <h2
        id="speaking-review-title"
        className="mt-2 text-base leading-8 font-bold text-[var(--athena-ink)] sm:text-lg"
      >
        {review.message}
      </h2>
      <p className="mt-2 text-sm leading-7 text-[var(--athena-muted)]">
        این بررسی فقط متن پاسخ را می‌بیند و نمره یا سطح تعیین نمی‌کند.
      </p>
      <div
        className={`mt-4 grid gap-2 ${review.replacement_allowed ? 'sm:grid-cols-2' : ''}`}
      >
        {review.replacement_allowed && (
          <button
            type="button"
            onClick={onReplace}
            className="min-h-12 rounded-xl bg-[var(--athena-accent)] px-5 py-3 text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-accent)]"
          >
            ضبط پاسخ جایگزین
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          className="min-h-12 rounded-xl border border-[var(--athena-border-strong)] bg-[var(--athena-surface)] px-5 py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-accent)]"
        >
          ادامه با همین پاسخ
        </button>
      </div>
    </section>
  )
}
