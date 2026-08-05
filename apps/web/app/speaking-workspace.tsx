'use client'

import Link from 'next/link'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { SpeakingExaminer } from '@/app/speaking/speaking-examiner'
import { SpeakingLanding } from '@/app/speaking/speaking-landing'
import {
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

function activePrompt(session: SpeakingSession | null) {
  if (!session?.current_prompt_id) return null
  return (
    session.turns.find((turn) => turn.id === session.current_prompt_id) ?? null
  )
}

function closingTurn(session: SpeakingSession) {
  return [...session.turns].reverse().find((turn) => turn.kind === 'closing')
}

function phaseAnnouncement(phase: SpeakingPhase) {
  const messages: Partial<Record<SpeakingPhase, string>> = {
    creating_session: 'در حال ساخت جلسهٔ جدید.',
    loading_examiner: 'در حال آماده‌سازی صدای ممتحن.',
    examiner_ready: 'صدای ممتحن آمادهٔ پخش است.',
    playing_examiner: 'صدای ممتحن در حال پخش است.',
    ready_to_record: 'اکنون می‌توانید پاسخ را ضبط کنید.',
    recording: 'ضبط پاسخ آغاز شد.',
    local_review: 'پاسخ برای بازبینی محلی آماده است.',
    submitting: 'پاسخ در حال تبدیل به متن و ثبت است.',
    generating_next: 'پاسخ ثبت شد و سؤال بعدی در حال آماده‌شدن است.',
    completed: 'تمرین کامل شد.',
    recoverable_error: 'یک خطای قابل بازیابی رخ داد.',
  }
  return messages[phase] ?? ''
}

export function SpeakingWorkspace() {
  const [state, dispatch] = useReducer(speakingMachine, initialSpeakingState)
  const [prepared, setPrepared] = useState<PreparedTake | null>(null)
  const [speechUrl, setSpeechUrl] = useState<string | null>(null)
  const [abandonOpen, setAbandonOpen] = useState(false)
  const [completionSpeechError, setCompletionSpeechError] = useState<
    string | null
  >(null)
  const mountedRef = useRef(true)
  const preparedRef = useRef<PreparedTake | null>(null)
  const speechUrlRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef<SpeakingSession | null>(null)
  const retrySessionIdRef = useRef<string | null>(null)
  const taskHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const abandonTriggerRef = useRef<HTMLButtonElement | null>(null)
  const abandonDialogRef = useRef<HTMLElement | null>(null)

  const replacePrepared = useCallback((next: PreparedTake | null) => {
    if (
      preparedRef.current &&
      preparedRef.current.previewUrl !== next?.previewUrl
    ) {
      URL.revokeObjectURL(preparedRef.current.previewUrl)
    }
    preparedRef.current = next
    setPrepared(next)
  }, [])

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

  useEffect(() => {
    sessionRef.current = state.session
  }, [state.session])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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
    try {
      const sessions = await speakingApi.listSessions()
      if (mountedRef.current) dispatch({ type: 'history_loaded', sessions })
    } catch (reason) {
      if (mountedRef.current) {
        dispatch({
          type: 'landing_error',
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
    if (state.session?.current_prompt_id) taskHeadingRef.current?.focus()
  }, [state.session?.current_prompt_id])

  useEffect(() => {
    if (!abandonOpen) return
    const trigger = abandonTriggerRef.current
    const dialog = abandonDialogRef.current
    const focusable = Array.from(
      dialog?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [],
    )

    function handleDialogKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAbandonOpen(false)
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
  }, [abandonOpen])

  async function checkMicrophone() {
    dispatch({ type: 'microphone_checking' })
    if (!navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: 'microphone_result', microphone: 'unavailable' })
      return 'unavailable' as const
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      if (mountedRef.current) {
        dispatch({ type: 'microphone_result', microphone: 'ready' })
      }
      return 'ready' as const
    } catch (reason) {
      const denied =
        reason instanceof DOMException && reason.name === 'NotAllowedError'
      const result = denied ? ('denied' as const) : ('unavailable' as const)
      if (mountedRef.current) {
        dispatch({ type: 'microphone_result', microphone: result })
      }
      return result
    }
  }

  async function playExaminerAudio(completed = false) {
    const audio = audioRef.current
    if (!audio) return
    if (!completed) dispatch({ type: 'set_phase', phase: 'playing_examiner' })
    try {
      await audio.play()
    } catch {
      if (!completed && sessionRef.current) {
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
    autoPlay = true,
  ) {
    const completed = session.status === 'completed'
    sessionRef.current = session
    setCompletionSpeechError(null)
    if (!completed) {
      dispatch({ type: 'session_loaded', session, phase: 'loading_examiner' })
    }
    try {
      const blob = await speakingApi.getSpeech(session.id, turn.id)
      if (!mountedRef.current) return
      const url = URL.createObjectURL(blob)
      replaceSpeech(url)
      const audio = new Audio(url)
      audio.preload = 'auto'
      audioRef.current = audio
      audio.onended = () => {
        if (!mountedRef.current || completed) return
        dispatch({ type: 'session_loaded', session, phase: 'ready_to_record' })
      }
      audio.onerror = () => {
        if (!mountedRef.current) return
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
      if (autoPlay) await playExaminerAudio(completed)
    } catch (reason) {
      if (!mountedRef.current) return
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

  async function advance(session: SpeakingSession) {
    dispatch({ type: 'session_loaded', session, phase: 'generating_next' })
    try {
      const advanced = await speakingApi.advance(session.id)
      if (!mountedRef.current) return
      if (advanced.status === 'completed') {
        dispatch({
          type: 'session_loaded',
          session: advanced,
          phase: 'completed',
        })
        const closing = closingTurn(advanced)
        if (closing) await loadSpeech(advanced, closing)
        return
      }
      const prompt = activePrompt(advanced)
      if (!prompt) throw new Error('Missing examiner prompt')
      await loadSpeech(advanced, prompt)
    } catch (reason) {
      if (!mountedRef.current) return
      dispatch({
        type: 'fail',
        message: friendlyError(
          reason,
          'سؤال بعدی آماده نشد. پاسخ قبلی ذخیره شده است؛ دوباره تلاش کن.',
        ),
        retryAction: 'advance',
        session,
      })
    }
  }

  async function startPractice() {
    if (state.microphone === 'unknown') await checkMicrophone()
    dispatch({ type: 'set_phase', phase: 'creating_session' })
    replacePrepared(null)
    replaceSpeech(null)
    try {
      const session = await speakingApi.createSession(state.examType)
      if (!mountedRef.current) return
      await advance(session)
    } catch (reason) {
      if (mountedRef.current) {
        dispatch({
          type: 'landing_error',
          message: friendlyError(reason, 'ساخت جلسه ممکن نشد. دوباره تلاش کن.'),
        })
      }
    }
  }

  async function submitResponse() {
    const session = state.session
    const prompt = activePrompt(session)
    const take = preparedRef.current
    if (!session || !prompt || !take) return
    dispatch({ type: 'set_phase', phase: 'submitting' })
    try {
      const committed = await speakingApi.submitResponse(session.id, {
        audio: take.blob,
        clientEventId: take.clientEventId,
        filename: take.filename,
        promptId: prompt.id,
        recordingDurationMs: take.durationMs,
      })
      if (!mountedRef.current) return
      replacePrepared(null)
      if (committed.status === 'completed') {
        dispatch({
          type: 'session_loaded',
          session: committed,
          phase: 'completed',
        })
        const closing = closingTurn(committed)
        if (closing) await loadSpeech(committed, closing)
      } else {
        await advance(committed)
      }
    } catch (reason) {
      if (!mountedRef.current) return
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
    retrySessionIdRef.current = summary.id
    dispatch({ type: 'set_phase', phase: 'loading_examiner' })
    replacePrepared(null)
    replaceSpeech(null)
    try {
      const session = await speakingApi.getSession(summary.id)
      if (!mountedRef.current) return
      if (session.status !== 'in_progress') {
        dispatch({ type: 'show_history', session })
        return
      }
      const prompt = activePrompt(session)
      if (prompt) await loadSpeech(session, prompt)
      else await advance(session)
    } catch (reason) {
      if (mountedRef.current) {
        dispatch({
          type: 'landing_error',
          message: friendlyError(reason, 'جلسه بارگذاری نشد. دوباره تلاش کن.'),
        })
      }
    }
  }

  async function inspectSession(summary: SpeakingSessionSummary) {
    retrySessionIdRef.current = summary.id
    dispatch({ type: 'set_phase', phase: 'loading_examiner' })
    try {
      const session = await speakingApi.getSession(summary.id)
      if (mountedRef.current) dispatch({ type: 'show_history', session })
    } catch (reason) {
      if (mountedRef.current) {
        dispatch({
          type: 'landing_error',
          message: friendlyError(reason, 'متن جلسه بارگذاری نشد.'),
        })
      }
    }
  }

  async function backToLanding() {
    replacePrepared(null)
    replaceSpeech(null)
    setAbandonOpen(false)
    setCompletionSpeechError(null)
    dispatch({ type: 'back_to_landing' })
    try {
      const sessions = await speakingApi.listSessions()
      if (mountedRef.current) dispatch({ type: 'history_loaded', sessions })
    } catch {
      // Keep the already loaded history; the user can still start another session.
    }
  }

  async function confirmAbandon() {
    if (!state.session) return
    try {
      const session = await speakingApi.abandon(state.session.id)
      if (!mountedRef.current) return
      setAbandonOpen(false)
      dispatch({ type: 'show_history', session })
    } catch (reason) {
      if (mountedRef.current) {
        setAbandonOpen(false)
        dispatch({
          type: 'fail',
          message: friendlyError(reason, 'رها کردن جلسه انجام نشد.'),
          retryAction: null,
          session: state.session,
        })
      }
    }
  }

  async function retry() {
    if (state.retryAction === 'load_history') return loadHistory()
    if (state.retryAction === 'create_session') return startPractice()
    if (state.retryAction === 'submit') return submitResponse()
    if (state.retryAction === 'advance' && state.session) {
      return advance(state.session)
    }
    if (state.retryAction === 'speech' && state.session) {
      const prompt = activePrompt(state.session)
      if (prompt) return loadSpeech(state.session, prompt)
    }
    if (state.retryAction === 'resume' && retrySessionIdRef.current) {
      const summary = state.sessions.find(
        (session) => session.id === retrySessionIdRef.current,
      )
      if (summary) return resumeSession(summary)
    }
  }

  if (state.phase === 'loading_history') {
    return (
      <main className="grid min-h-svh place-items-center bg-[var(--athena-canvas)] p-6 text-[var(--athena-ink)]">
        <div className="text-center">
          <span className="mx-auto block size-3 animate-pulse rounded-full bg-[var(--athena-rust)] motion-reduce:animate-none" />
          <p className="mt-4 text-sm font-black">در حال آماده‌سازی Speaking…</p>
        </div>
      </main>
    )
  }

  if (
    ['landing', 'checking_microphone', 'creating_session'].includes(
      state.phase,
    ) ||
    !state.session
  ) {
    return (
      <SpeakingLanding
        error={state.error}
        examType={state.examType}
        microphone={state.microphone}
        phase={state.phase}
        sessions={state.sessions}
        onCheckMicrophone={() => void checkMicrophone()}
        onInspect={(session) => void inspectSession(session)}
        onResume={(session) => void resumeSession(session)}
        onSelectExam={(examType) => dispatch({ type: 'select_exam', examType })}
        onStart={() => void startPractice()}
      />
    )
  }

  if (state.phase === 'history_detail') {
    return (
      <SpeakingSummary
        historyMode
        session={state.session}
        onBack={() => void backToLanding()}
        onStartAnother={() => void backToLanding()}
      />
    )
  }

  if (state.phase === 'completed') {
    return (
      <SpeakingSummary
        session={state.session}
        speechReady={Boolean(speechUrl)}
        speechError={completionSpeechError}
        onBack={() => void backToLanding()}
        onStartAnother={() => void backToLanding()}
        onPlayClosing={() => void playExaminerAudio(true)}
        onRetrySpeech={() => {
          const closing = closingTurn(state.session!)
          if (closing) void loadSpeech(state.session!, closing)
        }}
      />
    )
  }

  const prompt = activePrompt(state.session)
  const progress = Math.round(
    (state.session.response_count / state.session.required_response_count) *
      100,
  )

  return (
    <main className="min-h-svh bg-[var(--athena-workspace)] text-[var(--athena-ink)]">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {phaseAnnouncement(state.phase)}
      </p>
      <header className="sticky top-0 z-30 border-b border-[var(--athena-border)] bg-[var(--athena-paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="بازگشت به صفحهٔ اصلی"
              className="rounded-lg text-xl font-black focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)]"
            >
              آتنا
            </Link>
            <span
              aria-hidden="true"
              className="h-7 w-px bg-[var(--athena-border)]"
            />
            <div className="min-w-0">
              <h1
                ref={taskHeadingRef}
                tabIndex={-1}
                className="truncate text-sm font-black outline-none"
              >
                تمرین Speaking {state.session.exam_type.toUpperCase()}
              </h1>
              <p className="mt-0.5 text-[10px] text-[var(--athena-muted)]">
                {state.session.response_count.toLocaleString('fa-IR')} از{' '}
                {state.session.required_response_count.toLocaleString('fa-IR')}{' '}
                پاسخ ثبت شده
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void backToLanding()}
              className="min-h-11 rounded-xl border border-[var(--athena-border)] px-3 py-2 text-xs font-black transition hover:bg-[var(--athena-mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--athena-teal)] sm:px-4"
            >
              ذخیره و خروج
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
            phase={state.phase}
            prompt={prompt}
            session={state.session}
            speechUrl={speechUrl}
            onPlay={() => void playExaminerAudio()}
          />

          {state.phase === 'recoverable_error' &&
            state.error &&
            state.retryAction !== 'submit' && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900"
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

          <div className="sticky bottom-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:pb-0">
            <SpeakingRecorder
              error={state.retryAction === 'submit' ? state.error : null}
              phase={state.phase}
              prepared={prepared}
              prompt={prompt}
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
              onPhase={(phase) => dispatch({ type: 'set_phase', phase })}
              onPrepared={replacePrepared}
              onSubmit={() => void submitResponse()}
            />
          </div>

          <div className="lg:hidden">
            <SpeakingTranscript session={state.session} />
          </div>
        </div>

        <aside className="hidden min-h-0 lg:block">
          <div className="sticky top-24">
            <SpeakingTranscript session={state.session} />
          </div>
        </aside>
      </div>

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
              را ادامه بدهی. برای ادامه در آینده، «ذخیره و خروج» را انتخاب کن.
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
