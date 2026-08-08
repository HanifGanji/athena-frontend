'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { StaffTestPreviewCard } from '@/app/staff-test-preview-card'
import type {
  SpeakingExamType,
  SpeakingSessionSummary,
} from '@/lib/speaking-api'

import { SpeakingHistory } from './speaking-history'
import { HeadphonesIcon, HistoryIcon, Spinner } from './speaking-icons'
import {
  deriveSpeakingView,
  type HistoryStatus,
  type SpeakingPhase,
} from './speaking-machine'

type SpeakingLandingProps = {
  error: string | null
  examType: SpeakingExamType
  historyError: string | null
  historyStatus: HistoryStatus
  onHistoryRetry: () => void
  onInspect: (session: SpeakingSessionSummary) => void
  onResume: (session: SpeakingSessionSummary) => void
  onSelectExam: (examType: SpeakingExamType) => void
  onStart: () => void
  phase: SpeakingPhase
  sessions: SpeakingSessionSummary[]
  staffPreview: {
    error: string | null
    loading: boolean
    onOpen: () => void
  } | null
}

export function SpeakingLanding({
  error,
  examType,
  historyError,
  historyStatus,
  onHistoryRetry,
  onInspect,
  onResume,
  onSelectExam,
  onStart,
  phase,
  sessions,
  staffPreview,
}: SpeakingLandingProps) {
  const errorRef = useRef<HTMLDivElement | null>(null)
  const starting = phase === 'creating_session'
  const phaseView = deriveSpeakingView(phase)
  const resumable = sessions.find((session) => session.status === 'in_progress')

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  return (
    <main className="relative min-h-svh overflow-hidden bg-[var(--athena-canvas)] text-[var(--athena-ink)]">
      <div
        aria-hidden="true"
        className="absolute -top-40 -left-24 size-[28rem] rounded-full bg-[var(--athena-mint)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-48 bottom-24 size-[32rem] rounded-full bg-[var(--athena-peach)] opacity-75 blur-3xl"
      />
      <div className="relative mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--athena-border)] pb-5">
          <Link
            href="/"
            aria-label="بازگشت به صفحهٔ اصلی"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--athena-teal)]"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--athena-rust)]">
              ATHENA · SPEAKING
            </p>
            <p className="mt-1 text-2xl font-black">آتنا</p>
          </Link>
          <span className="rounded-full border border-[var(--athena-border-strong)] bg-white/65 px-4 py-2 text-xs font-black text-[var(--athena-teal)]">
            تمرین گفتاری
          </span>
        </header>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {phaseView.announcement}
        </p>

        {resumable && (
          <section
            aria-labelledby="continue-session-title"
            className="mt-6 mb-6 grid gap-4 rounded-[1.5rem] border border-[var(--athena-border-strong)] bg-[var(--athena-mint)] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
          >
            <div>
              <p className="flex items-center gap-2 text-xs font-black text-[var(--athena-teal)]">
                <HistoryIcon className="size-4" />
                جلسهٔ نیمه‌تمام
              </p>
              <h2
                id="continue-session-title"
                className="mt-2 text-xl font-black"
              >
                تمرین {resumable.exam_type.toUpperCase()} را ادامه بده
              </h2>
              <p className="mt-2 text-sm text-[var(--athena-muted)]">
                {resumable.response_count.toLocaleString('fa-IR')} از{' '}
                {resumable.required_response_count.toLocaleString('fa-IR')} پاسخ
                ثبت شده است.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onResume(resumable)}
              className="min-h-12 rounded-2xl bg-[var(--athena-ink)] px-6 py-3 text-sm font-black text-white transition hover:bg-[var(--athena-teal)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)]"
            >
              ادامهٔ تمرین
            </button>
          </section>
        )}

        <section className={resumable ? 'py-4 sm:py-6' : 'py-8 sm:py-10'}>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--athena-rust)]">
            IELTS · TOEFL
          </p>
          <h1 className="mt-2 text-4xl leading-tight font-black tracking-[-0.035em] sm:text-5xl">
            تمرین Speaking را شروع کن
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--athena-muted)] sm:text-base">
            سؤال را بشنو، پاسخت را ضبط یا بارگذاری کن و جلسه را قدم‌به‌قدم پیش
            ببر.
          </p>
        </section>

        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-7 text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-700"
          >
            {error}
          </div>
        )}

        <section
          aria-labelledby="exam-choice-title"
          className="rounded-[1.75rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] p-5 shadow-[0_18px_55px_rgba(24,48,45,0.07)] sm:p-7"
        >
          <div className="mb-5">
            <p className="text-xs font-bold tracking-[0.14em] text-[var(--athena-rust)]">
              انتخاب تمرین
            </p>
            <h2 id="exam-choice-title" className="mt-2 text-2xl font-black">
              کدام ساختار را تمرین می‌کنی؟
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  type: 'ielts' as const,
                  title: 'IELTS Speaking',
                  count: '۱۶ پاسخ · حدود ۹ دقیقه صحبت',
                  detail: 'Part 1 · Part 2 · Part 3',
                },
                {
                  type: 'toefl' as const,
                  title: 'TOEFL Speaking · Current',
                  count: '۱۱ پاسخ · حدود ۴ دقیقه صحبت',
                  detail: 'Listen & Repeat · Interview',
                },
              ] as const
            ).map((card) => {
              const selected = examType === card.type
              return (
                <button
                  key={card.type}
                  type="button"
                  aria-label={`${card.title} practice`}
                  aria-pressed={selected}
                  onClick={() => onSelectExam(card.type)}
                  className={`min-h-28 rounded-2xl border p-5 text-right transition focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] ${
                    selected
                      ? 'border-[var(--athena-teal)] bg-[var(--athena-mint)]'
                      : 'border-[var(--athena-border)] bg-white hover:border-[var(--athena-border-strong)]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span
                        dir="ltr"
                        lang="en"
                        className="block text-left text-lg font-black"
                      >
                        {card.title}
                      </span>
                      <span className="mt-2 block text-xs text-[var(--athena-muted)]">
                        {card.detail}
                      </span>
                    </span>
                    <span className="max-w-40 rounded-lg bg-white px-3 py-1.5 text-xs leading-5 font-semibold text-[var(--athena-teal)]">
                      {card.count}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className={`mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] disabled:cursor-wait disabled:opacity-60 ${
              resumable
                ? 'border border-[var(--athena-border-strong)] bg-white text-[var(--athena-ink)] hover:bg-[var(--athena-mint)]'
                : 'bg-[var(--athena-ink)] text-white hover:bg-[var(--athena-teal)]'
            }`}
          >
            {starting ? <Spinner /> : <HeadphonesIcon className="size-5" />}
            {starting
              ? phaseView.primaryStatus
              : `شروع تمرین ${examType.toUpperCase()}`}
          </button>
        </section>

        <SpeakingHistory
          error={historyError}
          status={historyStatus}
          sessions={sessions}
          onRetry={onHistoryRetry}
          onResume={onResume}
          onInspect={onInspect}
        />

        {staffPreview && (
          <StaffTestPreviewCard
            moduleLabel="Speaking"
            error={staffPreview.error}
            loading={staffPreview.loading}
            onOpen={staffPreview.onOpen}
          />
        )}
      </div>
    </main>
  )
}
