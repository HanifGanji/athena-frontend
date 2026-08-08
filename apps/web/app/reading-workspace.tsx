'use client'

import Link from 'next/link'
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'

import { useOptionalAuth } from '@/app/auth-provider'
import { StaffTestPreviewCard } from '@/app/staff-test-preview-card'
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

function compactTestIdentity(summary: ReadingTestSummary) {
  const cambridge = summary.source_title.match(
    /Cambridge IELTS\s+(\d+).*Reading Test\s+0*(\d+)/i,
  )
  if (cambridge) {
    return `IELTS ${cambridge[1]} · ${moduleLabel(summary.module)} · Reading ${Number(cambridge[2])}`
  }
  const reading = summary.source_title.match(
    /Reading (?:test|diagnostic)\s+0*(\d+)/i,
  )
  return `Athena · ${moduleLabel(summary.module)} · Reading ${reading ? Number(reading[1]) : ''}`.trim()
}

function isTextResponse(interactionType: string) {
  return interactionType === 'completion' || interactionType === 'short_answer'
}

type SelectionPopover = {
  placement: 'above' | 'below'
  text: string
  top: number
  left: number
}

function googleTranslateUrl(text: string) {
  const params = new URLSearchParams({
    sl: 'en',
    tl: 'fa',
    text,
    op: 'translate',
  })
  return `https://translate.google.com/?${params.toString()}`
}

export function ReadingWorkspace() {
  const auth = useOptionalAuth()
  const [tests, setTests] = useState<ReadingTestSummary[]>([])
  const [test, setTest] = useState<ReadingTest | null>(null)
  const [attempt, setAttempt] = useState<ReadingAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [feedback, setFeedback] = useState<AgentFeedback | null>(null)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<
    number | null
  >(null)
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(
    null,
  )
  const [selectionPopover, setSelectionPopover] =
    useState<SelectionPopover | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [startingSlug, setStartingSlug] = useState<string | null>(null)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const answersRef = useRef<Record<string, string>>({})
  const saveQueues = useRef(new Map<string, Promise<void>>())
  const saveFailures = useRef(new Map<string, string>())
  const passagePaneRef = useRef<HTMLElement>(null)
  const questionPaneRef = useRef<HTMLDivElement>(null)
  const selectionPopoverRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!selectionPopover) return
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (selectionPopoverRef.current?.contains(event.target as Node)) return
      setSelectionPopover(null)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectionPopover(null)
    }
    const dismissOnResize = () => setSelectionPopover(null)
    document.addEventListener('pointerdown', dismissOnPointerDown, true)
    document.addEventListener('keydown', dismissOnEscape)
    window.addEventListener('resize', dismissOnResize)
    return () => {
      document.removeEventListener('pointerdown', dismissOnPointerDown, true)
      document.removeEventListener('keydown', dismissOnEscape)
      window.removeEventListener('resize', dismissOnResize)
    }
  }, [selectionPopover])

  const sections = useMemo(
    () => [...(test?.sections ?? [])].sort((a, b) => a.sequence - b.sequence),
    [test],
  )
  const activeSection = sections[activeSectionIndex]
  const groups = useMemo(
    () => activeSection?.question_groups ?? [],
    [activeSection],
  )
  const questionSlots = useMemo(
    () =>
      groups
        .flatMap((group) => group.response_slots)
        .sort((a, b) => a.display_number - b.display_number),
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
        summary.experience_type === 'simulation' ? 'timed_mock' : 'practice',
      )
      setTest(testPayload)
      setAttempt(attemptPayload)
      answersRef.current = {}
      setAnswers({})
      setEvaluation(null)
      setFeedback(null)
      setHighlightedBlockId(null)
      setSelectionPopover(null)
      saveQueues.current.clear()
      saveFailures.current.clear()
      setSaveError(null)
      setActiveSectionIndex(0)
      setActiveQuestionNumber(null)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع تمرین ناموفق بود.',
      )
    } finally {
      setStartingSlug(null)
    }
  }

  async function openStaffPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const preview = await readingApi.getStaffPreview()
      const testPayload = await readingApi.getTest(preview.test_slug)
      const previewAnswers = Object.assign(
        {},
        ...preview.attempt.responses.map(
          (response) => response.answer_payload.answers,
        ),
      ) as Record<string, string>
      setTest(testPayload)
      setAttempt(preview.attempt)
      answersRef.current = previewAnswers
      setAnswers(previewAnswers)
      setEvaluation(preview.evaluation)
      setFeedback(null)
      setActiveSectionIndex(0)
      setActiveQuestionNumber(null)
      setHighlightedBlockId(null)
      setSelectionPopover(null)
      saveQueues.current.clear()
      saveFailures.current.clear()
      setSaveError(null)
    } catch (reason) {
      setPreviewError(
        reason instanceof Error
          ? reason.message
          : 'پیش‌نمایش کارکنان آماده نشد.',
      )
    } finally {
      setPreviewLoading(false)
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
    if (!attempt || saveError) return
    setSubmitting(true)
    setError(null)
    try {
      await Promise.all(saveQueues.current.values())
      if (saveFailures.current.size > 0) return
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

  function goToSection(sectionIndex: number) {
    setActiveSectionIndex(sectionIndex)
    setActiveQuestionNumber(null)
    setHighlightedBlockId(null)
    setSelectionPopover(null)
    const behavior: ScrollBehavior =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth'
    const scrollToPassage = () => {
      passagePaneRef.current?.scrollTo?.({ top: 0, behavior })
      questionPaneRef.current?.scrollTo?.({ top: 0, behavior })
      document
        .getElementById('reading-workspace-start')
        ?.scrollIntoView?.({ behavior, block: 'start' })
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToPassage)
    } else {
      window.setTimeout(scrollToPassage, 0)
    }
  }

  function goToQuestion(questionNumber: number) {
    setActiveQuestionNumber(questionNumber)
    setSelectionPopover(null)
    const behavior: ScrollBehavior =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth'
    const scrollToQuestion = () => {
      const target = document.getElementById(`question-${questionNumber}`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView?.({ behavior, block: 'start' })
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToQuestion)
    } else {
      window.setTimeout(scrollToQuestion, 0)
    }
  }

  function revealEvidence(
    event: MouseEvent<HTMLAnchorElement>,
    blockId: string,
  ) {
    event.preventDefault()
    setHighlightedBlockId(blockId)
    const behavior: ScrollBehavior =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth'
    const scrollToEvidence = () => {
      const target = document.getElementById(`block-${blockId}`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView?.({ behavior, block: 'center' })
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToEvidence)
    } else {
      window.setTimeout(scrollToEvidence, 0)
    }
  }

  function showSelectionPopover() {
    const selection = window.getSelection()
    const passagePane = passagePaneRef.current
    if (!selection || !passagePane || selection.rangeCount === 0) {
      setSelectionPopover(null)
      return
    }
    const range = selection.getRangeAt(0)
    if (!passagePane.contains(range.commonAncestorContainer)) {
      setSelectionPopover(null)
      return
    }
    const text = selection.toString().replace(/\s+/g, ' ').trim().slice(0, 500)
    if (!text) {
      setSelectionPopover(null)
      return
    }
    const rect = range.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const popoverHalfWidth = Math.min(176, Math.max(0, viewportWidth / 2 - 12))
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, popoverHalfWidth + 12),
      viewportWidth - popoverHalfWidth - 12,
    )
    const placement = rect.top >= 190 ? 'above' : 'below'
    setSelectionPopover({
      placement,
      text,
      left,
      top: placement === 'above' ? rect.top - 10 : rect.bottom + 10,
    })
  }

  if (initialLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#f4f1e8] p-6">
        <div className="flex items-center gap-3 text-sm font-bold text-[#155e57]">
          <span className="size-3 animate-pulse rounded-full bg-[#e57d55] motion-reduce:animate-none" />
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
              آزمون آکادمیک
            </span>
          </header>

          <section className="grid gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-24">
            <div>
              <p className="mb-5 text-sm font-bold text-[#a14e32]">
                آزمون و تمرین Reading
              </p>
              <h1 className="max-w-3xl text-5xl leading-[1.12] font-black tracking-[-0.04em] sm:text-7xl">
                سریع نخوان؛
                <span className="block text-[#155e57]">دقیق‌تر یاد بگیر.</span>
              </h1>
            </div>
            <p className="max-w-xl text-base leading-8 text-[#52625f] lg:text-lg">
              متن انگلیسی، پاسخ‌گویی در قالب آزمون و تحلیل فارسی مبتنی بر شواهد؛
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

          {auth?.user?.is_staff && (
            <StaffTestPreviewCard
              moduleLabel="Reading"
              loading={previewLoading}
              error={previewError}
              onOpen={() => void openStaffPreview()}
            />
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
                      <span className="rounded-full bg-[#18302d] px-3 py-1 text-white">
                        {summary.experience_type === 'simulation'
                          ? 'آزمون کامل'
                          : 'تمرین هدفمند'}
                      </span>
                      <span className="rounded-full bg-[#ece8dc] px-3 py-1 text-[#59635f]">
                        {Math.round(summary.time_limit_seconds / 60)} دقیقه
                      </span>
                    </div>
                    <h3 className="text-xl font-black sm:text-2xl">
                      {summary.title}
                    </h3>
                    <p
                      dir="ltr"
                      className="mt-2 font-mono text-[11px] font-bold tracking-[0.08em] text-[#a14e32]"
                    >
                      {compactTestIdentity(summary)}
                    </p>
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
                      : summary.experience_type === 'simulation'
                        ? 'شروع آزمون ←'
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
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-7">
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
                READING · {attempt.mode === 'timed_mock' ? 'TEST' : 'PRACTICE'}
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

      <aside
        aria-label="فهرست متن‌ها و سؤال‌های Reading"
        className="fixed top-16 bottom-0 left-0 z-20 flex w-16 flex-col items-center border-r border-[#18302d]/10 bg-[#fffdf8]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <nav
          aria-label="جابه‌جایی میان متن‌های Reading"
          className="flex shrink-0 flex-col items-center gap-2 px-2 pt-4 pb-3"
        >
          {sections.map((section, sectionIndex) => (
            <button
              key={section.id}
              type="button"
              onClick={() => goToSection(sectionIndex)}
              aria-label={`رفتن به متن ${section.number}`}
              aria-current={
                activeSectionIndex === sectionIndex ? 'page' : undefined
              }
              className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl font-mono text-sm font-bold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] motion-reduce:transition-none ${
                activeSectionIndex === sectionIndex
                  ? 'bg-[#18302d] text-white shadow-md shadow-[#18302d]/15'
                  : 'bg-[#ece8dc] text-[#59635f] hover:bg-[#dcebe5] hover:text-[#155e57]'
              }`}
            >
              {section.number}
            </button>
          ))}
        </nav>
        <div
          aria-hidden="true"
          className="w-8 shrink-0 border-t border-[#18302d]/20"
        />
        <nav
          aria-label="جابه‌جایی میان سؤال‌های متن فعال"
          className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-3"
        >
          {questionSlots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() => goToQuestion(slot.display_number)}
              aria-label={`رفتن به سؤال ${slot.display_number}`}
              aria-current={
                activeQuestionNumber === slot.display_number
                  ? 'location'
                  : undefined
              }
              className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full font-mono text-xs font-bold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] motion-reduce:transition-none ${
                activeQuestionNumber === slot.display_number
                  ? 'bg-[#e57d55] text-white shadow-sm shadow-[#e57d55]/25'
                  : answers[slot.id] !== undefined
                    ? 'bg-[#dcebe5] text-[#155e57] hover:bg-[#cce2da]'
                    : 'text-[#687572] hover:bg-[#ece8dc] hover:text-[#18302d]'
              }`}
            >
              {slot.display_number}
            </button>
          ))}
        </nav>
      </aside>

      <div
        id="reading-workspace-start"
        dir="ltr"
        className="mx-auto grid max-w-[1600px] scroll-mt-16 pl-16 lg:h-[calc(100svh-64px)] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]"
      >
        <section
          ref={passagePaneRef}
          aria-label="Reading passage"
          dir="ltr"
          onMouseUp={showSelectionPopover}
          onKeyUp={showSelectionPopover}
          onTouchEnd={() => window.setTimeout(showSelectionPopover, 0)}
          onScroll={() => setSelectionPopover(null)}
          className="select-text border-b border-[#18302d]/10 bg-[#fffdf8] px-6 py-9 sm:px-10 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-12 xl:px-16"
        >
          {activeSection?.stimulus_bundles.map((bundle) => (
            <article key={bundle.id} className="mx-auto max-w-3xl">
              <div className="mb-9 border-b border-[#18302d]/15 pb-6">
                <p className="font-mono text-xs tracking-[0.18em] text-[#a14e32]">
                  READING PASSAGE {activeSection.number}
                </p>
                <h2 className="mt-3 font-serif text-4xl leading-tight font-bold text-[#18302d] sm:text-5xl">
                  {bundle.title}
                </h2>
              </div>
              {bundle.documents.flatMap((document) =>
                document.blocks.map((block) => {
                  const isHighlighted = highlightedBlockId === block.id
                  return (
                    <div
                      key={block.id}
                      id={`block-${block.id}`}
                      tabIndex={-1}
                      aria-current={isHighlighted ? 'location' : undefined}
                      aria-label={
                        isHighlighted
                          ? `Paragraph ${block.label}, highlighted evidence`
                          : undefined
                      }
                      className={`mb-6 grid scroll-mt-24 grid-cols-[2rem_1fr] gap-3 rounded-xl outline-none transition-colors duration-300 motion-reduce:transition-none ${
                        isHighlighted
                          ? 'bg-emerald-100/80 ring-2 ring-emerald-500 ring-offset-4 ring-offset-[#fffdf8]'
                          : ''
                      }`}
                    >
                      <span
                        className={`pt-1 font-mono text-sm font-bold ${
                          isHighlighted ? 'text-emerald-800' : 'text-[#a14e32]'
                        }`}
                      >
                        {block.label}
                      </span>
                      <p
                        className={`font-serif text-lg leading-8 ${
                          isHighlighted ? 'text-emerald-950' : 'text-[#30423f]'
                        }`}
                      >
                        {block.text_content}
                      </p>
                    </div>
                  )
                }),
              )}
            </article>
          ))}
        </section>

        <section
          aria-label="Reading questions"
          dir="rtl"
          className="flex min-h-0 flex-col overflow-hidden bg-[#efede5]"
        >
          <div
            ref={questionPaneRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7 lg:px-8"
          >
            <div className="mx-auto max-w-2xl space-y-5 pb-4">
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
                      const evidence = result?.evidence[0]
                      const slotOptions =
                        slot.options?.length > 0 ? slot.options : group.options
                      return (
                        <fieldset
                          key={slot.id}
                          id={`question-${slot.display_number}`}
                          tabIndex={-1}
                          aria-current={
                            activeQuestionNumber === slot.display_number
                              ? 'location'
                              : undefined
                          }
                          onFocusCapture={() =>
                            setActiveQuestionNumber(slot.display_number)
                          }
                          className="scroll-mt-24 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#155e57] focus-visible:ring-offset-4"
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
                            {isTextResponse(group.interaction_type) ? (
                              <input
                                type="text"
                                value={answers[slot.id] ?? ''}
                                disabled={Boolean(evaluation)}
                                aria-label={`Answer for question ${slot.display_number}`}
                                onChange={(event) => {
                                  const nextAnswers = {
                                    ...answersRef.current,
                                    [slot.id]: event.target.value,
                                  }
                                  answersRef.current = nextAnswers
                                  setAnswers(nextAnswers)
                                }}
                                onBlur={(event) =>
                                  chooseAnswer(
                                    group,
                                    slot.id,
                                    event.target.value,
                                  )
                                }
                                className="min-h-12 rounded-xl border border-[#18302d]/15 bg-white px-4 py-3 text-left text-base outline-none transition focus:border-[#155e57] focus:ring-3 focus:ring-[#155e57]/12 disabled:bg-[#ece8dc]"
                                placeholder="Type your answer"
                              />
                            ) : group.interaction_type === 'matching' ? (
                              <select
                                value={answers[slot.id] ?? ''}
                                disabled={Boolean(evaluation)}
                                aria-label={`Answer for question ${slot.display_number}`}
                                onChange={(event) =>
                                  chooseAnswer(
                                    group,
                                    slot.id,
                                    event.target.value,
                                  )
                                }
                                className="min-h-12 rounded-xl border border-[#18302d]/15 bg-white px-4 py-3 text-left text-sm outline-none transition focus:border-[#155e57] focus:ring-3 focus:ring-[#155e57]/12 disabled:bg-[#ece8dc]"
                              >
                                <option value="">Select an answer</option>
                                {slotOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.value} — {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              slotOptions.map((option) => (
                                <label
                                  key={option.value}
                                  className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-6 transition ${
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
                                    <strong className="mr-2">
                                      {option.value}
                                    </strong>
                                    {option.label !== option.value
                                      ? option.label
                                      : null}
                                  </span>
                                </label>
                              ))
                            )}
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
                              {evidence && (
                                <a
                                  href={`#block-${evidence.block_id}`}
                                  onClick={(event) =>
                                    revealEvidence(event, evidence.block_id)
                                  }
                                  className="mt-1 block rounded-md underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                                >
                                  شاهد: {evidence.quote}
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
                          <p className="font-black text-[#f0ac87]">
                            تمرکز بعدی
                          </p>
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
          </div>

          {!evaluation && (
            <footer
              aria-label="ارسال آزمون Reading"
              className="shrink-0 bg-[#efede5] px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-7 lg:px-8"
            >
              <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-[1.35rem] border border-[#18302d]/10 bg-[#fffdf8]/95 p-3 shadow-[0_14px_38px_rgba(24,48,45,0.10)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div className="hidden min-w-0 px-2 sm:block">
                  <p className="text-sm font-black text-[#18302d]">
                    آمادهٔ پایان آزمون؟
                  </p>
                  <p
                    aria-live="polite"
                    className="mt-1 text-xs leading-5 text-[#687572]"
                  >
                    {saveError
                      ? 'ابتدا مشکل ذخیرهٔ پاسخ را برطرف کنید.'
                      : pendingSaves > 0
                        ? 'در حال ذخیرهٔ پاسخ‌ها…'
                        : 'پاسخ‌های ثبت‌شده آمادهٔ بررسی‌اند.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    submitting || pendingSaves > 0 || Boolean(saveError)
                  }
                  className="min-h-12 w-full cursor-pointer rounded-xl bg-[#e57d55] px-6 py-3 text-base font-black text-white shadow-sm shadow-[#a14e32]/20 transition duration-200 hover:bg-[#d86f48] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a14e32] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none motion-reduce:transition-none sm:w-auto sm:min-w-52"
                >
                  {submitting ? 'در حال ثبت…' : 'پایان و تصحیح'}
                </button>
              </div>
            </footer>
          )}
        </section>
      </div>

      {selectionPopover && (
        <div
          ref={selectionPopoverRef}
          role="dialog"
          aria-label="معنی متن انتخاب‌شده"
          dir="rtl"
          style={{
            left: selectionPopover.left,
            top: selectionPopover.top,
          }}
          className={`fixed z-40 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-[#155e57]/20 bg-[#fffdf8] p-4 text-[#18302d] shadow-[0_18px_55px_rgba(24,48,45,0.22)] ${
            selectionPopover.placement === 'above' ? '-translate-y-full' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => setSelectionPopover(null)}
            aria-label="بستن پنجرهٔ معنی"
            className="absolute top-2 left-2 grid size-11 cursor-pointer place-items-center rounded-xl text-[#687572] transition hover:bg-[#ece8dc] hover:text-[#18302d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] motion-reduce:transition-none"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <p className="pl-11 text-xs font-black text-[#155e57]">
            معنی متن انتخاب‌شده
          </p>
          <p
            dir="ltr"
            className="mt-2 max-h-24 overflow-y-auto text-left font-serif text-sm leading-6 text-[#30423f]"
          >
            {selectionPopover.text}
          </p>
          <a
            href={googleTranslateUrl(selectionPopover.text)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#155e57] px-4 py-3 text-sm font-black text-white transition hover:bg-[#104b46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] motion-reduce:transition-none"
          >
            ترجمهٔ انگلیسی به فارسی
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 5h5v5M10 14L19 5M19 13v6H5V5h6" />
            </svg>
          </a>
          <p className="mt-2 text-center text-[11px] leading-5 text-[#687572]">
            نتیجه در Google Translate باز می‌شود.
          </p>
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {highlightedBlockId ? 'شاهد مرتبط در متن برجسته شد.' : ''}
      </p>
    </main>
  )
}
