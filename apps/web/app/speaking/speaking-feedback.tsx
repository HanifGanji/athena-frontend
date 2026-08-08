'use client'

import { useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api-client'
import { speakingApi, type SpeakingFeedback } from '@/lib/speaking-api'

import { CheckIcon, Spinner } from './speaking-icons'
import { deriveSpeakingView } from './speaking-machine'

type SpeakingFeedbackProps = {
  cachedFeedback: SpeakingFeedback | null
  onLoaded: (feedback: SpeakingFeedback) => void
  sessionId: string
}

function feedbackError(reason: unknown) {
  if (reason instanceof ApiError) {
    if (reason.status === 409) {
      return 'این جلسه هنوز برای بازخورد آماده نیست.'
    }
    if (reason.status === 429) {
      return 'درخواست‌ها کمی زیاد شده است. چند لحظه دیگر دوباره تلاش کن.'
    }
    if (reason.status === 0) {
      return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کن.'
    }
  }
  return 'بازخورد آماده نشد. می‌توانی دوباره تلاش کنی.'
}

export function SpeakingFeedbackPanel({
  cachedFeedback,
  onLoaded,
  sessionId,
}: SpeakingFeedbackProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const controllerRef = useRef<AbortController | null>(null)
  const errorRef = useRef<HTMLDivElement | null>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const hadFeedbackRef = useRef(Boolean(cachedFeedback))
  const view = deriveSpeakingView('loading_feedback')

  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  useEffect(() => {
    const hasFeedback = Boolean(cachedFeedback)
    if (hasFeedback && !hadFeedbackRef.current) {
      setAnnouncement('بازخورد آماده شد.')
      resultHeadingRef.current?.focus()
    }
    hadFeedbackRef.current = hasFeedback
  }, [cachedFeedback])

  async function loadFeedback() {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setError(null)
    setLoading(true)
    setAnnouncement(view.announcement)
    try {
      const feedback = await speakingApi.getOrCreateFeedback(
        sessionId,
        controller.signal,
      )
      if (!controller.signal.aborted) onLoaded(feedback)
    } catch (reason) {
      if (
        !controller.signal.aborted &&
        !(reason instanceof DOMException && reason.name === 'AbortError')
      ) {
        setAnnouncement('')
        setError(feedbackError(reason))
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <section
      aria-labelledby="speaking-feedback-title"
      className="mt-6 rounded-[1.5rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] p-5 shadow-[0_16px_45px_rgba(24,48,45,0.06)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--athena-rust)]">
            PRACTICAL COACHING
          </p>
          <h2 id="speaking-feedback-title" className="mt-1 text-2xl font-black">
            بازخورد تمرینی
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--athena-muted)]">
            راهنمایی عملی بر پایهٔ همین پاسخ‌ها؛ بدون نمره یا تخمین سطح.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--athena-muted)]">
            با درخواست تو، متن پاسخ‌ها برای ساخت بازخورد به سرویس هوش مصنوعی
            فرستاده می‌شود. فایل صوتی ذخیره نمی‌شود و بازخورد ممکن است خطا داشته
            باشد.
          </p>
        </div>
        {!cachedFeedback && !loading && !error && (
          <button
            type="button"
            onClick={() => void loadFeedback()}
            className="min-h-12 rounded-xl bg-[var(--athena-teal)] px-5 py-3 text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)]"
          >
            دریافت بازخورد
          </button>
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {loading && (
        <div className="mt-5 flex min-h-24 items-center justify-center gap-3 rounded-2xl bg-[var(--athena-mint)] px-5 text-sm font-black text-[var(--athena-teal)]">
          <Spinner className="size-5" />
          {view.primaryStatus}
        </div>
      )}

      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900 outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadFeedback()}
            className="mt-3 min-h-11 rounded-xl bg-amber-900 px-5 py-2 text-xs font-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {cachedFeedback && (
        <div className="mt-7 space-y-7">
          <section
            aria-labelledby="feedback-goal-title"
            className="rounded-xl bg-[var(--athena-ink)] p-5 text-white"
          >
            <p className="text-sm font-semibold text-[var(--athena-coral)]">
              هدف تمرین بعدی
            </p>
            <h3
              ref={resultHeadingRef}
              id="feedback-goal-title"
              tabIndex={-1}
              className="mt-2 text-xl font-bold outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-3 focus-visible:ring-offset-[var(--athena-ink)]"
            >
              {cachedFeedback.next_goal.title}
            </h3>
            <p className="mt-3 text-base leading-8 text-[#dce7e4]">
              {cachedFeedback.next_goal.practice}
            </p>
          </section>

          <section aria-labelledby="feedback-improvements-title">
            <h3 id="feedback-improvements-title" className="text-lg font-bold">
              پیشنهادهای بهبود
            </h3>
            <div className="mt-4 space-y-3">
              {cachedFeedback.improvements.map((improvement) => (
                <article
                  key={`${improvement.learner_excerpt}-${improvement.improved_version}`}
                  className="rounded-xl border border-[var(--athena-border)] p-4 sm:p-5"
                >
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-semibold text-[var(--athena-muted)]">
                        از پاسخ تو
                      </dt>
                      <dd
                        dir="ltr"
                        lang="en"
                        className="mt-2 rounded-xl bg-[var(--athena-peach)] p-3 text-left text-sm leading-7"
                      >
                        {improvement.learner_excerpt}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-[var(--athena-muted)]">
                        نسخهٔ پیشنهادی
                      </dt>
                      <dd
                        dir="ltr"
                        lang="en"
                        className="mt-2 rounded-xl bg-[var(--athena-mint)] p-3 text-left text-sm leading-7"
                      >
                        {improvement.improved_version}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-sm leading-7 text-[var(--athena-muted)]">
                    {improvement.explanation}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="feedback-strengths-title">
            <h3
              id="feedback-strengths-title"
              className="flex items-center gap-2 text-lg font-bold"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-[var(--athena-mint)] text-[var(--athena-teal)]">
                <CheckIcon className="size-5" />
              </span>
              نقطه‌های قوت
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {cachedFeedback.strengths.map((strength) => (
                <article
                  key={`${strength.title}-${strength.evidence}`}
                  className="rounded-xl bg-[var(--athena-mint)] p-4"
                >
                  <h4 className="font-semibold text-[var(--athena-teal)]">
                    {strength.title}
                  </h4>
                  <p className="mt-2 text-sm leading-7 text-[var(--athena-muted)]">
                    {strength.evidence}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
