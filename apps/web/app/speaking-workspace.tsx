'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { useOptionalAuth } from '@/app/auth-provider'
import { SpeakingExaminer } from '@/app/speaking/speaking-examiner'
import { SpeakingLanding } from '@/app/speaking/speaking-landing'
import {
  deriveSpeakingView,
  initialSpeakingState,
  speakingMachine,
  type SpeakingPhase,
} from '@/app/speaking/speaking-machine'
import {
  type PreparedTake,
  SpeakingRecorder,
} from '@/app/speaking/speaking-recorder'
import { SpeakingSummary } from '@/app/speaking/speaking-summary'
import { SpeakingTranscript } from '@/app/speaking/speaking-transcript'
import { ApiError } from '@/lib/api-client'
import {
  speakingApi,
  type SpeakingFeedback,
  type SpeakingSession,
  type SpeakingSessionSummary,
  type SpeakingTurn,
} from '@/lib/speaking-api'

type SessionOperation = {
  epoch: number
  signal: AbortSignal
}

function friendlyError(reason: unknown, fallback: string) {
  if (!(reason instanceof ApiError)) return fallback
  if (reason.status === 429) {
    return 'درخواست‌ها کمی زیاد شده است. چند لحظه صبر کن و دوباره تلاش کن.'
  }
  if (reason.status === 401) {
    return 'زمان ورودت تمام شده است. بعد از ورود دوباره می‌توانی جلسه را ادامه بدهی.'
  }
  if (reason.status === 409) {
    return 'وضعیت جلسه تغییر کرده است. جلسه را دوباره بارگذاری کن.'
  }
  if (reason.status === 413 || reason.status === 415) return reason.message
  if (reason.status === 0) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.'
  }
  return fallback
}

function isAbortError(reason: unknown) {
  return reason instanceof DOMException && reason.name === 'AbortError'
}

function activePrompt(session: SpeakingSession | null) {
  if (!session?.current_prompt_id) return null
  return (
    session.turns.find((turn) => turn.id === session.current_prompt_id) ?? null
  )
}

function closingTurn(session: SpeakingSession) {
  return [...session.turns].reverse().find((turn) => turn.kind === 'closing')
}

export function SpeakingWorkspace() {
  const auth = useOptionalAuth()
  const [state, dispatch] = useReducer(speakingMachine, initialSpeakingState)
  const [prepared, setPrepared] = useState<PreparedTake | null>(null)
  const [speechUrl, setSpeechUrl] = useState<string | null>(null)
  const [abandonOpen, setAbandonOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [completionSpeechError, setCompletionSpeechError] = useState<
    string | null
  >(null)
  const [answerCommitted, setAnswerCommittedState] = useState(false)
  const [longWait, setLongWait] = useState(false)
  const [feedbackBySession, setFeedbackBySession] = useState<
    Record<string, SpeakingFeedback>
  >({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const preparedRef = useRef<PreparedTake | null>(null)
  const speechUrlRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef<SpeakingSession | null>(null)
  const answerCommittedRef = useRef(false)
  const operationControllerRef = useRef<AbortController | null>(null)
  const operationEpochRef = useRef(0)
  const historyControllerRef = useRef<AbortController | null>(null)
  const submissionTimerRef = useRef<number | null>(null)
  const errorRef = useRef<HTMLDivElement | null>(null)
  const abandonTriggerRef = useRef<HTMLButtonElement | null>(null)
  const abandonDialogRef = useRef<HTMLElement | null>(null)
  const exitReturnFocusRef = useRef<HTMLButtonElement | null>(null)
  const exitDialogRef = useRef<HTMLElement | null>(null)

  const phaseView = deriveSpeakingView(state.phase)

  const setAnswerCommitted = useCallback((committed: boolean) => {
    answerCommittedRef.current = committed
    setAnswerCommittedState(committed)
  }, [])

  const clearSubmissionTimer = useCallback(() => {
    if (submissionTimerRef.current !== null) {
      window.clearTimeout(submissionTimerRef.current)
      submissionTimerRef.current = null
    }
  }, [])

  const replacePrepared = useCallback(
    (next: PreparedTake | null) => {
      if (
        preparedRef.current &&
        preparedRef.current.previewUrl !== next?.previewUrl
      ) {
        URL.revokeObjectURL(preparedRef.current.previewUrl)
      }
      const changed = preparedRef.current?.previewUrl !== next?.previewUrl
      preparedRef.current = next
      setPrepared(next)
      if (!next || changed) {
        clearSubmissionTimer()
        setLongWait(false)
        setAnswerCommitted(false)
      }
    },
    [clearSubmissionTimer, setAnswerCommitted],
  )

  const replaceSpeech = useCallback((nextUrl: string | null) => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.onerror = null
      audio.removeAttribute('src')
    }
    audioRef.current = null
    if (speechUrlRef.current && speechUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(speechUrlRef.current)
    }
    speechUrlRef.current = nextUrl
    setSpeechUrl(nextUrl)
  }, [])

  const cancelSessionOperation = useCallback(() => {
    operationEpochRef.current += 1
    operationControllerRef.current?.abort()
    operationControllerRef.current = null
  }, [])

  const beginSessionOperation = useCallback((): SessionOperation => {
    operationControllerRef.current?.abort()
    const controller = new AbortController()
    operationControllerRef.current = controller
    const epoch = ++operationEpochRef.current
    return { epoch, signal: controller.signal }
  }, [])

  const operationIsCurrent = useCallback((operation: SessionOperation) => {
    return (
      mountedRef.current &&
      !operation.signal.aborted &&
      operationEpochRef.current === operation.epoch
    )
  }, [])

  useEffect(() => {
    sessionRef.current = state.session
  }, [state.session])

  useEffect(() => {
    if (
      state.error &&
      state.phase === 'recoverable_error' &&
      state.retryAction !== 'submit'
    ) {
      errorRef.current?.focus()
    }
  }, [state.error, state.phase, state.retryAction])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      operationEpochRef.current += 1
      operationControllerRef.current?.abort()
      historyControllerRef.current?.abort()
      if (submissionTimerRef.current !== null) {
        window.clearTimeout(submissionTimerRef.current)
      }
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.onended = null
        audio.onerror = null
        audio.removeAttribute('src')
      }
      if (preparedRef.current) {
        URL.revokeObjectURL(preparedRef.current.previewUrl)
      }
      if (speechUrlRef.current) URL.revokeObjectURL(speechUrlRef.current)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    historyControllerRef.current?.abort()
    const controller = new AbortController()
    historyControllerRef.current = controller
    dispatch({ type: 'history_loading' })
    try {
      const sessions = await speakingApi.listSessions(controller.signal)
      if (mountedRef.current && !controller.signal.aborted) {
        dispatch({ type: 'history_loaded', sessions })
      }
    } catch (reason) {
      if (
        mountedRef.current &&
        !controller.signal.aborted &&
        !isAbortError(reason)
      ) {
        dispatch({
          type: 'history_failed',
          message: friendlyError(
            reason,
            'تاریخچهٔ جلسه‌ها بارگذاری نشد. می‌توانی دوباره تلاش کنی.',
          ),
        })
      }
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    const open = abandonOpen || exitOpen
    if (!open) return
    const trigger = abandonOpen
      ? abandonTriggerRef.current
      : exitReturnFocusRef.current
    const dialog = abandonOpen
      ? abandonDialogRef.current
      : exitDialogRef.current
    const focusable = Array.from(
      dialog?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [],
    )

    function handleDialogKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAbandonOpen(false)
        setExitOpen(false)
        return
      }
      if (event.key !== 'Tab' || focusable.length === 0) return
      const first = focusable.at(0)!
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeydown)
    return () => {
      document.removeEventListener('keydown', handleDialogKeydown)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [abandonOpen, exitOpen])

  async function playExaminerAudio(
    completed = false,
    epoch = operationEpochRef.current,
  ) {
    const audio = audioRef.current
    if (!audio) return
    if (!completed) dispatch({ type: 'set_phase', phase: 'playing_examiner' })
    try {
      await audio.play()
    } catch {
      if (
        !completed &&
        mountedRef.current &&
        operationEpochRef.current === epoch &&
        sessionRef.current
      ) {
        dispatch({
          type: 'session_loaded',
          session: sessionRef.current,
          phase: 'examiner_ready',
        })
      }
    }
  }

  async function loadSpeech(
    session: SpeakingSession,
    turn: SpeakingTurn,
    operation: SessionOperation,
    autoPlay = true,
  ) {
    const completed = session.status === 'completed'
    sessionRef.current = session
    setCompletionSpeechError(null)
    if (!completed) {
      dispatch({ type: 'session_loaded', session, phase: 'loading_examiner' })
    }
    try {
      const blob = await speakingApi.getSpeech(
        session.id,
        turn.id,
        operation.signal,
      )
      if (!operationIsCurrent(operation)) return
      const url = URL.createObjectURL(blob)
      replaceSpeech(url)
      const audio = new Audio(url)
      audio.preload = 'auto'
      audioRef.current = audio
      audio.onended = () => {
        if (!operationIsCurrent(operation) || completed) return
        if (answerCommittedRef.current) replacePrepared(null)
        dispatch({ type: 'session_loaded', session, phase: 'ready_to_record' })
      }
      audio.onerror = () => {
        if (!operationIsCurrent(operation)) return
        if (completed) {
          setCompletionSpeechError(
            'پخش پیام پایانی ممکن نشد. می‌توانی دوباره تلاش کنی.',
          )
        } else {
          dispatch({
            type: 'fail',
            message: 'پخش صدای ممتحن ممکن نشد. دوباره تلاش کن.',
            retryAction: 'speech',
            session,
          })
        }
      }
      dispatch({
        type: 'session_loaded',
        session,
        phase: completed ? 'completed' : 'examiner_ready',
      })
      if (autoPlay) await playExaminerAudio(completed, operation.epoch)
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      const message = friendlyError(
        reason,
        'صدای ممتحن آماده نشد. سؤال ذخیره شده و می‌توانی پخش را دوباره امتحان کنی.',
      )
      if (completed) {
        dispatch({ type: 'session_loaded', session, phase: 'completed' })
        setCompletionSpeechError(message)
      } else {
        dispatch({ type: 'fail', message, retryAction: 'speech', session })
      }
    }
  }

  async function advance(
    session: SpeakingSession,
    operation: SessionOperation,
    fromCreation = false,
  ) {
    dispatch({
      type: 'session_loaded',
      session,
      phase: fromCreation ? 'creating_session' : 'generating_next',
    })
    try {
      const advanced = await speakingApi.advance(session.id, operation.signal)
      if (!operationIsCurrent(operation)) return
      if (advanced.status === 'completed') {
        clearSubmissionTimer()
        replacePrepared(null)
        dispatch({
          type: 'session_loaded',
          session: advanced,
          phase: 'completed',
        })
        const closing = closingTurn(advanced)
        if (closing) await loadSpeech(advanced, closing, operation)
        return
      }
      const prompt = activePrompt(advanced)
      if (!prompt) throw new Error('Missing examiner prompt')
      await loadSpeech(advanced, prompt, operation)
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      dispatch({
        type: 'fail',
        message: friendlyError(
          reason,
          fromCreation
            ? 'اولین سؤال آماده نشد. جلسه ذخیره شده است؛ دوباره تلاش کن.'
            : 'سؤال بعدی آماده نشد. پاسخ قبلی ذخیره شده است؛ دوباره تلاش کن.',
        ),
        retryAction: 'advance',
        session,
      })
    }
  }

  async function startPractice() {
    const operation = beginSessionOperation()
    dispatch({ type: 'set_phase', phase: 'creating_session' })
    replacePrepared(null)
    replaceSpeech(null)
    try {
      const session = await speakingApi.createSession(
        state.examType,
        operation.signal,
      )
      if (!operationIsCurrent(operation)) return
      const prompt = activePrompt(session)
      if (prompt) await loadSpeech(session, prompt, operation)
      else await advance(session, operation, true)
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      dispatch({
        type: 'landing_error',
        message: friendlyError(reason, 'ساخت جلسه ممکن نشد. دوباره تلاش کن.'),
      })
    }
  }

  async function submitResponse() {
    const session = state.session
    const prompt = activePrompt(session)
    const take = preparedRef.current
    if (!session || !prompt || !take) return
    const operation = beginSessionOperation()
    clearSubmissionTimer()
    setLongWait(false)
    setAnswerCommitted(false)
    submissionTimerRef.current = window.setTimeout(() => {
      if (operationIsCurrent(operation)) setLongWait(true)
    }, 6_000)
    dispatch({ type: 'set_phase', phase: 'submitting' })
    try {
      const committed = await speakingApi.submitResponse(
        session.id,
        {
          audio: take.blob,
          clientEventId: take.clientEventId,
          filename: take.filename,
          promptId: prompt.id,
          recordingDurationMs: take.durationMs,
        },
        operation.signal,
      )
      if (!operationIsCurrent(operation)) return
      setAnswerCommitted(true)
      if (committed.status === 'completed') {
        clearSubmissionTimer()
        replacePrepared(null)
        dispatch({
          type: 'session_loaded',
          session: committed,
          phase: 'completed',
        })
        const closing = closingTurn(committed)
        if (closing) await loadSpeech(committed, closing, operation)
      } else {
        await advance(committed, operation)
      }
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      clearSubmissionTimer()
      dispatch({
        type: 'fail',
        message: friendlyError(
          reason,
          'ثبت پاسخ انجام نشد. برداشتت روی دستگاه باقی مانده و آمادهٔ تلاش دوباره است.',
        ),
        retryAction: 'submit',
        session,
      })
    }
  }

  async function resumeSession(summary: SpeakingSessionSummary) {
    const operation = beginSessionOperation()
    dispatch({ type: 'set_phase', phase: 'loading_examiner' })
    replacePrepared(null)
    replaceSpeech(null)
    try {
      const session = await speakingApi.getSession(summary.id, operation.signal)
      if (!operationIsCurrent(operation)) return
      if (session.status !== 'in_progress') {
        dispatch({ type: 'show_history', session })
        return
      }
      const prompt = activePrompt(session)
      if (prompt) await loadSpeech(session, prompt, operation)
      else await advance(session, operation)
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      dispatch({
        type: 'landing_error',
        message: friendlyError(reason, 'جلسه بارگذاری نشد. دوباره تلاش کن.'),
      })
    }
  }

  async function inspectSession(summary: SpeakingSessionSummary) {
    const operation = beginSessionOperation()
    dispatch({ type: 'set_phase', phase: 'loading_examiner' })
    try {
      const session = await speakingApi.getSession(summary.id, operation.signal)
      if (operationIsCurrent(operation)) {
        dispatch({ type: 'show_history', session })
      }
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      dispatch({
        type: 'landing_error',
        message: friendlyError(reason, 'متن جلسه بارگذاری نشد.'),
      })
    }
  }

  function performExit() {
    cancelSessionOperation()
    clearSubmissionTimer()
    replacePrepared(null)
    replaceSpeech(null)
    setAbandonOpen(false)
    setExitOpen(false)
    setCompletionSpeechError(null)
    dispatch({ type: 'back_to_landing' })
    void loadHistory()
  }

  function requestExit(trigger: HTMLButtonElement) {
    const recordingIsUnsent = ['recording', 'stopping_recording'].includes(
      state.phase,
    )
    if (
      recordingIsUnsent ||
      (preparedRef.current && !answerCommittedRef.current)
    ) {
      exitReturnFocusRef.current = trigger
      setExitOpen(true)
      return
    }
    performExit()
  }

  async function confirmAbandon() {
    if (!state.session) return
    const operation = beginSessionOperation()
    try {
      const session = await speakingApi.abandon(
        state.session.id,
        operation.signal,
      )
      if (!operationIsCurrent(operation)) return
      clearSubmissionTimer()
      replacePrepared(null)
      replaceSpeech(null)
      setAbandonOpen(false)
      dispatch({ type: 'show_history', session })
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      setAbandonOpen(false)
      dispatch({
        type: 'fail',
        message: friendlyError(reason, 'رها کردن جلسه انجام نشد.'),
        retryAction: null,
        session: state.session,
      })
    }
  }

  async function retry() {
    if (state.retryAction === 'submit') return submitResponse()
    if (state.retryAction === 'advance' && state.session) {
      return advance(state.session, beginSessionOperation())
    }
    if (state.retryAction === 'speech' && state.session) {
      const prompt = activePrompt(state.session)
      if (prompt) {
        return loadSpeech(state.session, prompt, beginSessionOperation())
      }
    }
  }

  const feedbackLoaded = useCallback((feedback: SpeakingFeedback) => {
    setFeedbackBySession((current) => ({
      ...current,
      [feedback.session_id]: feedback,
    }))
  }, [])

  async function openStaffPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const { session } = await speakingApi.getStaffPreview()
      const feedback = await speakingApi.getOrCreateFeedback(session.id)
      feedbackLoaded(feedback)
      dispatch({ type: 'show_history', session })
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

  if (['landing', 'creating_session'].includes(state.phase) || !state.session) {
    return (
      <SpeakingLanding
        error={state.error}
        examType={state.examType}
        historyError={state.historyError}
        historyStatus={state.historyStatus}
        phase={state.phase}
        sessions={state.sessions}
        onHistoryRetry={() => void loadHistory()}
        onInspect={(session) => void inspectSession(session)}
        onResume={(session) => void resumeSession(session)}
        onSelectExam={(examType) => dispatch({ type: 'select_exam', examType })}
        onStart={() => void startPractice()}
        staffPreview={
          auth?.user?.is_staff
            ? {
                error: previewError,
                loading: previewLoading,
                onOpen: () => void openStaffPreview(),
              }
            : null
        }
      />
    )
  }

  if (state.phase === 'history_detail') {
    return (
      <SpeakingSummary
        historyMode
        cachedFeedback={feedbackBySession[state.session.id] ?? null}
        session={state.session}
        onBack={performExit}
        onFeedbackLoaded={feedbackLoaded}
        onStartAnother={performExit}
      />
    )
  }

  if (state.phase === 'completed') {
    return (
      <SpeakingSummary
        cachedFeedback={feedbackBySession[state.session.id] ?? null}
        session={state.session}
        speechReady={Boolean(speechUrl)}
        speechError={completionSpeechError}
        onBack={performExit}
        onFeedbackLoaded={feedbackLoaded}
        onStartAnother={performExit}
        onPlayClosing={() => void playExaminerAudio(true)}
        onRetrySpeech={() => {
          const closing = closingTurn(state.session!)
          if (closing) {
            void loadSpeech(state.session!, closing, beginSessionOperation())
          }
        }}
      />
    )
  }

  const prompt = activePrompt(state.session)
  const progress = Math.round(
    (state.session.response_count / state.session.required_response_count) *
      100,
  )
  const modalOpen = exitOpen || abandonOpen
  const liveAnnouncement = [
    phaseView.announcement,
    longWait && prepared
      ? answerCommitted
        ? 'پاسخ شما ثبت شده است.'
        : 'ضبط شما روی این دستگاه محفوظ است.'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className="min-h-svh bg-[var(--athena-workspace)] pb-[env(safe-area-inset-bottom)] text-[var(--athena-ink)]">
      <div
        aria-hidden={modalOpen ? true : undefined}
        inert={modalOpen ? true : undefined}
      >
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </p>
        <header className="sticky top-0 z-30 border-b border-[var(--athena-border)] bg-[var(--athena-paper)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={(event) => requestExit(event.currentTarget)}
                aria-label="خروج از تمرین Speaking"
                className="rounded-lg text-xl font-black focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)]"
              >
                آتنا
              </button>
              <span
                aria-hidden="true"
                className="h-7 w-px bg-[var(--athena-border)]"
              />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black">
                  تمرین Speaking {state.session.exam_type.toUpperCase()}
                </h1>
                <p className="mt-0.5 text-[10px] text-[var(--athena-muted)]">
                  {state.session.response_count.toLocaleString('fa-IR')} از{' '}
                  {state.session.required_response_count.toLocaleString(
                    'fa-IR',
                  )}{' '}
                  پاسخ ثبت شده
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => requestExit(event.currentTarget)}
                className="min-h-11 rounded-xl border border-[var(--athena-border)] px-3 py-2 text-xs font-black transition hover:bg-[var(--athena-mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-teal)] sm:px-4"
              >
                خروج
              </button>
              <button
                ref={abandonTriggerRef}
                type="button"
                aria-label="رها کردن جلسه"
                onClick={() => setAbandonOpen(true)}
                className="min-h-11 rounded-xl px-2 py-2 text-xs font-black text-[#8f302c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b3f38] sm:px-3"
              >
                <span className="sm:hidden">رها</span>
                <span className="hidden sm:inline">رها کردن</span>
              </button>
            </div>
          </div>
          <div
            role="progressbar"
            aria-label="پیشرفت جلسه"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-1 bg-[var(--athena-sand)]"
          >
            <div
              className="h-full bg-[var(--athena-teal)] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-7 lg:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.72fr)] lg:gap-6 lg:py-7">
          <div className="min-w-0 space-y-5">
            <SpeakingExaminer
              prompt={prompt}
              session={state.session}
              speechUrl={speechUrl}
              view={phaseView}
              onPlay={() => void playExaminerAudio()}
            />

            {state.phase === 'recoverable_error' &&
              state.error &&
              state.retryAction !== 'submit' && (
                <div
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900 outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
                >
                  <p>{state.error}</p>
                  {state.retryAction && (
                    <button
                      type="button"
                      onClick={() => void retry()}
                      className="mt-3 min-h-11 rounded-xl bg-amber-900 px-5 py-2 text-xs font-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
                    >
                      تلاش دوباره
                    </button>
                  )}
                </div>
              )}

            <div className="-mx-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:-mx-7 lg:mx-0 lg:pb-0">
              <SpeakingRecorder
                answerCommitted={answerCommitted}
                error={
                  state.retryAction === 'submit' || state.retryAction === null
                    ? state.error
                    : null
                }
                longWait={longWait}
                prepared={prepared}
                prompt={prompt}
                view={phaseView}
                onDiscard={() => {
                  replacePrepared(null)
                  dispatch({ type: 'clear_error', phase: 'ready_to_record' })
                }}
                onError={(message) =>
                  dispatch({
                    type: 'inline_error',
                    message,
                    phase: prepared ? 'local_review' : 'ready_to_record',
                  })
                }
                onPhase={(phase: SpeakingPhase) =>
                  dispatch({ type: 'set_phase', phase })
                }
                onPrepared={replacePrepared}
                onSubmit={() => void submitResponse()}
              />
            </div>

            <div className="lg:hidden">
              <SpeakingTranscript collapsible session={state.session} />
            </div>
          </div>

          <aside className="hidden min-h-0 lg:block">
            <div className="sticky top-24">
              <SpeakingTranscript autoScroll session={state.session} />
            </div>
          </aside>
        </div>
      </div>

      {exitOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-[#102421]/55 p-4 backdrop-blur-sm"
        >
          <section
            ref={exitDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            aria-describedby="exit-description"
            className="w-full max-w-md rounded-[1.5rem] bg-[var(--athena-paper)] p-6 shadow-2xl"
          >
            <h2 id="exit-title" className="text-xl font-black">
              خروج بدون ثبت؟
            </h2>
            <p
              id="exit-description"
              className="mt-3 text-sm leading-7 text-[var(--athena-muted)]"
            >
              این برداشت هنوز ثبت نشده است. جلسه برای ادامه در آینده می‌ماند،
              اما این فایل صوتی با خروج از بین می‌رود.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setExitOpen(false)}
                autoFocus
                className="min-h-12 rounded-xl border border-[var(--athena-border-strong)] px-5 py-3 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-teal)]"
              >
                ادامهٔ جلسه
              </button>
              <button
                type="button"
                onClick={performExit}
                className="min-h-12 rounded-xl bg-[#9b3f38] px-5 py-3 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b3f38]"
              >
                خروج بدون ثبت
              </button>
            </div>
          </section>
        </div>
      )}

      {abandonOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-[#102421]/55 p-4 backdrop-blur-sm"
        >
          <section
            ref={abandonDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="abandon-title"
            aria-describedby="abandon-description"
            className="w-full max-w-md rounded-[1.5rem] bg-[var(--athena-paper)] p-6 shadow-2xl"
          >
            <h2 id="abandon-title" className="text-xl font-black">
              این جلسه رها شود؟
            </h2>
            <p
              id="abandon-description"
              className="mt-3 text-sm leading-7 text-[var(--athena-muted)]"
            >
              پاسخ‌های ثبت‌شده در تاریخچه می‌مانند، اما دیگر نمی‌توانی این جلسه
              را ادامه بدهی. برای ادامه در آینده، «خروج» را انتخاب کن.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAbandonOpen(false)}
                autoFocus
                className="min-h-12 rounded-xl border border-[var(--athena-border-strong)] px-5 py-3 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-teal)]"
              >
                ادامهٔ جلسه
              </button>
              <button
                type="button"
                onClick={() => void confirmAbandon()}
                className="min-h-12 rounded-xl bg-[#9b3f38] px-5 py-3 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b3f38]"
              >
                بله، رها شود
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
