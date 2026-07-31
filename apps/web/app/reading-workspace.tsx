'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  type AgentFeedback,
  type Evaluation,
  type QuestionGroup,
  type ReadingAttempt,
  type ReadingTest,
  type ReadingTestSummary,
  readingApi,
} from '@/lib/reading-api'

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

function moduleLabel(module: ReadingTestSummary['module']) {
  return module === 'academic' ? 'Academic' : 'General Training'
}

export function ReadingWorkspace() {
  const [tests, setTests] = useState<ReadingTestSummary[]>([])
  const [test, setTest] = useState<ReadingTest | null>(null)
  const [attempt, setAttempt] = useState<ReadingAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [feedback, setFeedback] = useState<AgentFeedback | null>(null)
  const [activeQuestion, setActiveQuestion] = useState(1)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [startingSlug, setStartingSlug] = useState<string | null>(null)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const answersRef = useRef<Record<string, string>>({})
  const saveQueues = useRef(new Map<string, Promise<void>>())
  const saveFailures = useRef(new Map<string, string>())

  useEffect(() => {
    const controller = new AbortController()
    readingApi
      .listTests(controller.signal)
      .then(setTests)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError')
          return
        setError(reason instanceof Error ? reason.message : 'خطای ناشناخته')
      })
      .finally(() => setInitialLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return
    const started = new Date(attempt.started_at).getTime()
    const update = () =>
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [attempt])

  const groups = useMemo(
    () => test?.sections.flatMap((section) => section.question_groups) ?? [],
    [test],
  )
  const slots = useMemo(
    () => groups.flatMap((group) => group.response_slots),
    [groups],
  )
  const resultByQuestion = useMemo(
    () =>
      new Map(
        evaluation?.results.map((result) => [result.question_id, result]) ?? [],
      ),
    [evaluation],
  )

  async function start(summary: ReadingTestSummary) {
    setStartingSlug(summary.slug)
    setError(null)
    try {
      const testPayload = await readingApi.getTest(summary.slug)
      const attemptPayload = await readingApi.startAttempt(
        summary.slug,
        'practice',
      )
      setTest(testPayload)
      setAttempt(attemptPayload)
      answersRef.current = {}
      setAnswers({})
      setEvaluation(null)
      setFeedback(null)
      saveQueues.current.clear()
      saveFailures.current.clear()
      setSaveError(null)
      setActiveQuestion(1)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع تمرین ناموفق بود.',
      )
    } finally {
      setStartingSlug(null)
    }
  }

  async function chooseAnswer(
    group: QuestionGroup,
    slotId: string,
    value: string,
  ) {
    if (!attempt || evaluation) return
    const nextAnswers = { ...answersRef.current, [slotId]: value }
    answersRef.current = nextAnswers
    setAnswers(nextAnswers)
    setPendingSaves((count) => count + 1)

    const groupAnswers: Record<string, string> = {}
    for (const slot of group.response_slots) {
      const answer = nextAnswers[slot.id]
      if (answer !== undefined) groupAnswers[slot.id] = answer
    }

    const previousSave = saveQueues.current.get(group.id) ?? Promise.resolve()
    const clientEventId = crypto.randomUUID()
    const persist = () =>
      readingApi.saveResponse(attempt.id, group.id, groupAnswers, clientEventId)
    const queuedSave = previousSave
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
    saveQueues.current.set(group.id, queuedSave)
  }

  async function submit() {
    if (!attempt || pendingSaves > 0 || saveError) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await readingApi.submitAttempt(attempt.id)
      setEvaluation(result)
      setAttempt({
        ...attempt,
        status: 'submitted',
        raw_score: result.raw_score,
        maximum_score: result.maximum_score,
      })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت آزمون ناموفق بود.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function getFeedback() {
    if (!attempt) return
    setFeedbackLoading(true)
    setError(null)
    try {
      setFeedback(await readingApi.requestFeedback(attempt.id))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'دریافت بازخورد ناموفق بود.',
      )
    } finally {
      setFeedbackLoading(false)
    }
  }

  function goToQuestion(questionNumber: number) {
    setActiveQuestion(questionNumber)
    document
      .getElementById(`question-${questionNumber}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (initialLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#f4f1e8] p-6">
        <div className="flex items-center gap-3 text-sm font-bold text-[#155e57]">
          <span className="size-3 animate-pulse rounded-full bg-[#e57d55]" />
          در حال آماده‌سازی Reading…
        </div>
      </main>
    )
  }

  if (!test || !attempt) {
    return (
      <main className="min-h-svh overflow-hidden bg-[#f4f1e8] text-[#18302d]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-14">
          <header className="flex items-center justify-between border-b border-[#18302d]/15 pb-5">
            <Link href="/" aria-label="بازگشت به صفحهٔ اصلی">
              <p className="font-mono text-[11px] tracking-[0.25em] text-[#a14e32]">
                ATHENA · READING LAB
              </p>
              <p className="mt-1 text-2xl font-black">آتنا</p>
            </Link>
            <span className="rounded-full border border-[#155e57]/25 bg-white/60 px-4 py-2 text-xs font-bold text-[#155e57]">
              نسخهٔ آزمایشی
            </span>
          </header>

          <section className="grid gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-24">
            <div>
              <p className="mb-5 text-sm font-bold text-[#a14e32]">
                تمرین تشخیصی Reading
              </p>
              <h1 className="max-w-3xl text-5xl leading-[1.12] font-black tracking-[-0.04em] sm:text-7xl">
                سریع نخوان؛
                <span className="block text-[#155e57]">دقیق‌تر یاد بگیر.</span>
              </h1>
            </div>
            <p className="max-w-xl text-base leading-8 text-[#52625f] lg:text-lg">
              متن انگلیسی، پاسخ‌گویی شبیه آزمون و تحلیل فارسی مبتنی بر شواهد؛
              بدون حدس زدن نمرهٔ رسمی IELTS.
            </p>
          </section>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <section aria-labelledby="available-tests" className="pb-16">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[#6f7f7b]">
                  AVAILABLE NOW
                </p>
                <h2 id="available-tests" className="mt-2 text-2xl font-black">
                  تمرین‌های آماده
                </h2>
              </div>
              <span className="font-mono text-xs text-[#6f7f7b]">
                {tests.length.toString().padStart(2, '0')} TESTS
              </span>
            </div>
            <div className="grid gap-4">
              {tests.map((summary) => (
                <article
                  key={summary.id}
                  className="group grid gap-5 rounded-[2rem] border border-[#18302d]/12 bg-[#fffdf8] p-6 shadow-[0_16px_50px_rgba(24,48,45,0.06)] transition hover:-translate-y-0.5 hover:border-[#155e57]/35 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
                >
                  <div>
                    <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-bold tracking-wider">
                      <span className="rounded-full bg-[#dcebe5] px-3 py-1 text-[#155e57]">
                        {moduleLabel(summary.module)}
                      </span>
                      <span className="rounded-full bg-[#f3dfd6] px-3 py-1 text-[#8d4028]">
                        {summary.question_count} سؤال
                      </span>
                      <span className="rounded-full bg-[#ece8dc] px-3 py-1 text-[#59635f]">
                        {Math.round(summary.time_limit_seconds / 60)} دقیقه
                      </span>
                    </div>
                    <h3 className="text-xl font-black sm:text-2xl">
                      {summary.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[#65716e]">
                      {summary.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => start(summary)}
                    disabled={startingSlug !== null}
                    className="rounded-2xl bg-[#155e57] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#155e57]/15 transition group-hover:bg-[#104b46] disabled:cursor-wait disabled:opacity-60"
                  >
                    {startingSlug === summary.slug
                      ? 'در حال شروع…'
                      : 'شروع تمرین ←'}
                  </button>
                </article>
              ))}
              {tests.length === 0 && !error && (
                <div className="rounded-[2rem] border border-dashed border-[#18302d]/20 bg-white/45 p-8 text-center">
                  <p className="font-black">هنوز تمرینی منتشر نشده است.</p>
                  <p className="mt-2 text-sm leading-7 text-[#65716e]">
                    بعد از اجرای seed در بک‌اند، تمرین Reading اینجا نمایش داده
                    می‌شود.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    )
  }

  const timeRemaining = test.time_limit_seconds - elapsedSeconds

  return (
    <main className="min-h-svh bg-[#efede5] text-[#18302d]">
      <header className="sticky top-0 z-30 border-b border-[#18302d]/10 bg-[#fffdf8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                aria-label="بازگشت به مهارت‌ها"
                className="rounded-md px-1 text-lg leading-none text-[#a14e32] hover:bg-[#f3dfd6]"
              >
                →
              </Link>
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#a14e32]">
                READING · PRACTICE
              </p>
            </div>
            <h1 className="truncate text-sm font-black sm:text-base">
              {test.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs font-bold text-[#687572] sm:inline">
              {saveError
                ? 'ذخیره نشد'
                : pendingSaves > 0
                  ? 'در حال ذخیره…'
                  : 'ذخیره شد'}
            </span>
            <span
              dir="ltr"
              className={`rounded-xl px-4 py-2 font-mono text-sm font-bold ${
                timeRemaining < 120
                  ? 'bg-red-100 text-red-700'
                  : 'bg-[#dcebe5] text-[#155e57]'
              }`}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:h-[calc(100svh-65px)] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
        <section
          aria-label="Reading passage"
          dir="ltr"
          className="border-b border-[#18302d]/10 bg-[#fffdf8] px-6 py-9 sm:px-10 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-12 xl:px-16"
        >
          {test.sections.flatMap((section) =>
            section.stimulus_bundles.map((bundle) => (
              <article key={bundle.id} className="mx-auto max-w-3xl">
                <div className="mb-9 border-b border-[#18302d]/15 pb-6">
                  <p className="font-mono text-xs tracking-[0.18em] text-[#a14e32]">
                    READING PASSAGE {section.number}
                  </p>
                  <h2 className="mt-3 font-serif text-4xl leading-tight font-bold text-[#18302d] sm:text-5xl">
                    {bundle.title}
                  </h2>
                </div>
                {bundle.documents.flatMap((document) =>
                  document.blocks.map((block) => (
                    <div
                      key={block.id}
                      id={`block-${block.id}`}
                      className="mb-6 grid grid-cols-[2rem_1fr] gap-3"
                    >
                      <span className="pt-1 font-mono text-sm font-bold text-[#a14e32]">
                        {block.label}
                      </span>
                      <p className="font-serif text-lg leading-8 text-[#30423f]">
                        {block.text_content}
                      </p>
                    </div>
                  )),
                )}
              </article>
            )),
          )}
        </section>

        <section
          aria-label="Reading questions"
          className="bg-[#efede5] px-4 py-6 sm:px-7 lg:overflow-y-auto lg:px-8"
        >
          <div className="mx-auto max-w-2xl space-y-5 pb-28">
            {groups.map((group) => (
              <article
                key={group.id}
                className="rounded-[1.6rem] border border-[#18302d]/10 bg-[#fffdf8] p-5 shadow-[0_12px_35px_rgba(24,48,45,0.05)] sm:p-6"
              >
                <p
                  dir="ltr"
                  className="mb-5 text-sm leading-6 font-semibold text-[#53635f]"
                >
                  {group.instructions}
                </p>
                <div className="space-y-7">
                  {group.response_slots.map((slot) => {
                    const result = resultByQuestion.get(slot.id)
                    return (
                      <fieldset
                        key={slot.id}
                        id={`question-${slot.display_number}`}
                        onFocus={() => setActiveQuestion(slot.display_number)}
                        className="scroll-mt-24"
                      >
                        <legend
                          dir="ltr"
                          className="mb-3 flex w-full items-start gap-3 text-left text-base leading-7 font-bold"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#18302d] font-mono text-xs text-white">
                            {slot.display_number}
                          </span>
                          <span>{slot.prompt}</span>
                        </legend>
                        <div className="grid gap-2 pl-0 sm:pl-11" dir="ltr">
                          {group.options.map((option) => (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-6 transition ${
                                answers[slot.id] === option.value
                                  ? 'border-[#155e57] bg-[#e5f0eb]'
                                  : 'border-[#18302d]/10 bg-white hover:border-[#155e57]/40'
                              }`}
                            >
                              <input
                                type="radio"
                                name={slot.id}
                                value={option.value}
                                checked={answers[slot.id] === option.value}
                                disabled={Boolean(evaluation)}
                                onChange={() =>
                                  chooseAnswer(group, slot.id, option.value)
                                }
                                className="mt-1 accent-[#155e57]"
                              />
                              <span>
                                <strong className="mr-2">{option.value}</strong>
                                {option.label}
                              </span>
                            </label>
                          ))}
                        </div>
                        {result && (
                          <div
                            className={`mt-3 rounded-xl p-3 text-sm leading-6 sm:ml-11 ${
                              result.result_code === 'correct'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-amber-50 text-amber-900'
                            }`}
                          >
                            <p className="font-bold">
                              {result.result_code === 'correct'
                                ? 'پاسخ درست است.'
                                : `پاسخ درست: ${String(result.correct_value)}`}
                            </p>
                            {result.evidence[0] && (
                              <a
                                href={`#block-${result.evidence[0].block_id}`}
                                className="mt-1 block underline decoration-dotted underline-offset-4"
                              >
                                شاهد: {result.evidence[0].quote}
                              </a>
                            )}
                          </div>
                        )}
                      </fieldset>
                    )
                  })}
                </div>
              </article>
            ))}

            {evaluation && (
              <section className="rounded-[1.6rem] bg-[#18302d] p-6 text-white sm:p-7">
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <p className="text-xs tracking-[0.16em] text-[#a8c7bf]">
                      RESULT
                    </p>
                    <h2 className="mt-2 text-2xl font-black">نتیجهٔ تمرین</h2>
                  </div>
                  <p
                    dir="ltr"
                    className="font-mono text-4xl font-black text-[#f0ac87]"
                  >
                    {evaluation.raw_score}/{evaluation.maximum_score}
                  </p>
                </div>
                {!feedback && (
                  <button
                    type="button"
                    onClick={getFeedback}
                    disabled={feedbackLoading}
                    className="mt-6 w-full rounded-xl bg-[#f0ac87] px-5 py-3 text-sm font-black text-[#3a2119] disabled:opacity-60"
                  >
                    {feedbackLoading ? 'در حال تحلیل…' : 'تحلیل فارسی با AI'}
                  </button>
                )}
                {feedback && (
                  <div className="mt-6 space-y-4 text-sm leading-7 text-[#e9f0ee]">
                    <p>{feedback.summary_fa}</p>
                    {feedback.strengths_fa.length > 0 && (
                      <div>
                        <p className="font-black text-[#a8c7bf]">نقاط قوت</p>
                        <ul className="mt-1 list-inside list-disc">
                          {feedback.strengths_fa.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {feedback.improvements_fa.length > 0 && (
                      <div>
                        <p className="font-black text-[#f0ac87]">تمرکز بعدی</p>
                        <ul className="mt-1 list-inside list-disc">
                          {feedback.improvements_fa.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="rounded-xl bg-white/8 p-3 font-bold">
                      {feedback.next_action_fa}
                    </p>
                    <p
                      dir="ltr"
                      className="font-mono text-[10px] text-[#8eaaa3]"
                    >
                      MODEL {feedback.model_id}{' '}
                      {feedback.cached ? '· CACHED' : ''}
                    </p>
                  </div>
                )}
              </section>
            )}

            {(error || saveError) && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
              >
                {saveError ?? error}
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[#18302d]/10 bg-[#fffdf8]/95 backdrop-blur lg:right-0 lg:left-[54%]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-7">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">
            {slots.map((slot) => {
              const result = resultByQuestion.get(slot.id)
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => goToQuestion(slot.display_number)}
                  aria-label={`رفتن به سؤال ${slot.display_number}`}
                  aria-current={
                    activeQuestion === slot.display_number ? 'step' : undefined
                  }
                  className={`grid size-9 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold transition ${
                    result
                      ? result.result_code === 'correct'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                      : activeQuestion === slot.display_number
                        ? 'bg-[#18302d] text-white'
                        : answers[slot.id]
                          ? 'bg-[#dcebe5] text-[#155e57]'
                          : 'bg-[#ece8dc] text-[#6f7a77]'
                  }`}
                >
                  {slot.display_number}
                </button>
              )
            })}
          </div>
          {!evaluation && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || pendingSaves > 0 || Boolean(saveError)}
              className="shrink-0 rounded-xl bg-[#e57d55] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {submitting ? 'در حال ثبت…' : 'پایان و تصحیح'}
            </button>
          )}
        </div>
      </footer>
    </main>
  )
}
