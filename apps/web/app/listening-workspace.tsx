'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  HeadphonesIcon,
} from '@/app/listening/listening-icons'
import { ListeningAudio } from '@/app/listening/listening-media'
import { ListeningQuestionGroup } from '@/app/listening/listening-question-group'
import type {
  ListeningAnswerPayload,
  ListeningAttempt,
  ListeningEvaluation,
  ListeningPart,
  ListeningQuestionGroup as ListeningQuestionGroupType,
  ListeningTest,
  ListeningTestSummary,
} from '@/lib/listening-api'
import { listeningApi } from '@/lib/listening-api'

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

function moduleLabel(module: ListeningTestSummary['module']) {
  if (module === 'academic') return 'Academic'
  if (module === 'general_training') return 'General Training'
  return 'Academic + General'
}

function payloadHasAnswer(payload: ListeningAnswerPayload) {
  return 'selected_options' in payload
    ? payload.selected_options.length > 0
    : Object.values(payload.answers).some((value) => value.trim() !== '')
}

export function ListeningWorkspace() {
  const [tests, setTests] = useState<ListeningTestSummary[]>([])
  const [test, setTest] = useState<ListeningTest | null>(null)
  const [attempt, setAttempt] = useState<ListeningAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [multiSelections, setMultiSelections] = useState<
    Record<string, string[]>
  >({})
  const [activePartIndex, setActivePartIndex] = useState(0)
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<
    number | null
  >(null)
  const [evaluation, setEvaluation] = useState<ListeningEvaluation | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [startingSlug, setStartingSlug] = useState<string | null>(null)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const answersRef = useRef<Record<string, string>>({})
  const multiRef = useRef<Record<string, string[]>>({})
  const saveQueues = useRef(new Map<string, Promise<void>>())
  const saveFailures = useRef(new Map<string, string>())

  useEffect(() => {
    const controller = new AbortController()
    listeningApi
      .listTests(controller.signal)
      .then(setTests)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError')
          return
        setError(
          reason instanceof Error
            ? reason.message
            : 'بارگذاری تمرین‌ها ناموفق بود.',
        )
      })
      .finally(() => setInitialLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return
    const startedAt = new Date(attempt.started_at).getTime()
    const update = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      )
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [attempt])

  const groups = useMemo(
    () => test?.parts.flatMap((part) => part.question_groups) ?? [],
    [test],
  )
  const slots = useMemo(
    () => groups.flatMap((group) => group.response_slots),
    [groups],
  )
  const resultBySlot = useMemo(
    () =>
      new Map(
        evaluation?.results.map((result) => [result.question_id, result]) ?? [],
      ),
    [evaluation],
  )
  const answeredCount = useMemo(() => {
    const textAnswers = slots.filter(
      (slot) => (answers[slot.id] ?? '').trim() !== '',
    ).length
    const multiAnswers = Object.values(multiSelections).reduce(
      (total, selected) => total + selected.length,
      0,
    )
    return Math.min(slots.length, textAnswers + multiAnswers)
  }, [answers, multiSelections, slots])
  const activePart = test?.parts[activePartIndex] ?? null

  function selectPart(index: number) {
    setActivePartIndex(index)
    setActiveQuestionNumber(null)
  }

  async function start(summary: ListeningTestSummary) {
    setStartingSlug(summary.slug)
    setError(null)
    try {
      const [testPayload, attemptPayload] = await Promise.all([
        listeningApi.getTest(summary.slug),
        listeningApi.startAttempt(summary.slug, 'practice'),
      ])
      setTest(testPayload)
      setAttempt(attemptPayload)
      answersRef.current = {}
      multiRef.current = {}
      setAnswers({})
      setMultiSelections({})
      setEvaluation(null)
      setActivePartIndex(0)
      setActiveQuestionNumber(null)
      setElapsedSeconds(0)
      saveQueues.current.clear()
      saveFailures.current.clear()
      setSaveError(null)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع تمرین ناموفق بود.',
      )
    } finally {
      setStartingSlug(null)
    }
  }

  function payloadFor(
    group: ListeningQuestionGroupType,
  ): ListeningAnswerPayload {
    if (group.interaction_type === 'multi_select') {
      return { selected_options: multiRef.current[group.id] ?? [] }
    }
    const groupAnswers: Record<string, string> = {}
    for (const slot of group.response_slots) {
      const answer = answersRef.current[slot.id]
      if (answer !== undefined) groupAnswers[slot.id] = answer
    }
    return { answers: groupAnswers }
  }

  function persistGroup(group: ListeningQuestionGroupType) {
    if (!attempt || evaluation) return Promise.resolve()
    const payload = payloadFor(group)
    const previous = saveQueues.current.get(group.id) ?? Promise.resolve()
    const eventId = crypto.randomUUID()
    setPendingSaves((count) => count + 1)
    const persist = () =>
      listeningApi.saveResponse(attempt.id, group.id, payload, eventId)
    const queued = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          await persist()
        } catch (reason) {
          if (!(reason instanceof TypeError)) throw reason
          await persist()
        }
      })
      .then(() => {
        saveFailures.current.delete(group.id)
        setSaveError(saveFailures.current.values().next().value ?? null)
      })
      .catch((reason: unknown) => {
        const message =
          reason instanceof Error ? reason.message : 'ذخیرهٔ پاسخ ناموفق بود.'
        saveFailures.current.set(group.id, message)
        setSaveError(message)
      })
      .finally(() => setPendingSaves((count) => Math.max(0, count - 1)))
    saveQueues.current.set(group.id, queued)
    return queued
  }

  function changeAnswer(
    group: ListeningQuestionGroupType,
    slotId: string,
    value: string,
  ) {
    if (evaluation) return
    const next = { ...answersRef.current, [slotId]: value }
    answersRef.current = next
    setAnswers(next)
    if (group.interaction_type !== 'completion') void persistGroup(group)
  }

  function toggleOption(group: ListeningQuestionGroupType, value: string) {
    if (evaluation) return
    const current = multiRef.current[group.id] ?? []
    const maximum = Number(group.response_rules.maximum_selections ?? 2)
    const next = current.includes(value)
      ? current.filter((selected) => selected !== value)
      : current.length < maximum
        ? [...current, value]
        : current
    multiRef.current = { ...multiRef.current, [group.id]: next }
    setMultiSelections(multiRef.current)
    void persistGroup(group)
  }

  async function submit() {
    if (!attempt || evaluation || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await Promise.all(saveQueues.current.values())
      for (const group of groups.filter((candidate) =>
        payloadHasAnswer(payloadFor(candidate)),
      )) {
        await persistGroup(group)
      }
      if (saveFailures.current.size > 0) {
        const firstFailure = saveFailures.current.values().next().value
        throw new Error(
          firstFailure ?? 'همهٔ پاسخ‌ها ذخیره نشدند. دوباره تلاش کن.',
        )
      }
      const result = await listeningApi.submitAttempt(attempt.id)
      setEvaluation(result)
      setAttempt({
        ...attempt,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        raw_score: result.raw_score,
        maximum_score: result.maximum_score,
      })
      setReviewing(false)
      setActivePartIndex(0)
      setActiveQuestionNumber(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت آزمون ناموفق بود.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setTest(null)
    setAttempt(null)
    setEvaluation(null)
    setAnswers({})
    setMultiSelections({})
    setActiveQuestionNumber(null)
    answersRef.current = {}
    multiRef.current = {}
    setError(null)
    setSaveError(null)
  }

  if (initialLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#f4f1e8] p-6">
        <div className="text-center text-sm font-bold text-[#155e57]">
          <span className="mx-auto mb-4 block size-3 animate-pulse rounded-full bg-[#e57d55] motion-reduce:animate-none" />
          در حال آماده‌سازی Listening…
        </div>
      </main>
    )
  }

  if (!test || !attempt || !activePart) {
    return (
      <ListeningLanding
        tests={tests}
        error={error}
        startingSlug={startingSlug}
        onStart={start}
      />
    )
  }

  const answeredPercent = slots.length
    ? Math.round((answeredCount / slots.length) * 100)
    : 0

  return (
    <main className="min-h-svh bg-[#edf1ed] pb-32 text-[#18302d]">
      <header className="sticky top-0 z-30 border-b border-[#18302d]/10 bg-[#fffdf8]/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={reset}
              aria-label="بازگشت به تمرین‌ها"
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 text-sm font-black text-[#155e57] transition hover:bg-[#dcebe5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#155e57]"
            >
              <ArrowRightIcon className="size-5" />
              <span className="hidden sm:inline">تمرین‌ها</span>
            </button>
            <div className="min-w-0 text-center">
              <p
                dir="ltr"
                title={test.title}
                className="truncate text-sm font-black"
              >
                {test.title}
              </p>
              <div className="mt-1 flex items-center justify-center gap-3 text-[11px] text-[#65716e]">
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <ClockIcon className="size-3.5" />
                  {formatTime(elapsedSeconds)}
                </span>
                <span aria-live="polite">
                  {pendingSaves > 0
                    ? 'در حال ذخیره…'
                    : saveError
                      ? 'خطا در ذخیره'
                      : 'ذخیره شد'}
                </span>
              </div>
            </div>
            <div
              aria-label={`${answeredCount} پاسخ از ${slots.length}`}
              className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-[#155e57] bg-white font-mono text-xs font-black text-[#155e57]"
            >
              {answeredPercent}%
            </div>
          </div>
          <nav
            aria-label="بخش‌های آزمون"
            className="mt-3 flex gap-2 overflow-x-auto pb-1"
          >
            {test.parts.map((part, index) => {
              const partResults = part.question_groups.flatMap((group) =>
                group.response_slots.map((slot) => resultBySlot.get(slot.id)),
              )
              const correct = partResults.filter(
                (result) => result?.result_code === 'correct',
              ).length
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => selectPart(index)}
                  aria-current={activePartIndex === index ? 'step' : undefined}
                  className={`min-h-11 shrink-0 rounded-xl border px-4 text-xs font-black transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] ${
                    activePartIndex === index
                      ? 'border-[#155e57] bg-[#155e57] text-white'
                      : 'border-[#18302d]/12 bg-white text-[#52625f] hover:border-[#155e57]/40'
                  }`}
                >
                  Part {part.number}
                  {evaluation && (
                    <span className="mr-2 font-mono opacity-80">
                      {correct}/{partResults.length}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          {evaluation && (
            <ResultSummary
              evaluation={evaluation}
              answeredCount={answeredCount}
              onReset={reset}
            />
          )}
          <section className="mb-6 rounded-[1.75rem] border border-[#18302d]/10 bg-[#fffdf8] p-5 sm:p-7">
            <p className="text-xs font-black tracking-[0.18em] text-[#a14e32] uppercase">
              Part {activePart.number} of {test.parts.length}
            </p>
            <h1
              dir="ltr"
              className="mt-3 text-left text-3xl font-black tracking-[-0.03em] sm:text-4xl"
            >
              {activePart.title}
            </h1>
            <p
              dir="ltr"
              className="mt-3 max-w-2xl text-left text-sm leading-7 text-[#52625f]"
            >
              {activePart.context}
            </p>
          </section>

          <div className="grid gap-5">
            {activePart.question_groups.map((group) => (
              <ListeningQuestionGroup
                key={group.id}
                group={group}
                answers={answers}
                selectedOptions={multiSelections[group.id] ?? []}
                activeQuestionNumber={activeQuestionNumber}
                disabled={Boolean(evaluation)}
                results={resultBySlot}
                onAnswer={(slotId, value) => changeAnswer(group, slotId, value)}
                onToggleOption={(value) => toggleOption(group, value)}
                onCommit={() => void persistGroup(group)}
              />
            ))}
          </div>
        </div>

        <aside className="order-first min-w-0 lg:order-none lg:sticky lg:top-40">
          {activePart.media[0] && (
            <ListeningAudio asset={activePart.media[0].asset} />
          )}
          <QuestionNavigator
            part={activePart}
            answers={answers}
            multiSelections={multiSelections}
            results={resultBySlot}
            activeQuestionNumber={activeQuestionNumber}
            onQuestionSelect={setActiveQuestionNumber}
          />
        </aside>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[#18302d]/12 bg-[#fffdf8]/95 px-4 py-3 shadow-[0_-12px_35px_rgba(24,48,45,0.08)] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => selectPart(Math.max(0, activePartIndex - 1))}
            disabled={activePartIndex === 0}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-[#18302d]/15 bg-white px-4 text-sm font-black transition hover:border-[#155e57]/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowRightIcon className="size-5" />
            قبلی
          </button>
          {!evaluation && activePartIndex === test.parts.length - 1 ? (
            <button
              type="button"
              onClick={() => setReviewing(true)}
              disabled={submitting}
              className="min-h-12 rounded-xl bg-[#a14e32] px-6 text-sm font-black text-white shadow-lg shadow-[#a14e32]/15 transition hover:bg-[#78351f] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#a14e32] disabled:cursor-wait disabled:opacity-60"
            >
              پایان و تصحیح
            </button>
          ) : activePartIndex < test.parts.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                selectPart(Math.min(test.parts.length - 1, activePartIndex + 1))
              }
              className="flex min-h-12 items-center gap-2 rounded-xl bg-[#155e57] px-5 text-sm font-black text-white transition hover:bg-[#104b46] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#155e57]"
            >
              بخش بعدی
              <ArrowLeftIcon className="size-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="min-h-12 rounded-xl bg-[#155e57] px-5 text-sm font-black text-white"
            >
              بازگشت به تمرین‌ها
            </button>
          )}
        </div>
      </footer>

      {(error || saveError) && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed right-4 bottom-24 z-40 max-w-sm rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900 shadow-xl"
        >
          <span className="flex items-start gap-2">
            <AlertIcon className="mt-0.5 size-5 shrink-0" />
            {error ?? saveError}
          </span>
        </div>
      )}

      {reviewing && (
        <SubmitDialog
          answered={answeredCount}
          total={slots.length}
          submitting={submitting}
          onCancel={() => setReviewing(false)}
          onConfirm={() => void submit()}
        />
      )}
    </main>
  )
}

function ListeningSeriesCatalog({
  tests,
  startingSlug,
  onStart,
}: {
  tests: ListeningTestSummary[]
  startingSlug: string | null
  onStart: (summary: ListeningTestSummary) => void
}) {
  const grouped = new Map<
    string,
    {
      series: ListeningTestSummary['series']
      tests: ListeningTestSummary[]
    }
  >()

  for (const summary of tests) {
    const key = summary.series?.id ?? 'standalone'
    const group = grouped.get(key) ?? { series: summary.series, tests: [] }
    group.tests.push(summary)
    grouped.set(key, group)
  }

  return (
    <div className="grid gap-8">
      {[...grouped.entries()].map(([key, group]) => {
        const headingId = `listening-series-${group.series?.slug ?? key}`
        return (
          <section
            key={key}
            aria-labelledby={headingId}
            className="rounded-[2rem] border border-[#18302d]/10 bg-white/45 p-4 sm:p-6"
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#18302d]/10 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black tracking-wider text-[#6f7f7b] uppercase">
                  {group.series?.volume_number && (
                    <span>Volume {group.series.volume_number}</span>
                  )}
                  {group.series?.release_year && (
                    <span>· {group.series.release_year}</span>
                  )}
                </div>
                <h3
                  id={headingId}
                  dir="ltr"
                  className="mt-1 text-left text-xl font-black sm:text-2xl"
                >
                  {group.series?.title ?? 'Independent Listening practice'}
                </h3>
                {group.series?.publisher && (
                  <p
                    dir="ltr"
                    className="mt-1 text-left text-xs text-[#65716e]"
                  >
                    {group.series.publisher}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-[#dcebe5] px-3 py-1 font-mono text-[11px] font-black text-[#155e57]">
                {group.tests.length.toString().padStart(2, '0')} TESTS
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {group.tests.map((summary) => (
                <ListeningTestCard
                  key={summary.id}
                  summary={summary}
                  startingSlug={startingSlug}
                  onStart={onStart}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ListeningTestCard({
  summary,
  startingSlug,
  onStart,
}: {
  summary: ListeningTestSummary
  startingSlug: string | null
  onStart: (summary: ListeningTestSummary) => void
}) {
  return (
    <article className="group flex h-full flex-col rounded-[1.5rem] border border-[#18302d]/12 bg-[#fffdf8] p-5 shadow-[0_12px_36px_rgba(24,48,45,0.05)] transition hover:-translate-y-0.5 hover:border-[#155e57]/35 motion-reduce:transform-none sm:p-6">
      <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-bold tracking-wider">
        {summary.series_test_number && (
          <span className="rounded-full bg-[#18302d] px-3 py-1 font-mono text-white">
            TEST {summary.series_test_number}
          </span>
        )}
        <span className="rounded-full bg-[#dcebe5] px-3 py-1 text-[#155e57]">
          {moduleLabel(summary.module)}
        </span>
        <span className="rounded-full bg-[#f3dfd6] px-3 py-1 text-[#8d4028]">
          {summary.question_count} سؤال
        </span>
        <span
          className={`rounded-full px-3 py-1 ${
            summary.content_origin === 'athena_original'
              ? 'bg-[#e8f3ef] text-[#155e57]'
              : 'bg-[#fff1ea] text-[#8d4028]'
          }`}
        >
          {summary.content_origin === 'athena_original'
            ? 'Athena Original'
            : 'Publisher source · local review'}
        </span>
      </div>
      <h4 dir="ltr" className="text-left text-lg font-black sm:text-xl">
        {summary.title}
      </h4>
      <p
        dir="ltr"
        className="mt-2 line-clamp-3 flex-1 text-left text-sm leading-7 text-[#65716e]"
      >
        {summary.description}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#18302d]/10 pt-4">
        <span className="text-xs font-bold text-[#65716e]">
          {summary.part_count} بخش صوتی
        </span>
        <button
          type="button"
          onClick={() => onStart(summary)}
          disabled={startingSlug !== null}
          className="min-h-12 rounded-xl bg-[#155e57] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#155e57]/15 transition hover:bg-[#104b46] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#155e57] disabled:cursor-wait disabled:opacity-60"
        >
          {startingSlug === summary.slug ? 'در حال شروع…' : 'شروع تمرین ←'}
        </button>
      </div>
    </article>
  )
}

function ListeningLanding({
  tests,
  error,
  startingSlug,
  onStart,
}: {
  tests: ListeningTestSummary[]
  error: string | null
  startingSlug: string | null
  onStart: (summary: ListeningTestSummary) => void
}) {
  return (
    <main className="min-h-svh overflow-hidden bg-[#f4f1e8] text-[#18302d]">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-14">
        <header className="flex items-center justify-between border-b border-[#18302d]/15 pb-5">
          <Link
            href="/"
            aria-label="بازگشت به صفحهٔ اصلی"
            className="rounded-lg focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#155e57]"
          >
            <p className="font-mono text-[11px] tracking-[0.25em] text-[#a14e32]">
              ATHENA · LISTENING LAB
            </p>
            <p className="mt-1 text-2xl font-black">آتنا</p>
          </Link>
          <span className="rounded-full border border-[#155e57]/25 bg-white/60 px-4 py-2 text-xs font-bold text-[#155e57]">
            نسخهٔ آزمایشی
          </span>
        </header>

        <section className="grid gap-10 py-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-end lg:py-24">
          <div>
            <span className="mb-6 grid size-14 place-items-center rounded-2xl bg-[#155e57] text-white shadow-lg shadow-[#155e57]/15">
              <HeadphonesIcon className="size-7" />
            </span>
            <p className="mb-5 text-sm font-bold text-[#a14e32]">
              آزمایشگاه Listening آتنا
            </p>
            <h1 className="max-w-3xl text-5xl leading-[1.12] font-black tracking-[-0.04em] sm:text-7xl">
              فقط نشنو؛
              <span className="block text-[#155e57]">نشانه‌ها را پیدا کن.</span>
            </h1>
          </div>
          <div>
            <p className="max-w-xl text-base leading-8 text-[#52625f] lg:text-lg">
              تمرین‌های کوتاه آتنا و نمونه‌های کامل منبع‌دار Listening: تکمیل
              فرم و یادداشت، انتخاب، تطبیق و برچسب‌گذاری نقشه؛ با ذخیرهٔ امن و
              تصحیح فوری.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-[#52625f]">
              {['Completion', 'Choice', 'Matching', 'Map / plan'].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[#18302d]/12 bg-white/65 px-3 py-2"
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            {error}
          </div>
        )}

        <section aria-labelledby="listening-tests" className="pb-16">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[#6f7f7b]">
                AVAILABLE NOW
              </p>
              <h2 id="listening-tests" className="mt-2 text-2xl font-black">
                تمرین‌های آماده
              </h2>
            </div>
            <span className="font-mono text-xs text-[#6f7f7b]">
              {tests.length.toString().padStart(2, '0')} TESTS
            </span>
          </div>
          {tests.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-[#18302d]/20 bg-white/50 p-10 text-center">
              <p className="font-black">هنوز تمرینی منتشر نشده است.</p>
              <p className="mt-2 text-sm text-[#65716e]">
                پس از اجرای seed دادهٔ نمونه اینجا نمایش داده می‌شود.
              </p>
            </div>
          ) : (
            <ListeningSeriesCatalog
              tests={tests}
              startingSlug={startingSlug}
              onStart={onStart}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function QuestionNavigator({
  part,
  answers,
  multiSelections,
  results,
  activeQuestionNumber,
  onQuestionSelect,
}: {
  part: ListeningPart
  answers: Record<string, string>
  multiSelections: Record<string, string[]>
  results: Map<string, ListeningEvaluation['results'][number]>
  activeQuestionNumber: number | null
  onQuestionSelect: (questionNumber: number) => void
}) {
  function navigateToQuestion(questionNumber: number) {
    const target = document.querySelector<HTMLElement>(
      `[data-listening-question~="${questionNumber}"]`,
    )
    if (!target) return

    onQuestionSelect(questionNumber)
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const control = target.querySelector<HTMLElement>(
      'input:not(:disabled), select:not(:disabled), button:not(:disabled)',
    )
    ;(control ?? target).focus({ preventScroll: true })
  }

  return (
    <section className="mt-4 hidden rounded-[1.5rem] border border-[#18302d]/10 bg-[#fffdf8] p-4 lg:block">
      <h2 className="text-sm font-black">پرسش‌های این بخش</h2>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {part.question_groups.flatMap((group) =>
          group.response_slots.map((slot, index) => {
            const result = results.get(slot.id)
            const answered =
              (answers[slot.id] ?? '').trim() !== '' ||
              index < (multiSelections[group.id]?.length ?? 0)
            const active = activeQuestionNumber === slot.display_number
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => navigateToQuestion(slot.display_number)}
                aria-current={active ? 'location' : undefined}
                aria-label={`رفتن به سؤال ${slot.display_number}${answered ? '، پاسخ داده شده' : ''}`}
                className={`grid size-11 place-items-center rounded-xl border font-mono text-xs font-black transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] ${
                  active
                    ? 'border-[#e57d55] bg-[#fff1ea] text-[#78351f] ring-3 ring-[#e57d55]/20'
                    : result
                      ? result.result_code === 'correct'
                        ? 'border-[#8dbeb2] bg-[#e8f3ef] text-[#104b46]'
                        : 'border-[#ddb7a6] bg-[#fff1ea] text-[#78351f]'
                      : answered
                        ? 'border-[#155e57] bg-[#dcebe5] text-[#155e57]'
                        : 'border-[#18302d]/12 bg-white text-[#65716e]'
                }`}
              >
                {slot.display_number}
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}

function ResultSummary({
  evaluation,
  answeredCount,
  onReset,
}: {
  evaluation: ListeningEvaluation
  answeredCount: number
  onReset: () => void
}) {
  const percent = Math.round(
    (evaluation.raw_score / Math.max(1, evaluation.maximum_score)) * 100,
  )
  return (
    <section
      aria-labelledby="result-heading"
      className="mb-6 overflow-hidden rounded-[1.75rem] bg-[#18302d] p-5 text-white shadow-xl sm:p-7"
    >
      <div className="grid gap-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="grid size-24 place-items-center rounded-full border-4 border-[#f0ac87] bg-white/5 text-center">
          <div>
            <p className="font-mono text-2xl font-black tabular-nums">
              {evaluation.raw_score}/{evaluation.maximum_score}
            </p>
            <p className="mt-1 text-[10px] text-[#b8d7d0]">RAW SCORE</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#f0ac87] uppercase">
            Result · {percent}%
          </p>
          <h2 id="result-heading" className="mt-2 text-2xl font-black">
            پاسخ‌ها تصحیح شدند.
          </h2>
          <p className="mt-2 text-sm leading-7 text-[#c7d8d4]">
            {answeredCount} پاسخ ثبت شد. پاسخ درست هر مورد را پایین همان سؤال
            می‌بینی. این تمرین نمرهٔ رسمی IELTS یا Band تخمین نمی‌زند.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="min-h-12 rounded-xl bg-white px-5 text-sm font-black text-[#155e57] transition hover:bg-[#f4f1e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          تمرین تازه
        </button>
      </div>
    </section>
  )
}

function SubmitDialog({
  answered,
  total,
  submitting,
  onCancel,
  onConfirm,
}: {
  answered: number
  total: number
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-3 sm:place-items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        aria-describedby="submit-description"
        className="w-full max-w-md rounded-[1.75rem] bg-[#fffdf8] p-6 shadow-2xl sm:p-7"
      >
        <span className="grid size-12 place-items-center rounded-full bg-[#f3dfd6] text-[#a14e32]">
          <CheckIcon className="size-6" />
        </span>
        <h2 id="submit-title" className="mt-5 text-2xl font-black">
          پاسخ‌ها ثبت نهایی شوند؟
        </h2>
        <p
          id="submit-description"
          className="mt-3 text-sm leading-7 text-[#52625f]"
        >
          به {answered} سؤال از {total} سؤال پاسخ داده‌ای. پس از تصحیح دیگر
          امکان تغییر پاسخ‌ها وجود ندارد.
        </p>
        {answered < total && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff1ea] p-3 text-xs leading-6 text-[#78351f]">
            <AlertIcon className="mt-0.5 size-5 shrink-0" />
            {total - answered} سؤال بدون پاسخ است؛ می‌توانی برگردی و کاملش کنی.
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-12 rounded-xl border border-[#18302d]/15 bg-white text-sm font-black transition hover:border-[#155e57]/40 disabled:opacity-50"
          >
            بازگشت
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="min-h-12 rounded-xl bg-[#a14e32] text-sm font-black text-white transition hover:bg-[#78351f] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#a14e32] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'در حال تصحیح…' : 'ثبت و تصحیح'}
          </button>
        </div>
      </section>
    </div>
  )
}
