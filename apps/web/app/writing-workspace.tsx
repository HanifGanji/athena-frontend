'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { absoluteApiUrl, ApiError } from '@/lib/api-client'
import {
  type WritingAttempt,
  type WritingAttemptSummary,
  type WritingEvaluation,
  type WritingExperienceMode,
  type WritingFeedback,
  type WritingModule,
  type WritingPromptSummary,
  type WritingProgressSkill,
  type WritingResponse,
  type WritingTaskType,
  type WritingTestSummary,
  writingApi,
} from '@/lib/writing-api'

const AUTOSAVE_DELAY_MS = 1_200

type DraftConflict = {
  taskId: string
  localText: string
  serverText: string
  serverRevision: number
  serverWordCount: number
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const clock = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
  return hours > 0 ? `${hours.toString().padStart(2, '0')}:${clock}` : clock
}

function countWords(text: string) {
  return (
    text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+(?:[.,]\d+)*/g)?.length ?? 0
  )
}

function moduleLabel(module: WritingModule) {
  return module === 'academic' ? 'Academic' : 'General Training'
}

function taskLabel(taskType: WritingTaskType) {
  if (taskType === 'task_2') return 'Task 2'
  return taskType === 'academic_task_1' ? 'Academic Task 1' : 'General Task 1'
}

function experienceLabel(mode: WritingExperienceMode) {
  return mode === 'exam' ? 'شبیه‌سازی آزمون' : 'یادگیری هدایت‌شده'
}

function attemptStatusLabel(status: WritingAttempt['status']) {
  if (status === 'in_progress') return 'ادامهٔ پیش‌نویس'
  if (status === 'evaluated') return 'دیدن تحلیل'
  if (status === 'evaluating') return 'در حال تحلیل'
  if (status === 'submitted') return 'آمادهٔ تحلیل'
  return 'پایان‌یافته'
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function feedbackKindLabel(kind: string) {
  if (kind === 'strength') return 'نقطهٔ قوت'
  if (kind === 'language_issue') return 'نکتهٔ زبانی'
  return 'فرصت بهبود'
}

function feedbackKindClasses(kind: string, active = false) {
  if (kind === 'strength') {
    return active
      ? 'border-emerald-500 bg-emerald-100 text-emerald-950'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950'
  }
  if (kind === 'language_issue') {
    return active
      ? 'border-violet-500 bg-violet-100 text-violet-950'
      : 'border-violet-200 bg-violet-50 text-violet-950'
  }
  return active
    ? 'border-amber-500 bg-amber-100 text-amber-950'
    : 'border-amber-200 bg-amber-50 text-amber-950'
}

function replaceTaskResponse(
  attempt: WritingAttempt,
  taskId: string,
  response: WritingResponse,
) {
  return {
    ...attempt,
    tasks: attempt.tasks.map((task) =>
      task.id === taskId ? { ...task, response } : task,
    ),
  }
}

function conflictFrom(error: unknown, taskId: string, localText: string) {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const payload = error.payload
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return null
  }
  const revision = payload.current_revision_number
  const text = payload.current_text
  const wordCount = payload.current_word_count
  if (
    typeof revision !== 'number' ||
    typeof text !== 'string' ||
    typeof wordCount !== 'number'
  ) {
    return null
  }
  return {
    taskId,
    localText,
    serverText: text,
    serverRevision: revision,
    serverWordCount: wordCount,
  }
}

type FeedbackItem = WritingEvaluation['feedback_items'][number]

type RewriteFocus = {
  titleFa: string
  excerpt: string
  suggestedRevision: string
}

type AnnotationRange = {
  start: number
  end: number
  item: FeedbackItem
}

function buildAnnotationRanges(text: string, items: FeedbackItem[]) {
  const candidates: AnnotationRange[] = []
  for (const item of items) {
    const start = item.start_offset
    const end = item.end_offset
    if (
      start === null ||
      end === null ||
      start < 0 ||
      end <= start ||
      end > text.length
    ) {
      continue
    }
    candidates.push({ start, end, item })
  }

  candidates.sort((left, right) => {
    const leftPriority = left.item.kind === 'strength' ? 1 : 0
    const rightPriority = right.item.kind === 'strength' ? 1 : 0
    return (
      leftPriority - rightPriority ||
      left.end - left.start - (right.end - right.start) ||
      left.start - right.start
    )
  })

  const selected: AnnotationRange[] = []
  for (const candidate of candidates) {
    const overlaps = selected.some(
      (range) => candidate.start < range.end && candidate.end > range.start,
    )
    if (!overlaps) selected.push(candidate)
  }
  return selected.sort((left, right) => left.start - right.start)
}

function bandLevelLabel(score: string) {
  const value = Number(score)
  if (value >= 7.5) return 'عملکرد قوی'
  if (value >= 6.5) return 'نزدیک به سطح ۷'
  if (value >= 5.5) return 'پایهٔ قابل توسعه'
  return 'نیازمند تمرین هدفمند'
}

function FeedbackDetail({
  evaluation,
  item,
  onDecision,
  onRewrite,
  pendingAction,
}: {
  evaluation: WritingEvaluation
  item: FeedbackItem
  onDecision: (
    item: FeedbackItem,
    decision: 'accepted' | 'fixed' | 'dismissed' | 'not_useful',
  ) => void
  onRewrite: (item: FeedbackItem) => void
  pendingAction: boolean
}) {
  const criterion = evaluation.criterion_results.find(
    (result) => result.code === item.criterion_code,
  )
  const isStrength = item.kind === 'strength'

  return (
    <article
      aria-live="polite"
      className={`rounded-[1.75rem] border p-5 shadow-[0_14px_38px_rgba(24,48,45,0.08)] sm:p-6 ${feedbackKindClasses(
        item.kind,
        true,
      )}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-[0.12em]">
        <span>{feedbackKindLabel(item.kind)}</span>
        {criterion && (
          <>
            <span aria-hidden="true">·</span>
            <span>{criterion.name_fa}</span>
          </>
        )}
      </div>
      <h4 className="mt-2 text-xl font-black">{item.title_fa}</h4>

      <div className="mt-5 rounded-2xl bg-white/75 p-4">
        <p className="text-xs font-black text-[#5d6966]">
          {isStrength ? 'چرا این بخش خوب کار می‌کند؟' : 'چرا این نکته مهم است؟'}
        </p>
        <p className="mt-2 text-sm leading-7 text-[#43514e]">
          {item.explanation_fa}
        </p>
      </div>

      {item.original_excerpt && (
        <div className="mt-4">
          <p className="text-xs font-black text-[#5d6966]">متن خودت</p>
          <blockquote
            dir="ltr"
            className="mt-2 border-l-2 border-current/30 pl-4 text-left font-serif text-base leading-7 text-[#253a36]"
          >
            {item.original_excerpt}
          </blockquote>
        </div>
      )}

      {!isStrength && item.suggested_revision && (
        <div className="mt-5 rounded-2xl bg-[#18302d] p-4 text-white">
          <p className="text-[10px] font-black tracking-[0.12em] text-[#f1a57d]">
            نسخهٔ دقیق‌تر
          </p>
          <p
            dir="ltr"
            className="mt-2 text-left font-serif text-base leading-7 text-[#f4f1e8]"
          >
            {item.suggested_revision}
          </p>
        </div>
      )}

      {!isStrength && (
        <div className="mt-5 border-t border-current/15 pt-4">
          <p className="text-xs font-black text-[#5d6966]">
            این نکته برایت چه وضعی دارد؟
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDecision(item, 'accepted')}
              disabled={pendingAction}
              aria-pressed={item.learner_decision?.decision === 'accepted'}
              className="min-h-11 rounded-xl border border-current/20 bg-white/80 px-4 py-2 text-xs font-black transition hover:bg-white disabled:opacity-50 aria-pressed:bg-[#18302d] aria-pressed:text-white"
            >
              فهمیدم
            </button>
            <button
              type="button"
              onClick={() => onDecision(item, 'fixed')}
              disabled={pendingAction}
              aria-pressed={item.learner_decision?.decision === 'fixed'}
              className="min-h-11 rounded-xl border border-current/20 bg-white/80 px-4 py-2 text-xs font-black transition hover:bg-white disabled:opacity-50 aria-pressed:bg-[#18302d] aria-pressed:text-white"
            >
              اصلاحش کردم
            </button>
            <button
              type="button"
              onClick={() => onDecision(item, 'not_useful')}
              disabled={pendingAction}
              aria-pressed={item.learner_decision?.decision === 'not_useful'}
              className="min-h-11 rounded-xl border border-current/20 bg-white/80 px-4 py-2 text-xs font-black transition hover:bg-white disabled:opacity-50 aria-pressed:bg-[#18302d] aria-pressed:text-white"
            >
              مفید نبود
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRewrite(item)}
            disabled={pendingAction}
            className="mt-3 min-h-11 w-full rounded-xl bg-[#18302d] px-4 py-3 text-sm font-black text-white transition hover:bg-[#24423e] disabled:opacity-50"
          >
            این بخش را خودم بازنویسی می‌کنم
          </button>
        </div>
      )}
    </article>
  )
}

function AnnotatedEssay({
  text,
  ranges,
  selectedSequence,
  onSelect,
}: {
  text: string
  ranges: AnnotationRange[]
  selectedSequence: number | null
  onSelect: (item: FeedbackItem) => void
}) {
  const segments: Array<{
    text: string
    item?: FeedbackItem
    key: string
  }> = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({
        text: text.slice(cursor, range.start),
        key: `plain-${cursor}`,
      })
    }
    segments.push({
      text: text.slice(range.start, range.end),
      item: range.item,
      key: `feedback-${range.item.sequence}`,
    })
    cursor = range.end
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), key: `plain-${cursor}` })
  }

  return (
    <p
      dir="ltr"
      className="whitespace-pre-wrap text-left font-serif text-[1.05rem] leading-9 text-[#2e3d3a]"
    >
      {segments.map((segment) =>
        segment.item ? (
          <button
            key={segment.key}
            type="button"
            aria-label={`نمایش بازخورد: ${segment.item.title_fa}`}
            aria-pressed={selectedSequence === segment.item.sequence}
            onClick={() => onSelect(segment.item!)}
            className={`rounded-md border-b-2 px-0.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] ${feedbackKindClasses(
              segment.item.kind,
              selectedSequence === segment.item.sequence,
            )}`}
          >
            {segment.text}
          </button>
        ) : (
          <span key={segment.key}>{segment.text}</span>
        ),
      )}
    </p>
  )
}

function EvaluationPanel({
  evaluation,
  submissionText,
  onDecision,
  onRewrite,
  pendingFeedbackItemId,
}: {
  evaluation: WritingEvaluation
  submissionText: string
  onDecision: (
    item: FeedbackItem,
    decision: 'accepted' | 'fixed' | 'dismissed' | 'not_useful',
  ) => void
  onRewrite: (item: FeedbackItem) => void
  pendingFeedbackItemId: string | null
}) {
  const defaultItem =
    evaluation.feedback_items.find((item) => item.kind !== 'strength') ??
    evaluation.feedback_items[0]
  const [selectedSequence, setSelectedSequence] = useState<number | null>(
    defaultItem?.sequence ?? null,
  )
  const selectedItem =
    evaluation.feedback_items.find(
      (item) => item.sequence === selectedSequence,
    ) ?? defaultItem
  const ranges = useMemo(
    () => buildAnnotationRanges(submissionText, evaluation.feedback_items),
    [evaluation.feedback_items, submissionText],
  )
  const strengths = evaluation.feedback_items.filter(
    (item) => item.kind === 'strength',
  ).length
  const improvements = evaluation.feedback_items.length - strengths

  return (
    <article className="space-y-8 rounded-[2rem] border border-[#18302d]/10 bg-[#fffdf8] p-5 shadow-[0_18px_55px_rgba(24,48,45,0.07)] sm:p-8">
      <header className="grid gap-6 border-b border-[#18302d]/10 pb-8 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[#a14e32]">
            ATHENA WRITING REVIEW
          </p>
          <h2 className="mt-2 text-3xl font-black">گزارش تحلیلی پاسخ تو</h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#52625f]">
            {evaluation.summary_fa}
          </p>
          {evaluation.examiner_comment_en && (
            <p
              dir="ltr"
              className="mt-5 max-w-3xl border-l-2 border-[#e57d55] pl-4 text-left font-serif text-base leading-7 italic text-[#43514e]"
            >
              {evaluation.examiner_comment_en}
            </p>
          )}
        </div>
        <div className="grid size-32 place-items-center rounded-[2rem] bg-[#18302d] text-center text-white shadow-[0_18px_42px_rgba(24,48,45,0.18)]">
          <div>
            <p className="font-mono text-4xl font-black text-[#f1a57d]">
              {evaluation.estimated_band_score}
            </p>
            <p className="mt-1 text-[10px] tracking-[0.16em] text-[#b9cbc7]">
              ESTIMATE
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby={`criteria-${evaluation.submission_id}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-[#71807c]">
              INDEPENDENT CRITERIA
            </p>
            <h3
              id={`criteria-${evaluation.submission_id}`}
              className="mt-1 text-xl font-black"
            >
              هر مهارت جداگانه بررسی شده است
            </h3>
          </div>
          <p className="text-xs leading-6 text-[#71807c]">
            نمره‌ها تخمینی‌اند و با شواهد همین متن سنجیده شده‌اند.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {evaluation.criterion_results.map((criterion) => (
            <div
              key={criterion.code}
              className="rounded-2xl border border-[#18302d]/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black">{criterion.name_fa}</p>
                  <p
                    dir="ltr"
                    className="mt-1 text-left text-xs text-[#71807c]"
                  >
                    {criterion.name_en}
                  </p>
                </div>
                <span className="rounded-xl bg-[#dcebe5] px-3 py-2 font-mono text-lg font-black text-[#155e57]">
                  {criterion.band_score}
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e8eeeb]">
                <div
                  className="h-full rounded-full bg-[#155e57]"
                  style={{
                    width: `${Math.min(100, (Number(criterion.band_score) / 9) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs font-black text-[#155e57]">
                {bandLevelLabel(criterion.band_score)}
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5c6966]">
                {criterion.rationale_fa}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby={`annotated-${evaluation.submission_id}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-[#71807c]">
              EVIDENCE-BASED REVIEW
            </p>
            <h3
              id={`annotated-${evaluation.submission_id}`}
              className="mt-1 text-2xl font-black"
            >
              پاسخ تو با نکته‌های قابل بررسی
            </h3>
            <p className="mt-2 text-sm leading-7 text-[#64716e]">
              روی بخش‌های رنگی بزن؛ توضیح دقیق و نسخهٔ بهتر همان بخش باز می‌شود.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-black">
            <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-900">
              {strengths} نقطهٔ قوت
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-2 text-amber-950">
              {improvements} نکتهٔ قابل بهبود
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <div className="rounded-[1.75rem] border border-[#18302d]/10 bg-white p-5 sm:p-7">
            <AnnotatedEssay
              text={submissionText}
              ranges={ranges}
              selectedSequence={selectedSequence}
              onSelect={(item) => setSelectedSequence(item.sequence)}
            />
            <div className="mt-7 border-t border-[#18302d]/10 pt-5">
              <p className="text-xs font-black text-[#64716e]">فهرست نکته‌ها</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {evaluation.feedback_items.map((item, index) => (
                  <button
                    key={item.sequence}
                    type="button"
                    aria-pressed={selectedSequence === item.sequence}
                    onClick={() => setSelectedSequence(item.sequence)}
                    className={`rounded-full border px-3 py-2 text-xs font-black transition ${feedbackKindClasses(
                      item.kind,
                      selectedSequence === item.sequence,
                    )}`}
                  >
                    {index + 1}. {item.title_fa}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedItem && (
            <div className="lg:sticky lg:top-6">
              <FeedbackDetail
                evaluation={evaluation}
                item={selectedItem}
                onDecision={onDecision}
                onRewrite={onRewrite}
                pendingAction={pendingFeedbackItemId === selectedItem.id}
              />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-[#18302d] p-5 text-white sm:p-6">
        <p className="text-xs font-bold tracking-[0.16em] text-[#f1a57d]">
          NEXT PRACTICE
        </p>
        <h3 className="mt-2 text-xl font-black">برنامهٔ بهبود پیشنهادی</h3>
        <ol className="mt-5 space-y-4">
          {evaluation.recommendations.map((recommendation) => (
            <li
              key={recommendation.sequence}
              className="grid grid-cols-[2rem_1fr] gap-3"
            >
              <span className="grid size-8 place-items-center rounded-full bg-[#f1a57d] font-mono text-xs font-black text-[#18302d]">
                {recommendation.priority}
              </span>
              <div>
                <p className="font-black">{recommendation.title_fa}</p>
                <p className="mt-1 text-sm leading-7 text-[#d5e1de]">
                  {recommendation.action_fa}
                </p>
                <p className="mt-1 text-xs leading-6 text-[#9fb7b2]">
                  چرا؟ {recommendation.reason_fa}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </article>
  )
}

export function WritingWorkspace() {
  const [prompts, setPrompts] = useState<WritingPromptSummary[]>([])
  const [tests, setTests] = useState<WritingTestSummary[]>([])
  const [attemptHistory, setAttemptHistory] = useState<WritingAttemptSummary[]>(
    [],
  )
  const [progressSkills, setProgressSkills] = useState<WritingProgressSkill[]>(
    [],
  )
  const [experienceMode, setExperienceMode] =
    useState<WritingExperienceMode>('exam')
  const [attempt, setAttempt] = useState<WritingAttempt | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({})
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [startingSlug, setStartingSlug] = useState<string | null>(null)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [planSaving, setPlanSaving] = useState(false)
  const [pausingAttempt, setPausingAttempt] = useState(false)
  const [resumingAttemptId, setResumingAttemptId] = useState<string | null>(
    null,
  )
  const [pendingFeedbackItemId, setPendingFeedbackItemId] = useState<
    string | null
  >(null)
  const [rewriteFocus, setRewriteFocus] = useState<RewriteFocus | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [resumeNotice, setResumeNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState<DraftConflict | null>(null)

  const attemptRef = useRef<WritingAttempt | null>(null)
  const draftsRef = useRef<Record<string, string>>({})
  const revisionsRef = useRef(new Map<string, number>())
  const savedTextRef = useRef(new Map<string, string>())
  const saveTimers = useRef(new Map<string, number>())
  const saveQueues = useRef(new Map<string, Promise<void>>())
  const pendingTaskSaves = useRef(new Map<string, number>())

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      writingApi.listPrompts(controller.signal),
      writingApi.listTests(controller.signal),
      writingApi.listAttempts(controller.signal),
      writingApi.getProgress(controller.signal),
    ])
      .then(([promptPayload, testPayload, attemptPayload, progressPayload]) => {
        setPrompts(promptPayload)
        setTests(testPayload)
        setAttemptHistory(attemptPayload)
        setProgressSkills(progressPayload.skills)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError')
          return
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت تمرین‌های Writing ناموفق بود.',
        )
      })
      .finally(() => setInitialLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(
    () => () => {
      for (const timer of saveTimers.current.values()) {
        window.clearTimeout(timer)
      }
    },
    [],
  )

  useEffect(() => {
    if (
      !attempt ||
      attempt.status !== 'in_progress' ||
      attempt.experience?.timer_enabled === false
    )
      return
    const startedAt = new Date(attempt.started_at).getTime()
    const update = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      )
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [attempt])

  function hydrateAttempt(
    payload: WritingAttempt,
    nextRewriteFocus: RewriteFocus | null = null,
  ) {
    const nextDrafts = Object.fromEntries(
      payload.tasks.map((task) => [task.id, task.response.draft_text]),
    )
    const nextPlanDrafts = Object.fromEntries(
      payload.tasks.flatMap((task) =>
        task.prompt.planning_questions.map((question) => [
          question.id,
          task.plan?.entries.find((entry) => entry.question_id === question.id)
            ?.text_content ?? '',
        ]),
      ),
    )
    attemptRef.current = payload
    draftsRef.current = nextDrafts
    revisionsRef.current = new Map(
      payload.tasks.map((task) => [
        task.id,
        task.response.draft_revision_number,
      ]),
    )
    savedTextRef.current = new Map(
      payload.tasks.map((task) => [task.id, task.response.draft_text]),
    )
    setAttempt(payload)
    setDrafts(nextDrafts)
    setPlanDrafts(nextPlanDrafts)
    setActiveTaskId(payload.tasks[0]?.id ?? null)
    setFeedback(null)
    setConflict(null)
    setSaveError(null)
    setResumeNotice(null)
    setReviewing(false)
    setElapsedSeconds(0)
    setRewriteFocus(nextRewriteFocus)
  }

  async function startPrompt(prompt: WritingPromptSummary) {
    setStartingSlug(prompt.slug)
    setError(null)
    try {
      hydrateAttempt(await writingApi.startPrompt(prompt.slug, experienceMode))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع تمرین ناموفق بود.',
      )
    } finally {
      setStartingSlug(null)
    }
  }

  async function startTest(test: WritingTestSummary) {
    setStartingSlug(test.slug)
    setError(null)
    try {
      hydrateAttempt(await writingApi.startTest(test.slug, experienceMode))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع آزمون ناموفق بود.',
      )
    } finally {
      setStartingSlug(null)
    }
  }

  async function resumeAttempt(attemptId: string) {
    setResumingAttemptId(attemptId)
    setError(null)
    try {
      hydrateAttempt(await writingApi.getAttempt(attemptId))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'بازکردن تمرین ناموفق بود.',
      )
    } finally {
      setResumingAttemptId(null)
    }
  }

  const persistDraft = useCallback(
    (taskId: string, text: string, saveKind: 'autosave' | 'manual') => {
      const currentAttempt = attemptRef.current
      if (!currentAttempt || currentAttempt.status !== 'in_progress') {
        return Promise.resolve()
      }
      const taskPending = pendingTaskSaves.current.get(taskId) ?? 0
      if (text === savedTextRef.current.get(taskId) && taskPending === 0) {
        return Promise.resolve()
      }
      pendingTaskSaves.current.set(taskId, taskPending + 1)
      setPendingSaves((count) => count + 1)
      const previous = saveQueues.current.get(taskId) ?? Promise.resolve()
      const queued = previous
        .catch(() => undefined)
        .then(async () => {
          const activeAttempt = attemptRef.current
          if (!activeAttempt || activeAttempt.status !== 'in_progress') return
          const expectedRevision = revisionsRef.current.get(taskId) ?? 0
          const eventId = crypto.randomUUID()
          const save = () =>
            writingApi.saveDraft(activeAttempt.id, taskId, {
              client_event_id: eventId,
              expected_revision_number: expectedRevision,
              text,
              save_kind: saveKind,
            })
          let result
          try {
            result = await save()
          } catch (reason) {
            if (!(reason instanceof TypeError)) throw reason
            result = await save()
          }
          revisionsRef.current.set(
            taskId,
            result.response.draft_revision_number,
          )
          savedTextRef.current.set(taskId, result.response.draft_text)
          setSaveError(null)
          setAttempt((current) => {
            if (!current) return current
            const next = replaceTaskResponse(current, taskId, result.response)
            attemptRef.current = next
            return next
          })
        })
        .catch((reason: unknown) => {
          const foundConflict = conflictFrom(reason, taskId, text)
          if (foundConflict) {
            setConflict(foundConflict)
            setSaveError('نسخهٔ جدیدتری از این پیش‌نویس پیدا شد.')
          } else {
            setSaveError(
              reason instanceof Error
                ? reason.message
                : 'ذخیرهٔ پیش‌نویس ناموفق بود.',
            )
          }
          throw reason
        })
        .finally(() => {
          const remaining = Math.max(
            0,
            (pendingTaskSaves.current.get(taskId) ?? 1) - 1,
          )
          if (remaining === 0) pendingTaskSaves.current.delete(taskId)
          else pendingTaskSaves.current.set(taskId, remaining)
          setPendingSaves((count) => Math.max(0, count - 1))
        })
      saveQueues.current.set(taskId, queued)
      return queued
    },
    [],
  )

  function changeDraft(taskId: string, text: string) {
    draftsRef.current = { ...draftsRef.current, [taskId]: text }
    setDrafts(draftsRef.current)
    const existingTimer = saveTimers.current.get(taskId)
    if (existingTimer) window.clearTimeout(existingTimer)
    if (conflict?.taskId === taskId) return
    const timer = window.setTimeout(() => {
      saveTimers.current.delete(taskId)
      void persistDraft(taskId, text, 'autosave').catch(() => undefined)
    }, AUTOSAVE_DELAY_MS)
    saveTimers.current.set(taskId, timer)
  }

  async function saveManually(taskId: string) {
    const timer = saveTimers.current.get(taskId)
    if (timer) window.clearTimeout(timer)
    saveTimers.current.delete(taskId)
    await persistDraft(taskId, draftsRef.current[taskId] ?? '', 'manual').catch(
      () => undefined,
    )
  }

  async function flushDrafts() {
    const currentAttempt = attemptRef.current
    if (!currentAttempt) return
    for (const timer of saveTimers.current.values()) window.clearTimeout(timer)
    saveTimers.current.clear()
    const saves = currentAttempt.tasks.map((task) =>
      persistDraft(task.id, draftsRef.current[task.id] ?? '', 'manual'),
    )
    await Promise.all(saves)
  }

  useEffect(() => {
    const saveLatestDraftsWhenHidden = () => {
      const currentAttempt = attemptRef.current
      if (
        !document.hidden ||
        !currentAttempt ||
        currentAttempt.status !== 'in_progress' ||
        conflict
      ) {
        return
      }
      for (const task of currentAttempt.tasks) {
        const timer = saveTimers.current.get(task.id)
        if (timer) window.clearTimeout(timer)
        saveTimers.current.delete(task.id)
        void persistDraft(
          task.id,
          draftsRef.current[task.id] ?? '',
          'autosave',
        ).catch(() => undefined)
      }
    }

    document.addEventListener('visibilitychange', saveLatestDraftsWhenHidden)
    return () =>
      document.removeEventListener(
        'visibilitychange',
        saveLatestDraftsWhenHidden,
      )
  }, [conflict, persistDraft])

  useEffect(() => {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || currentAttempt.status !== 'in_progress') return

    const draftChanged = currentAttempt.tasks.some(
      (task) =>
        (draftsRef.current[task.id] ?? '') !==
        (savedTextRef.current.get(task.id) ?? ''),
    )
    const planChanged = currentAttempt.tasks.some((task) =>
      task.prompt.planning_questions.some((question) => {
        const savedEntry = task.plan?.entries.find(
          (entry) => entry.question_id === question.id,
        )
        return (
          (planDrafts[question.id] ?? '') !== (savedEntry?.text_content ?? '')
        )
      }),
    )
    if (!draftChanged && !planChanged && pendingSaves === 0) return

    const protectUnsavedWork = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectUnsavedWork)
    return () => window.removeEventListener('beforeunload', protectUnsavedWork)
  }, [attempt, drafts, pendingSaves, planDrafts])

  async function confirmSubmission() {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || conflict) return
    setSubmitting(true)
    setError(null)
    try {
      await flushDrafts()
      const submitted = await writingApi.submitAttempt(
        currentAttempt.id,
        elapsedSeconds,
      )
      attemptRef.current = submitted
      setAttempt(submitted)
      setReviewing(false)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت نهایی پاسخ ناموفق بود.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function requestFeedback() {
    const currentAttempt = attemptRef.current
    if (!currentAttempt) return
    setFeedbackLoading(true)
    setError(null)
    try {
      const payload = await writingApi.requestFeedback(currentAttempt.id)
      setFeedback(payload)
      const next = {
        ...currentAttempt,
        status: 'evaluated' as const,
        result: payload.result ?? undefined,
      }
      attemptRef.current = next
      setAttempt(next)
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 429) {
        setError(
          'سهم بازخورد هوشمند امروزت کامل شده است. تمرین و ذخیره همچنان باز است؛ فردا می‌توانی تحلیل تازه بگیری.',
        )
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت بازخورد ناموفق بود.',
        )
      }
    } finally {
      setFeedbackLoading(false)
    }
  }

  async function persistGuidedPlan(
    task: WritingAttempt['tasks'][number],
    markComplete: boolean,
  ) {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || task.prompt.planning_questions.length === 0) return
    const payload = await writingApi.savePlan(currentAttempt.id, task.id, {
      expected_revision_number: task.plan?.revision_number ?? 0,
      entries: task.prompt.planning_questions.map((question) => ({
        question_id: question.id,
        text: planDrafts[question.id] ?? '',
      })),
      mark_complete: markComplete,
    })
    setAttempt((current) => {
      if (!current) return current
      const next = {
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === task.id ? { ...item, plan: payload.plan } : item,
        ),
      }
      attemptRef.current = next
      return next
    })
  }

  async function completeGuidedPlan() {
    const task = attemptRef.current?.tasks.find(
      (item) => item.id === activeTaskId,
    )
    if (!task) return
    setPlanSaving(true)
    setError(null)
    try {
      await persistGuidedPlan(task, true)
    } catch {
      setError(
        'نقشهٔ پاسخ هنوز ذخیره نشده است. نوشته‌هایت روی همین صفحه مانده‌اند؛ دوباره تلاش کن.',
      )
    } finally {
      setPlanSaving(false)
    }
  }

  async function pauseAttempt() {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || currentAttempt.status !== 'in_progress' || conflict)
      return
    setPausingAttempt(true)
    setError(null)
    try {
      for (const task of currentAttempt.tasks) {
        if (
          task.prompt.planning_questions.length > 0 &&
          task.plan?.status !== 'complete'
        ) {
          await persistGuidedPlan(task, false)
        }
      }
      await flushDrafts()

      const savedAttempt = attemptRef.current ?? currentAttempt
      const savedDrafts = { ...draftsRef.current }
      const refreshedHistory = await writingApi.listAttempts().catch(() => null)
      resetWorkspace()
      if (refreshedHistory) {
        setAttemptHistory(refreshedHistory)
      } else {
        const fallback: WritingAttemptSummary = {
          id: savedAttempt.id,
          mode: savedAttempt.mode,
          experience_mode: savedAttempt.experience_mode,
          status: savedAttempt.status,
          title:
            savedAttempt.mode === 'full_mock'
              ? 'آزمون کامل Writing'
              : (savedAttempt.tasks[0]?.prompt.title ?? 'تمرین Writing'),
          task_type:
            savedAttempt.mode === 'single_task'
              ? (savedAttempt.tasks[0]?.prompt.task_type ?? null)
              : null,
          word_count: savedAttempt.tasks.reduce(
            (sum, task) =>
              sum +
              countWords(savedDrafts[task.id] ?? task.response.draft_text),
            0,
          ),
          estimated_band_score: null,
          started_at: savedAttempt.started_at,
          last_activity_at: new Date().toISOString(),
          submitted_at: null,
        }
        setAttemptHistory((current) => [
          fallback,
          ...current.filter((item) => item.id !== fallback.id),
        ])
      }
      setResumeNotice(
        'همهٔ تغییرها ذخیره شد. هر زمان آماده بودی، از «مسیر Writing تو» ادامه بده.',
      )
    } catch {
      setError(
        'خروج امن کامل نشد. صفحه را باز نگه دار و دوباره «ذخیره و خروج» را بزن تا چیزی از دست نرود.',
      )
    } finally {
      setPausingAttempt(false)
    }
  }

  async function decideOnFeedback(
    item: FeedbackItem,
    decision: 'accepted' | 'fixed' | 'dismissed' | 'not_useful',
  ) {
    setPendingFeedbackItemId(item.id)
    setError(null)
    try {
      await writingApi.setFeedbackDecision(item.id, decision)
      setFeedback((current) =>
        current
          ? {
              ...current,
              evaluations: current.evaluations.map((evaluation) => ({
                ...evaluation,
                feedback_items: evaluation.feedback_items.map((feedbackItem) =>
                  feedbackItem.id === item.id
                    ? {
                        ...feedbackItem,
                        learner_decision: { decision, note: '' },
                      }
                    : feedbackItem,
                ),
              })),
            }
          : current,
      )
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'ثبت وضعیت بازخورد ناموفق بود.',
      )
    } finally {
      setPendingFeedbackItemId(null)
    }
  }

  async function startRewrite(
    evaluation: WritingEvaluation,
    item: FeedbackItem,
  ) {
    setPendingFeedbackItemId(item.id)
    setError(null)
    try {
      const rewriteAttempt = await writingApi.startRewrite(
        evaluation.submission_id,
        item.id,
      )
      hydrateAttempt(rewriteAttempt, {
        titleFa: item.title_fa,
        excerpt: item.original_excerpt,
        suggestedRevision: item.suggested_revision,
      })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع بازنویسی ناموفق بود.',
      )
    } finally {
      setPendingFeedbackItemId(null)
    }
  }

  function useServerDraft() {
    if (!conflict) return
    revisionsRef.current.set(conflict.taskId, conflict.serverRevision)
    savedTextRef.current.set(conflict.taskId, conflict.serverText)
    draftsRef.current = {
      ...draftsRef.current,
      [conflict.taskId]: conflict.serverText,
    }
    setDrafts(draftsRef.current)
    setAttempt((current) => {
      if (!current) return current
      const task = current.tasks.find((item) => item.id === conflict.taskId)
      if (!task) return current
      const next = replaceTaskResponse(current, conflict.taskId, {
        ...task.response,
        draft_text: conflict.serverText,
        draft_revision_number: conflict.serverRevision,
        draft_word_count: conflict.serverWordCount,
        updated_at: new Date().toISOString(),
      })
      attemptRef.current = next
      return next
    })
    setConflict(null)
    setSaveError(null)
  }

  async function keepLocalDraft() {
    if (!conflict) return
    const selected = conflict
    revisionsRef.current.set(selected.taskId, selected.serverRevision)
    savedTextRef.current.set(selected.taskId, selected.serverText)
    setConflict(null)
    setSaveError(null)
    await persistDraft(selected.taskId, selected.localText, 'manual').catch(
      () => undefined,
    )
  }

  function resetWorkspace() {
    for (const timer of saveTimers.current.values()) window.clearTimeout(timer)
    saveTimers.current.clear()
    saveQueues.current.clear()
    pendingTaskSaves.current.clear()
    attemptRef.current = null
    draftsRef.current = {}
    revisionsRef.current.clear()
    savedTextRef.current.clear()
    setAttempt(null)
    setDrafts({})
    setPlanDrafts({})
    setActiveTaskId(null)
    setFeedback(null)
    setError(null)
    setSaveError(null)
    setResumeNotice(null)
    setConflict(null)
  }

  const activeTask = attempt?.tasks.find((task) => task.id === activeTaskId)
  const totalTime =
    attempt?.tasks.reduce(
      (sum, task) => sum + task.recommended_time_seconds,
      0,
    ) ?? 0
  const timeRemaining = totalTime - elapsedSeconds
  const currentWordCount = activeTask
    ? countWords(drafts[activeTask.id] ?? '')
    : 0

  const submissionSummary = useMemo(
    () =>
      attempt?.tasks.map((task) => ({
        id: task.id,
        taskNumber: task.task_number,
        words: countWords(drafts[task.id] ?? ''),
        minimum: task.prompt.minimum_word_count,
      })) ?? [],
    [attempt, drafts],
  )

  if (initialLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#f4f1e8] p-6">
        <div className="flex items-center gap-3 text-sm font-bold text-[#5d3d73]">
          <span className="size-3 animate-pulse rounded-full bg-[#e57d55]" />
          در حال آماده‌سازی Writing…
        </div>
      </main>
    )
  }

  if (!attempt || !activeTask) {
    return (
      <main className="min-h-svh overflow-hidden bg-[#f4f1e8] text-[#18302d]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-14">
          <header className="flex items-center justify-between border-b border-[#18302d]/15 pb-5">
            <Link href="/" aria-label="بازگشت به صفحهٔ اصلی">
              <p className="font-mono text-[11px] tracking-[0.25em] text-[#8f4f54]">
                ATHENA · WRITING STUDIO
              </p>
              <p className="mt-1 text-2xl font-black">آتنا</p>
            </Link>
            <span className="rounded-full border border-[#5d3d73]/20 bg-white/60 px-4 py-2 text-xs font-bold text-[#5d3d73]">
              تمرین + بازخورد ساختاریافته
            </span>
          </header>

          <section className="grid gap-10 py-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-end lg:py-24">
            <div>
              <p className="mb-5 text-sm font-bold text-[#8f4f54]">
                IELTS Writing Practice
              </p>
              <h1 className="max-w-3xl text-5xl leading-[1.12] font-black tracking-[-0.04em] sm:text-7xl">
                فقط ننویس؛
                <span className="block text-[#5d3d73]">
                  منطقی‌تر بازنویسی کن.
                </span>
              </h1>
            </div>
            <div>
              <p className="max-w-xl text-base leading-8 text-[#52625f] lg:text-lg">
                تجربه‌ای نزدیک به آزمون، ذخیرهٔ امن پیش‌نویس و تحلیل فارسی روی
                چهار معیار اصلی IELTS؛ نمره‌ها تخمینی‌اند، نه نتیجهٔ رسمی.
              </p>
              <p className="mt-4 rounded-2xl bg-[#ece3f1] px-4 py-3 text-xs leading-6 text-[#5d3d73]">
                نوشتن و ذخیره‌کردن محدودیت مصرف AI ندارد. تحلیل هوشمند فقط بعد
                از درخواست خودت اجرا می‌شود و سقف روزانه دارد.
              </p>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-800"
            >
              {error}
            </div>
          )}

          {resumeNotice && (
            <div
              role="status"
              className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900"
            >
              <span aria-hidden="true" className="text-lg">
                ✓
              </span>
              <span>{resumeNotice}</span>
            </div>
          )}

          <section
            aria-labelledby="writing-mode-title"
            className="mb-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"
          >
            <div className="rounded-[2rem] border border-[#18302d]/10 bg-[#fffdf8] p-5 shadow-[0_16px_50px_rgba(24,48,45,0.06)] sm:p-7">
              <p className="text-xs font-bold tracking-[0.16em] text-[#8f4f54]">
                CHOOSE YOUR EXPERIENCE
              </p>
              <h2 id="writing-mode-title" className="mt-2 text-2xl font-black">
                امروز چطور می‌خواهی تمرین کنی؟
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      mode: 'exam' as const,
                      title: 'شبیه‌سازی آزمون',
                      description:
                        'حالت پیش‌فرض؛ تایمر واقعی، بدون راهنمایی هنگام نوشتن.',
                      badge: 'پیشنهادی',
                    },
                    {
                      mode: 'guided' as const,
                      title: 'یادگیری هدایت‌شده',
                      description:
                        'نقشهٔ کوتاه پاسخ، نوشتن مستقل و بازنویسی بعد از تحلیل.',
                      badge: 'بدون AI قبل از ثبت',
                    },
                  ] satisfies Array<{
                    mode: WritingExperienceMode
                    title: string
                    description: string
                    badge: string
                  }>
                ).map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    aria-pressed={experienceMode === option.mode}
                    onClick={() => setExperienceMode(option.mode)}
                    className={`min-h-36 rounded-2xl border p-5 text-right transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e57] ${
                      experienceMode === option.mode
                        ? 'border-[#5d3d73] bg-[#ece3f1] shadow-[0_10px_28px_rgba(93,61,115,0.12)]'
                        : 'border-[#18302d]/10 bg-white hover:border-[#5d3d73]/35'
                    }`}
                  >
                    <span className="text-[10px] font-black tracking-[0.08em] text-[#8f4f54]">
                      {option.badge}
                    </span>
                    <span className="mt-2 block text-lg font-black">
                      {option.title}
                    </span>
                    <span className="mt-2 block text-xs leading-6 text-[#5f6e6a]">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-[#18302d] p-5 text-white sm:p-7">
              <p className="text-xs font-bold tracking-[0.16em] text-[#f1a57d]">
                YOUR LEARNING SIGNAL
              </p>
              <h2 className="mt-2 text-xl font-black">
                یک قدم مشخص، نه ده توصیه
              </h2>
              {progressSkills.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {progressSkills
                    .toSorted(
                      (left, right) =>
                        right.growth_count - left.growth_count ||
                        right.fixed_count - left.fixed_count,
                    )
                    .slice(0, 3)
                    .map((skill) => (
                      <div
                        key={skill.code}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 p-4"
                      >
                        <div>
                          <p className="font-black">{skill.name_fa}</p>
                          <p className="mt-1 text-xs text-[#a9bfba]">
                            {skill.growth_count} مشاهده · {skill.fixed_count}{' '}
                            اصلاح ثبت‌شده
                          </p>
                        </div>
                        <span className="rounded-full bg-[#f1a57d] px-3 py-2 font-mono text-xs font-black text-[#18302d]">
                          {skill.strength_count}/{skill.growth_count}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[#c6d5d2]">
                  بعد از اولین تحلیل، آتنا فقط مهم‌ترین الگوهای قابل تمرین را
                  اینجا نگه می‌دارد.
                </p>
              )}
            </div>
          </section>

          {attemptHistory.length > 0 && (
            <section aria-labelledby="writing-history" className="mb-14">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-[#6f7f7b]">
                    CONTINUE OR REVIEW
                  </p>
                  <h2 id="writing-history" className="mt-2 text-2xl font-black">
                    مسیر Writing تو
                  </h2>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {attemptHistory.slice(0, 4).map((historyItem) => (
                  <button
                    key={historyItem.id}
                    type="button"
                    onClick={() => resumeAttempt(historyItem.id)}
                    disabled={resumingAttemptId !== null}
                    className="flex min-h-28 items-center justify-between gap-5 rounded-2xl border border-[#18302d]/10 bg-white p-5 text-right transition hover:border-[#5d3d73]/35 hover:shadow-[0_12px_35px_rgba(24,48,45,0.07)] disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-xs font-black text-[#8f4f54]">
                        {experienceLabel(historyItem.experience_mode)} ·{' '}
                        {shortDate(historyItem.last_activity_at)}
                      </span>
                      <span className="mt-2 block font-black">
                        {historyItem.title}
                      </span>
                      <span className="mt-1 block text-xs text-[#687572]">
                        {historyItem.word_count} کلمه
                        {historyItem.estimated_band_score
                          ? ` · برآورد ${historyItem.estimated_band_score}`
                          : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-xl bg-[#ece3f1] px-3 py-2 text-xs font-black text-[#5d3d73]">
                      {resumingAttemptId === historyItem.id
                        ? 'در حال بازکردن…'
                        : attemptStatusLabel(historyItem.status)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="writing-prompts" className="pb-14">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[#6f7f7b]">
                  SINGLE TASK PRACTICE
                </p>
                <h2 id="writing-prompts" className="mt-2 text-2xl font-black">
                  تمرین‌های آماده
                </h2>
              </div>
              <span className="font-mono text-xs text-[#6f7f7b]">
                {prompts.length.toString().padStart(2, '0')} TASKS
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {prompts.map((prompt) => (
                <article
                  key={prompt.id}
                  className="group flex h-full flex-col rounded-[2rem] border border-[#18302d]/12 bg-[#fffdf8] p-6 shadow-[0_16px_50px_rgba(24,48,45,0.06)] transition hover:-translate-y-0.5 hover:border-[#5d3d73]/35 sm:p-7"
                >
                  <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-bold tracking-wider">
                    <span className="rounded-full bg-[#ece3f1] px-3 py-1 text-[#5d3d73]">
                      {moduleLabel(prompt.module)}
                    </span>
                    <span className="rounded-full bg-[#f3dfd6] px-3 py-1 text-[#8d4028]">
                      {taskLabel(prompt.task_type)}
                    </span>
                    <span className="rounded-full bg-[#ece8dc] px-3 py-1 text-[#59635f]">
                      {Math.round(prompt.recommended_time_seconds / 60)} دقیقه
                    </span>
                  </div>
                  <h3 className="text-xl font-black sm:text-2xl">
                    {prompt.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#65716e]">
                    حداقل {prompt.minimum_word_count} کلمه، تایمر آزمون و
                    بازخورد معیاربه‌معیار پس از ثبت نهایی.
                  </p>
                  <button
                    type="button"
                    onClick={() => startPrompt(prompt)}
                    disabled={startingSlug !== null}
                    className="mt-7 rounded-2xl bg-[#5d3d73] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#5d3d73]/15 transition group-hover:bg-[#4d3160] disabled:cursor-wait disabled:opacity-60"
                  >
                    {startingSlug === prompt.slug
                      ? 'در حال ساخت فضای نوشتن…'
                      : 'شروع نوشتن ←'}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="writing-mocks" className="pb-20">
            <div className="mb-5">
              <p className="text-xs font-bold tracking-[0.18em] text-[#6f7f7b]">
                FULL 60-MINUTE MOCK
              </p>
              <h2 id="writing-mocks" className="mt-2 text-2xl font-black">
                آزمون کامل Writing
              </h2>
            </div>
            {tests.length > 0 ? (
              <div className="grid gap-4">
                {tests.map((test) => (
                  <article
                    key={test.id}
                    className="grid gap-5 rounded-[2rem] bg-[#18302d] p-6 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#f1a57d]">
                        {moduleLabel(test.module)} · {test.task_count} Tasks ·{' '}
                        {Math.round(test.time_limit_seconds / 60)} min
                      </p>
                      <h3 className="mt-2 text-2xl font-black">{test.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-[#c6d5d2]">
                        {test.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startTest(test)}
                      disabled={startingSlug !== null}
                      className="rounded-2xl bg-[#f1a57d] px-6 py-4 text-sm font-black text-[#18302d] disabled:opacity-60"
                    >
                      شروع آزمون کامل
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-[#18302d]/20 bg-white/45 p-7 text-sm leading-7 text-[#65716e]">
                زیرساخت Task 1 + Task 2 و محاسبهٔ دوبرابری Task 2 آماده است.
                اولین آزمون کامل بعد از بازبینی داده‌ها اینجا منتشر می‌شود.
              </div>
            )}
          </section>
        </div>
      </main>
    )
  }

  const isEditing = attempt.status === 'in_progress'
  const draft = drafts[activeTask.id] ?? ''
  const needsGuidedPlan =
    isEditing &&
    attempt.experience_mode === 'guided' &&
    activeTask.prompt.planning_questions.length > 0 &&
    activeTask.plan?.status !== 'complete'

  return (
    <main className="min-h-svh bg-[#efede5] text-[#18302d]">
      <header className="sticky top-0 z-30 border-b border-[#18302d]/10 bg-[#fffdf8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                aria-label="بازگشت به مهارت‌ها"
                className="rounded-md px-1 text-lg leading-none text-[#8f4f54] hover:bg-[#f3dfd6]"
              >
                →
              </Link>
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#8f4f54]">
                WRITING ·{' '}
                {attempt.mode === 'full_mock' ? 'FULL MOCK' : 'PRACTICE'} ·{' '}
                {attempt.experience_mode === 'exam' ? 'EXAM' : 'GUIDED'}
              </p>
            </div>
            <h1 className="truncate text-sm font-black sm:text-base">
              {activeTask.prompt.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={pauseAttempt}
                disabled={
                  pausingAttempt ||
                  submitting ||
                  planSaving ||
                  Boolean(conflict)
                }
                className="min-h-10 rounded-xl border border-[#5d3d73]/25 bg-white px-3 py-2 text-xs font-black text-[#5d3d73] transition hover:bg-[#f2ebf5] disabled:cursor-wait disabled:opacity-50 sm:px-4"
              >
                {pausingAttempt ? 'در حال ذخیره…' : 'ذخیره و خروج'}
              </button>
            )}
            <span className="hidden text-xs font-bold text-[#687572] sm:inline">
              {saveError
                ? 'نیاز به بررسی ذخیره'
                : pendingSaves > 0
                  ? 'در حال ذخیره…'
                  : isEditing
                    ? 'پیش‌نویس ذخیره شد'
                    : 'پاسخ ثبت شده'}
            </span>
            {attempt.experience?.timer_enabled === false ? (
              <span className="rounded-xl bg-[#dcebe5] px-4 py-2 text-xs font-black text-[#155e57]">
                بدون فشار زمان
              </span>
            ) : (
              <span
                dir="ltr"
                className={`rounded-xl px-4 py-2 font-mono text-sm font-bold ${
                  timeRemaining <= 0
                    ? 'bg-red-100 text-red-700'
                    : timeRemaining < 300
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-[#ece3f1] text-[#5d3d73]'
                }`}
              >
                {formatTime(timeRemaining)}
              </span>
            )}
          </div>
        </div>
        {attempt.tasks.length > 1 && (
          <nav
            aria-label="Writing tasks"
            className="mx-auto flex max-w-[1600px] gap-2 px-4 pb-3 sm:px-7"
          >
            {attempt.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setActiveTaskId(task.id)}
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  task.id === activeTask.id
                    ? 'bg-[#5d3d73] text-white'
                    : 'bg-[#ece8dc] text-[#59635f]'
                }`}
              >
                Task {task.task_number} · {countWords(drafts[task.id] ?? '')}{' '}
                کلمه
              </button>
            ))}
          </nav>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="mx-auto mt-5 max-w-[1500px] rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-800 sm:px-6"
        >
          {error}
        </div>
      )}

      {isEditing && rewriteFocus && (
        <section
          aria-label="هدف بازنویسی"
          className="mx-auto mt-5 grid max-w-[1500px] gap-3 rounded-2xl border border-[#5d3d73]/15 bg-[#f2ebf5] px-5 py-4 text-sm sm:grid-cols-[auto_1fr] sm:items-center sm:px-6"
        >
          <div>
            <p className="text-[10px] font-black tracking-[0.14em] text-[#8f4f54]">
              FOCUSED REWRITE
            </p>
            <p className="mt-1 font-black text-[#3f2950]">
              تمرکز این بازنویسی: {rewriteFocus.titleFa}
            </p>
          </div>
          <div dir="ltr" className="text-left text-xs leading-6 text-[#594b61]">
            {rewriteFocus.excerpt && (
              <p>
                <span className="font-black">Your line:</span>{' '}
                {rewriteFocus.excerpt}
              </p>
            )}
            {rewriteFocus.suggestedRevision && (
              <p>
                <span className="font-black">Review target:</span>{' '}
                {rewriteFocus.suggestedRevision}
              </p>
            )}
          </div>
        </section>
      )}

      {isEditing ? (
        needsGuidedPlan ? (
          <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
            <section className="rounded-[2rem] border border-[#18302d]/10 bg-[#fffdf8] p-5 shadow-[0_18px_55px_rgba(24,48,45,0.07)] sm:p-8">
              <div className="grid gap-6 border-b border-[#18302d]/10 pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-[#8f4f54]">
                    GUIDED · PLAN BEFORE YOU WRITE
                  </p>
                  <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                    نقشهٔ کوتاه پاسخ خودت
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[#61706c]">
                    اینجا AI چیزی برایت نمی‌نویسد. چند تصمیم کلیدی را خودت ثبت
                    می‌کنی تا متن منسجم‌تری بسازی؛ بعد وارد همان ویرایشگر اصلی
                    می‌شوی.
                  </p>
                </div>
                <span className="rounded-2xl bg-[#ece3f1] px-4 py-3 text-xs font-black text-[#5d3d73]">
                  {activeTask.prompt.planning_questions.length} تصمیم کوتاه
                </span>
              </div>

              <div
                dir="ltr"
                className="mt-7 rounded-2xl bg-[#f4f1e8] p-5 text-left"
              >
                <p className="font-serif text-base leading-8 text-[#30423f]">
                  {activeTask.prompt.prompt_text}
                </p>
                {activeTask.prompt.assets.map((asset) => (
                  // The learner needs the visual to make their own plan. The
                  // authenticated URL is never included in an AI request.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={asset.id}
                    src={absoluteApiUrl(asset.url)}
                    alt={asset.alt_text}
                    width={asset.width_pixels ?? undefined}
                    height={asset.height_pixels ?? undefined}
                    className="mt-5 h-auto w-full rounded-2xl border border-[#18302d]/10 bg-white"
                  />
                ))}
              </div>

              <div className="mt-7 grid gap-4">
                {activeTask.prompt.planning_questions.map((question, index) => (
                  <label
                    key={question.id}
                    htmlFor={`plan-${question.id}`}
                    className="grid gap-3 rounded-2xl border border-[#18302d]/10 bg-white p-5 sm:grid-cols-[2rem_1fr]"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-[#18302d] font-mono text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block font-black">
                        {question.title_fa}
                      </span>
                      {question.hint_fa && (
                        <span className="mt-1 block text-xs leading-6 text-[#6a7774]">
                          {question.hint_fa}
                        </span>
                      )}
                      <textarea
                        id={`plan-${question.id}`}
                        value={planDrafts[question.id] ?? ''}
                        onChange={(event) =>
                          setPlanDrafts((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        rows={3}
                        dir="rtl"
                        className="mt-3 w-full resize-y rounded-xl border border-[#18302d]/15 bg-[#fffdf8] px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#5d3d73] focus:ring-4 focus:ring-[#5d3d73]/8"
                        placeholder="تصمیم خودت را کوتاه و روشن بنویس…"
                      />
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-7 flex flex-col gap-3 rounded-2xl bg-[#18302d] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-xs leading-6 text-[#c6d5d2]">
                  این نقشه همراه همین تلاش ذخیره می‌شود، اما وارد ارزیابی IELTS
                  نمی‌شود و مدل AI آن را نمی‌بیند.
                </p>
                <button
                  type="button"
                  onClick={completeGuidedPlan}
                  disabled={
                    planSaving ||
                    activeTask.prompt.planning_questions.some(
                      (question) =>
                        question.required && !planDrafts[question.id]?.trim(),
                    )
                  }
                  className="min-h-12 shrink-0 rounded-xl bg-[#f1a57d] px-6 py-3 text-sm font-black text-[#18302d] transition hover:bg-[#f6b493] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {planSaving ? 'در حال ذخیره…' : 'ذخیرهٔ نقشه و شروع نوشتن'}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1600px] lg:h-[calc(100svh-65px)] lg:grid-cols-[minmax(380px,0.78fr)_minmax(0,1.22fr)]">
            <section
              aria-label="Writing prompt"
              dir="ltr"
              className="border-b border-[#18302d]/10 bg-[#fffdf8] px-6 py-8 text-left sm:px-10 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-12"
            >
              <article className="mx-auto max-w-2xl">
                <div className="flex flex-wrap gap-2 text-[11px] font-bold tracking-wider">
                  <span className="rounded-full bg-[#ece3f1] px-3 py-1 text-[#5d3d73]">
                    {moduleLabel(activeTask.prompt.module)}
                  </span>
                  <span className="rounded-full bg-[#f3dfd6] px-3 py-1 text-[#8d4028]">
                    {taskLabel(activeTask.prompt.task_type)}
                  </span>
                </div>
                <p className="mt-8 font-mono text-xs tracking-[0.16em] text-[#8f4f54]">
                  WRITING TASK {activeTask.task_number}
                </p>
                <h2 className="mt-3 font-serif text-3xl leading-tight font-bold sm:text-4xl">
                  {activeTask.prompt.title}
                </h2>
                <p className="mt-8 font-serif text-lg leading-9 text-[#30423f]">
                  {activeTask.prompt.prompt_text}
                </p>
                {activeTask.prompt.assets.map((asset) => (
                  // The backend route is authenticated and keeps the storage key private.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={asset.id}
                    src={absoluteApiUrl(asset.url)}
                    alt={asset.alt_text}
                    width={asset.width_pixels ?? undefined}
                    height={asset.height_pixels ?? undefined}
                    className="mt-7 h-auto w-full rounded-2xl border border-[#18302d]/10 bg-white"
                  />
                ))}
                <div className="mt-8 rounded-2xl border-l-4 border-[#e57d55] bg-[#f8eee8] p-5">
                  <p className="font-serif text-base leading-8">
                    {activeTask.prompt.instructions}
                  </p>
                  {activeTask.prompt.requirements.length > 0 && (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7">
                      {activeTask.prompt.requirements.map((requirement) => (
                        <li key={requirement.sequence}>{requirement.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#ece8dc] p-4">
                    <p className="text-xs text-[#687572]">Minimum</p>
                    <p className="mt-1 font-mono text-xl font-black">
                      {activeTask.prompt.minimum_word_count} words
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#ece3f1] p-4">
                    <p className="text-xs text-[#6d5b78]">Recommended</p>
                    <p className="mt-1 font-mono text-xl font-black text-[#5d3d73]">
                      {Math.round(activeTask.recommended_time_seconds / 60)} min
                    </p>
                  </div>
                </div>
                <div className="mt-8">
                  <p className="text-xs font-bold tracking-[0.14em] text-[#6f7f7b]">
                    ASSESSMENT CRITERIA
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeTask.prompt.criteria.map((criterion) => (
                      <span
                        key={criterion.code}
                        title={criterion.name_fa}
                        className="rounded-full border border-[#18302d]/10 bg-white px-3 py-2 text-xs font-bold"
                      >
                        {criterion.name_en}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </section>

            <section
              aria-label="Writing editor"
              className="flex min-h-[70svh] flex-col bg-[#efede5] px-4 py-5 sm:px-7 sm:py-7 lg:min-h-0 lg:overflow-y-auto lg:px-9"
            >
              <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.16em] text-[#8f4f54]">
                      YOUR RESPONSE
                    </p>
                    <h2 className="mt-1 text-xl font-black">پیش‌نویس پاسخ</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      dir="ltr"
                      className={`rounded-full px-3 py-2 font-mono text-xs font-bold ${
                        currentWordCount < activeTask.prompt.minimum_word_count
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {currentWordCount} /{' '}
                      {activeTask.prompt.minimum_word_count} words
                    </span>
                    <button
                      type="button"
                      onClick={() => saveManually(activeTask.id)}
                      disabled={pendingSaves > 0 || Boolean(conflict)}
                      className="rounded-xl border border-[#5d3d73]/25 bg-white px-4 py-2 text-xs font-black text-[#5d3d73] disabled:opacity-50"
                    >
                      ذخیرهٔ پیش‌نویس
                    </button>
                  </div>
                </div>

                {saveError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    {saveError}
                  </div>
                )}

                <textarea
                  dir="ltr"
                  aria-label={`Writing Task ${activeTask.task_number} response`}
                  value={draft}
                  onChange={(event) =>
                    changeDraft(activeTask.id, event.target.value)
                  }
                  spellCheck
                  placeholder="Write your response here…"
                  className="min-h-[28rem] w-full flex-1 resize-y rounded-[1.6rem] border border-[#18302d]/12 bg-[#fffdf8] px-5 py-5 text-left font-serif text-lg leading-9 text-[#263b38] shadow-[0_16px_50px_rgba(24,48,45,0.06)] outline-none transition focus:border-[#5d3d73]/45 focus:ring-4 focus:ring-[#5d3d73]/8 sm:min-h-[34rem] sm:px-7 sm:py-6"
                />

                <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[#fffdf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-6 text-[#65716e]">
                    پیش‌نویس با فاصلهٔ کوتاه و فقط هنگام تغییر متن ذخیره می‌شود.
                    پایان زمان پاسخ را خودکار ثبت نمی‌کند.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReviewing(true)}
                    disabled={
                      pendingSaves > 0 ||
                      Boolean(conflict) ||
                      attempt.tasks.some((task) => !drafts[task.id]?.trim())
                    }
                    className="shrink-0 rounded-xl bg-[#18302d] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    مرور و ثبت پاسخ
                  </button>
                </div>
              </div>
            </section>
          </div>
        )
      ) : (
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <section className="mb-7 rounded-[2rem] bg-[#18302d] p-6 text-white sm:p-8">
            <p className="text-xs font-bold tracking-[0.16em] text-[#f1a57d]">
              RESPONSE SUBMITTED
            </p>
            <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-black">پاسخت با موفقیت ثبت شد.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#c6d5d2]">
                  متن ثبت‌شده تغییر نمی‌کند. بازخورد هوشمند یک ارزیابی آموزشی
                  روی همین نسخه می‌سازد و در درخواست‌های بعدی از نتیجهٔ
                  ذخیره‌شده استفاده می‌کند.
                </p>
              </div>
              {!feedback && (
                <button
                  type="button"
                  onClick={requestFeedback}
                  disabled={feedbackLoading}
                  className="shrink-0 rounded-2xl bg-[#f1a57d] px-6 py-4 text-sm font-black text-[#18302d] disabled:cursor-wait disabled:opacity-60"
                >
                  {feedbackLoading
                    ? 'در حال تحلیل پاسخ…'
                    : 'دریافت تحلیل معیاربه‌معیار'}
                </button>
              )}
            </div>
            <p className="mt-4 text-xs text-[#9fb7b2]">
              این تحلیل یک استفاده از سهم روزانهٔ بازخورد هوشمند است؛ نمره رسمی
              IELTS نیست.
            </p>
          </section>

          {feedback ? (
            <div className="space-y-7">
              {feedback.evaluations.map((evaluation) => (
                <EvaluationPanel
                  key={evaluation.submission_id}
                  evaluation={evaluation}
                  submissionText={
                    attempt.tasks.find(
                      (task) =>
                        task.submission?.id === evaluation.submission_id,
                    )?.submission?.text_content ?? ''
                  }
                  onDecision={decideOnFeedback}
                  onRewrite={(item) => startRewrite(evaluation, item)}
                  pendingFeedbackItemId={pendingFeedbackItemId}
                />
              ))}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={resetWorkspace}
                  className="rounded-2xl border border-[#5d3d73]/25 bg-white px-7 py-4 text-sm font-black text-[#5d3d73]"
                >
                  شروع یک تمرین تازه
                </button>
              </div>
            </div>
          ) : (
            <section className="space-y-5">
              {attempt.tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-[2rem] border border-[#18302d]/10 bg-[#fffdf8] p-6 sm:p-8"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-black">
                      پاسخ Task {task.task_number}
                    </h2>
                    <span className="font-mono text-xs font-bold text-[#687572]">
                      {task.submission?.word_count ??
                        task.response.draft_word_count}{' '}
                      words
                    </span>
                  </div>
                  <p
                    dir="ltr"
                    className="mt-5 whitespace-pre-wrap text-left font-serif text-base leading-8 text-[#34413f]"
                  >
                    {task.submission?.text_content ?? task.response.draft_text}
                  </p>
                </article>
              ))}
            </section>
          )}
        </div>
      )}

      {reviewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submission-review-title"
          className="fixed inset-0 z-50 grid place-items-end bg-[#18302d]/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
        >
          <div className="w-full max-w-xl rounded-t-[2rem] bg-[#fffdf8] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
            <p className="text-xs font-bold tracking-[0.16em] text-[#8f4f54]">
              FINAL CHECK
            </p>
            <h2
              id="submission-review-title"
              className="mt-2 text-2xl font-black"
            >
              پاسخ را نهایی کنیم؟
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#65716e]">
              بعد از ثبت، این نسخه قابل ویرایش نیست. برای بازنویسی، تمرین
              تازه‌ای شروع می‌کنی تا مسیر پیشرفتت حفظ شود.
            </p>
            <div className="mt-5 space-y-2">
              {submissionSummary.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-xl p-3 text-sm ${
                    item.words < item.minimum
                      ? 'bg-amber-50 text-amber-900'
                      : 'bg-emerald-50 text-emerald-900'
                  }`}
                >
                  <span className="font-black">Task {item.taskNumber}</span>
                  <span dir="ltr" className="font-mono font-bold">
                    {item.words} / {item.minimum} words
                  </span>
                </div>
              ))}
            </div>
            {submissionSummary.some((item) => item.words < item.minimum) && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">
                متن کوتاه‌تر از حد پیشنهادی است. مثل آزمون واقعی ثبت آن ممکن
                است، اما احتمالاً روی معیار پاسخ‌دهی اثر می‌گذارد.
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                disabled={submitting}
                className="rounded-xl border border-[#18302d]/15 px-5 py-3 text-sm font-black"
              >
                بازگشت به ویرایش
              </button>
              <button
                type="button"
                onClick={confirmSubmission}
                disabled={submitting}
                className="rounded-xl bg-[#5d3d73] px-5 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? 'در حال ثبت…' : 'ثبت نهایی پاسخ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {conflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-conflict-title"
          className="fixed inset-0 z-[60] grid place-items-center bg-[#18302d]/60 p-5 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-[2rem] bg-[#fffdf8] p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-bold tracking-[0.16em] text-amber-700">
              DRAFT CONFLICT
            </p>
            <h2 id="draft-conflict-title" className="mt-2 text-2xl font-black">
              یک نسخهٔ جدیدتر ذخیره شده است.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#65716e]">
              احتمالاً همین تمرین در تب یا دستگاه دیگری باز بوده. انتخاب کن کدام
              متن ادامه پیدا کند؛ آتنا هیچ نسخه‌ای را بی‌اجازه جایگزین نمی‌کند.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={useServerDraft}
                className="rounded-xl bg-[#18302d] px-5 py-4 text-sm font-black text-white"
              >
                ادامه با نسخهٔ جدیدتر ذخیره‌شده ({conflict.serverWordCount}{' '}
                کلمه)
              </button>
              <button
                type="button"
                onClick={keepLocalDraft}
                className="rounded-xl border border-[#5d3d73]/25 px-5 py-4 text-sm font-black text-[#5d3d73]"
              >
                نگه‌داشتن متن همین صفحه و ذخیرهٔ آگاهانه
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
