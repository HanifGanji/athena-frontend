'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useOptionalAuth } from '@/app/auth-provider'
import { SpeakingExaminer } from '@/app/speaking/speaking-examiner'
import { SpeakingLanding } from '@/app/speaking/speaking-landing'
import { SpeakingReviewAttention } from '@/app/speaking/speaking-review-attention'
import {
  deriveSpeakingView,
  type SpeakingPhase,
} from '@/app/speaking/speaking-machine'
import {
  type PreparedTake,
  SpeakingRecorder,
} from '@/app/speaking/speaking-recorder'
import { SpeakingSummary } from '@/app/speaking/speaking-summary'
import {
  type SessionOperation,
  useSpeakingController,
} from '@/app/speaking/use-speaking-controller'
import {
  SpeakingTranscript,
  stageLabel,
} from '@/app/speaking/speaking-transcript'
import { ApiError } from '@/lib/api-client'
import {
  speakingApi,
  type SpeakingFeedback,
  type SpeakingSession,
  type SpeakingSessionSummary,
  type SpeakingTurn,
} from '@/lib/speaking-api'

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

function historyError(reason: unknown) {
  return friendlyError(
    reason,
    'تاریخچهٔ جلسه‌ها بارگذاری نشد. می‌توانی دوباره تلاش کنی.',
  )
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

function latestLearnerAnswer(session: SpeakingSession) {
  return [...session.turns].reverse().find((turn) => turn.role === 'learner')
}

function relatedPrompt(session: SpeakingSession, answer: SpeakingTurn) {
  return answer.prompt_id
    ? (session.turns.find((turn) => turn.id === answer.prompt_id) ?? null)
    : null
}

export function SpeakingWorkspace() {
  const auth = useOptionalAuth()
  const {
    beginSessionOperation,
    cancelSessionOperation,
    dispatch,
    loadHistory,
    mountedRef,
    operationEpochRef,
    operationIsCurrent,
    state,
  } = useSpeakingController({ historyError, isAbortError })
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
  const [reviewNotice, setReviewNotice] = useState<string | null>(null)
  const [replacementAnswerId, setReplacementAnswerId] = useState<string | null>(
    null,
  )
  const [playbackState, setPlaybackState] = useState<
    'not_started' | 'playing' | 'paused' | 'ended'
  >('not_started')

  const preparedRef = useRef<PreparedTake | null>(null)
  const speechUrlRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef<SpeakingSession | null>(null)
  const answerCommittedRef = useRef(false)
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
    setPlaybackState('not_started')
  }, [])

  useEffect(() => {
    sessionRef.current = state.session
  }, [state.session])

  useEffect(() => {
    if (!reviewNotice) return
    const timeout = window.setTimeout(() => setReviewNotice(null), 8_000)
    return () => window.clearTimeout(timeout)
  }, [reviewNotice])

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
    return () => {
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
    if (playbackState === 'ended') audio.currentTime = 0
    if (!completed) dispatch({ type: 'set_phase', phase: 'playing_examiner' })
    setPlaybackState('playing')
    try {
      await audio.play()
    } catch {
      setPlaybackState(audio.currentTime > 0 ? 'paused' : 'not_started')
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

  function pauseExaminerAudio() {
    const audio = audioRef.current
    const session = sessionRef.current
    if (!audio || !session || audio.paused) return
    audio.pause()
    setPlaybackState('paused')
    dispatch({ type: 'session_loaded', session, phase: 'examiner_ready' })
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
        if (!operationIsCurrent(operation)) return
        setPlaybackState('ended')
        if (completed) return
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

  async function reviewCommittedResponse(
    session: SpeakingSession,
    answer: SpeakingTurn,
    operation: SessionOperation,
  ) {
    dispatch({
      type: 'session_loaded',
      session,
      phase: 'reviewing_response',
    })
    try {
      const reviewed = await speakingApi.reviewResponse(
        session.id,
        answer.id,
        operation.signal,
      )
      if (!operationIsCurrent(operation)) return
      const reviewedAnswer =
        reviewed.turns.find((turn) => turn.id === answer.id) ?? answer
      if (reviewedAnswer.review?.verdict === 'clear') {
        replacePrepared(null)
        setReplacementAnswerId(null)
        await advance(reviewed, operation)
        return
      }
      if (
        reviewedAnswer.review?.verdict === 'note' ||
        reviewedAnswer.review?.verdict === 'warning'
      ) {
        replacePrepared(null)
        dispatch({
          type: 'session_loaded',
          session: reviewed,
          phase: 'review_attention',
        })
        return
      }
      throw new Error('Missing response review')
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      replacePrepared(null)
      setReplacementAnswerId(null)
      setReviewNotice(
        'پاسخت ذخیره شد، اما بررسی کوتاه آن فعلاً انجام نشد. جلسه بدون توقف ادامه پیدا کرد.',
      )
      await advance(session, operation)
    }
  }

  async function startPractice() {
    const operation = beginSessionOperation()
    dispatch({ type: 'set_phase', phase: 'creating_session' })
    replacePrepared(null)
    replaceSpeech(null)
    setReplacementAnswerId(null)
    setReviewNotice(null)
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
    const replacementAnswer = replacementAnswerId
      ? (session?.turns.find((turn) => turn.id === replacementAnswerId) ?? null)
      : null
    const prompt = replacementAnswer
      ? relatedPrompt(session!, replacementAnswer)
      : activePrompt(session)
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
      const committed = replacementAnswer
        ? await speakingApi.replaceResponse(
            session.id,
            replacementAnswer.id,
            {
              audio: take.blob,
              clientEventId: take.clientEventId,
              expectedRevision: replacementAnswer.revision,
              filename: take.filename,
              recordingDurationMs: take.durationMs,
            },
            operation.signal,
          )
        : await speakingApi.submitResponse(
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
      const committedAnswer = replacementAnswer
        ? committed.turns.find((turn) => turn.id === replacementAnswer.id)
        : [...committed.turns]
            .reverse()
            .find(
              (turn) => turn.role === 'learner' && turn.prompt_id === prompt.id,
            )
      if (!committedAnswer) throw new Error('Missing committed answer')
      await reviewCommittedResponse(committed, committedAnswer, operation)
    } catch (reason) {
      if (!operationIsCurrent(operation) || isAbortError(reason)) return
      clearSubmissionTimer()
      dispatch({
        type: 'fail',
        message: friendlyError(
          reason,
          replacementAnswer
            ? 'ثبت پاسخ جایگزین انجام نشد. پاسخ قبلی محفوظ است و ضبط تازه روی دستگاهت مانده است.'
            : 'ثبت پاسخ انجام نشد. ضبطت روی دستگاه باقی مانده و آمادهٔ تلاش دوباره است.',
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
    setReplacementAnswerId(null)
    setReviewNotice(null)
    try {
      const session = await speakingApi.getSession(summary.id, operation.signal)
      if (!operationIsCurrent(operation)) return
      if (session.status !== 'in_progress') {
        dispatch({ type: 'show_history', session })
        return
      }
      const prompt = activePrompt(session)
      if (prompt) await loadSpeech(session, prompt, operation)
      else {
        const answer = latestLearnerAnswer(session)
        if (!answer) {
          await advance(session, operation)
        } else if (!answer.review) {
          await reviewCommittedResponse(session, answer, operation)
        } else if (answer.review.verdict === 'clear') {
          await advance(session, operation)
        } else {
          dispatch({
            type: 'session_loaded',
            session,
            phase: 'review_attention',
          })
        }
      }
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
    setReviewNotice(null)
    setReplacementAnswerId(null)
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
      setReplacementAnswerId(null)
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

  function replaceFlaggedAnswer(answer: SpeakingTurn) {
    replacePrepared(null)
    setReplacementAnswerId(answer.id)
    dispatch({ type: 'set_phase', phase: 'ready_to_record' })
  }

  function continueAfterReview() {
    if (!state.session) return
    replacePrepared(null)
    setReplacementAnswerId(null)
    setReviewNotice(null)
    void advance(state.session, beginSessionOperation())
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

  const reviewAnswer = latestLearnerAnswer(state.session)
  const replacementAnswer = replacementAnswerId
    ? (state.session.turns.find((turn) => turn.id === replacementAnswerId) ??
      null)
    : null
  const prompt =
    activePrompt(state.session) ??
    (replacementAnswer
      ? relatedPrompt(state.session, replacementAnswer)
      : reviewAnswer
        ? relatedPrompt(state.session, reviewAnswer)
        : null)
  const progress = Math.round(
    (state.session.response_count / state.session.required_response_count) *
      100,
  )
  const modalOpen = exitOpen || abandonOpen
  const liveAnnouncement = [
    phaseView.announcement,
    reviewNotice,
    longWait && prepared
      ? answerCommitted
        ? 'پاسخ شما ثبت شده است.'
        : 'ضبط شما روی این دستگاه محفوظ است.'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className="min-h-svh bg-[var(--athena-surface-subtle)] pb-[env(safe-area-inset-bottom)] text-[var(--athena-text)]">
      <div
        aria-hidden={modalOpen ? true : undefined}
        inert={modalOpen ? true : undefined}
      >
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </p>
        <header className="sticky top-0 z-30 border-b border-[var(--athena-border)] bg-[var(--athena-paper)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <p className="text-xl font-bold" aria-label="آتنا">
                آتنا
              </p>
              <span
                aria-hidden="true"
                className="h-7 w-px bg-[var(--athena-border)]"
              />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold">
                  {prompt ? stageLabel(prompt.stage) : 'Speaking'}
                </h1>
                <p className="mt-0.5 text-xs text-[var(--athena-muted)]">
                  پاسخ{' '}
                  {Math.min(
                    state.session.response_count + 1,
                    state.session.required_response_count,
                  ).toLocaleString('fa-IR')}{' '}
                  از{' '}
                  {state.session.required_response_count.toLocaleString(
                    'fa-IR',
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => requestExit(event.currentTarget)}
                aria-label="خروج و ادامه بعداً"
                className="min-h-11 rounded-xl border border-[var(--athena-border)] px-3 py-2 text-sm font-semibold transition hover:bg-[var(--athena-mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-teal)] sm:px-4"
              >
                <span className="sm:hidden">خروج</span>
                <span className="hidden sm:inline">خروج و ادامه بعداً</span>
              </button>
              <button
                ref={abandonTriggerRef}
                type="button"
                aria-label="پایان دادن به جلسه"
                onClick={() => setAbandonOpen(true)}
                className="min-h-11 rounded-xl px-2 py-2 text-sm font-semibold text-[var(--athena-error)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-error)] sm:px-3"
              >
                <span className="sm:hidden">پایان</span>
                <span className="hidden sm:inline">پایان دادن به جلسه</span>
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

        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:py-7">
          <div className="min-w-0 space-y-5">
            <SpeakingExaminer
              playbackState={playbackState}
              prompt={prompt}
              session={state.session}
              speechUrl={speechUrl}
              view={phaseView}
              onPause={pauseExaminerAudio}
              onPlay={() => void playExaminerAudio()}
            />

            {reviewNotice && (
              <div
                role="status"
                className="rounded-xl border border-[var(--athena-warning-border)] bg-[var(--athena-warning-surface)] px-4 py-3 text-base leading-7 text-[var(--athena-ink)]"
              >
                {reviewNotice}
              </div>
            )}

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

            <div className="-mx-4 sm:mx-0">
              {state.phase === 'review_attention' && reviewAnswer?.review ? (
                <SpeakingReviewAttention
                  answer={reviewAnswer}
                  onContinue={continueAfterReview}
                  onReplace={() => replaceFlaggedAnswer(reviewAnswer)}
                />
              ) : (
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
                  replacement={Boolean(replacementAnswer)}
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
              )}
            </div>

            <SpeakingTranscript collapsible session={state.session} />
          </div>
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
