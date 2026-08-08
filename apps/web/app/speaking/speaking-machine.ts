import type {
  SpeakingExamType,
  SpeakingSession,
  SpeakingSessionSummary,
} from '@/lib/speaking-api'

export type SpeakingPhase =
  | 'landing'
  | 'creating_session'
  | 'loading_examiner'
  | 'examiner_ready'
  | 'playing_examiner'
  | 'ready_to_record'
  | 'requesting_permission'
  | 'recording'
  | 'stopping_recording'
  | 'local_review'
  | 'submitting'
  | 'reviewing_response'
  | 'review_attention'
  | 'generating_next'
  | 'recoverable_error'
  | 'completed'
  | 'history_detail'
  | 'loading_feedback'

export type RetryAction = 'advance' | 'speech' | 'submit' | null

export type HistoryStatus = 'loading' | 'ready' | 'error'

export type RecorderMode =
  | 'idle'
  | 'ready'
  | 'permission'
  | 'recording'
  | 'preparing_take'
  | 'review'
  | 'submitting'
  | 'waiting_next'
  | 'error'

export type SpeakingPhaseView = {
  announcement: string
  examinerMode: 'idle' | 'loading' | 'ready' | 'playing'
  examinerStatus: string
  primaryStatus: string | null
  recorderMode: RecorderMode
  showPreparedTake: boolean
}

const PREPARING_PRACTICE = 'در حال آماده‌سازی تمرین…'
const SUBMITTING_RESPONSE = 'در حال ثبت پاسخ…'
const PREPARING_NEXT = 'پاسخ ثبت شد؛ سؤال بعدی آماده می‌شود…'
const PREPARING_SPEECH = 'صدا در حال آماده‌شدن است…'
const PREPARING_FEEDBACK = 'در حال آماده‌سازی بازخورد…'

export function deriveSpeakingView(phase: SpeakingPhase): SpeakingPhaseView {
  const defaults: SpeakingPhaseView = {
    announcement: '',
    examinerMode: 'idle',
    examinerStatus: 'نوبت شما',
    primaryStatus: null,
    recorderMode: 'idle',
    showPreparedTake: false,
  }

  switch (phase) {
    case 'creating_session':
      return {
        ...defaults,
        announcement: PREPARING_PRACTICE,
        examinerMode: 'loading',
        examinerStatus: PREPARING_PRACTICE,
        primaryStatus: PREPARING_PRACTICE,
      }
    case 'loading_examiner':
      return {
        ...defaults,
        announcement: PREPARING_SPEECH,
        examinerMode: 'loading',
        examinerStatus: PREPARING_SPEECH,
        primaryStatus: PREPARING_SPEECH,
      }
    case 'examiner_ready':
      return {
        ...defaults,
        announcement: 'صدای ممتحن آمادهٔ پخش است.',
        examinerMode: 'ready',
        examinerStatus: 'آمادهٔ پخش',
      }
    case 'playing_examiner':
      return {
        ...defaults,
        announcement: 'صدای ممتحن در حال پخش است.',
        examinerMode: 'playing',
        examinerStatus: 'در حال پخش',
      }
    case 'ready_to_record':
      return {
        ...defaults,
        announcement: 'اکنون می‌توانید پاسخ را ضبط کنید.',
        recorderMode: 'ready',
      }
    case 'requesting_permission':
      return {
        ...defaults,
        announcement: 'درخواست دسترسی میکروفن نمایش داده شد.',
        recorderMode: 'permission',
      }
    case 'recording':
      return {
        ...defaults,
        announcement: 'ضبط پاسخ آغاز شد.',
        recorderMode: 'recording',
      }
    case 'stopping_recording':
      return {
        ...defaults,
        announcement: 'در حال آماده‌سازی فایل صوتی…',
        recorderMode: 'preparing_take',
      }
    case 'local_review':
      return {
        ...defaults,
        announcement: 'پاسخ برای بازبینی روی دستگاه آماده است.',
        recorderMode: 'review',
        showPreparedTake: true,
      }
    case 'submitting':
      return {
        ...defaults,
        announcement: SUBMITTING_RESPONSE,
        examinerMode: 'loading',
        examinerStatus: SUBMITTING_RESPONSE,
        primaryStatus: SUBMITTING_RESPONSE,
        recorderMode: 'submitting',
        showPreparedTake: true,
      }
    case 'reviewing_response':
      return {
        ...defaults,
        announcement: 'پاسخ ذخیره شد؛ بررسی کوتاه در حال انجام است…',
        examinerMode: 'loading',
        examinerStatus: 'پاسخ ذخیره شد؛ بررسی کوتاه در حال انجام است…',
        primaryStatus: 'پاسخ ذخیره شد؛ بررسی کوتاه در حال انجام است…',
        recorderMode: 'waiting_next',
        showPreparedTake: true,
      }
    case 'review_attention':
      return {
        ...defaults,
        announcement: 'پیش از سؤال بعدی، یک نکته دربارهٔ پاسخ نمایش داده شد.',
        examinerStatus: 'نیاز به توجه',
        recorderMode: 'idle',
      }
    case 'generating_next':
      return {
        ...defaults,
        announcement: PREPARING_NEXT,
        examinerMode: 'loading',
        examinerStatus: PREPARING_NEXT,
        primaryStatus: PREPARING_NEXT,
        recorderMode: 'waiting_next',
        showPreparedTake: true,
      }
    case 'recoverable_error':
      return {
        ...defaults,
        announcement: 'یک خطای قابل بازیابی رخ داد.',
        examinerStatus: 'نیاز به تلاش دوباره',
        recorderMode: 'error',
        showPreparedTake: true,
      }
    case 'completed':
      return { ...defaults, announcement: 'تمرین کامل شد.' }
    case 'loading_feedback':
      return {
        ...defaults,
        announcement: PREPARING_FEEDBACK,
        examinerMode: 'loading',
        examinerStatus: PREPARING_FEEDBACK,
        primaryStatus: PREPARING_FEEDBACK,
      }
    case 'landing':
    case 'history_detail':
      return defaults
  }
}

export type SpeakingMachineState = {
  examType: SpeakingExamType
  error: string | null
  historyError: string | null
  historyStatus: HistoryStatus
  phase: SpeakingPhase
  retryAction: RetryAction
  session: SpeakingSession | null
  sessions: SpeakingSessionSummary[]
}

export type SpeakingMachineAction =
  | { type: 'history_loading' }
  | { type: 'history_loaded'; sessions: SpeakingSessionSummary[] }
  | { type: 'history_failed'; message: string }
  | { type: 'select_exam'; examType: SpeakingExamType }
  | { type: 'set_phase'; phase: SpeakingPhase }
  | { type: 'landing_error'; message: string }
  | { type: 'inline_error'; message: string; phase: SpeakingPhase }
  | { type: 'session_loaded'; session: SpeakingSession; phase: SpeakingPhase }
  | {
      type: 'fail'
      message: string
      retryAction: RetryAction
      session?: SpeakingSession
    }
  | { type: 'clear_error'; phase?: SpeakingPhase }
  | { type: 'show_history'; session: SpeakingSession }
  | { type: 'back_to_landing'; sessions?: SpeakingSessionSummary[] }

export const initialSpeakingState: SpeakingMachineState = {
  examType: 'ielts',
  error: null,
  historyError: null,
  historyStatus: 'loading',
  phase: 'landing',
  retryAction: null,
  session: null,
  sessions: [],
}

export function speakingMachine(
  state: SpeakingMachineState,
  action: SpeakingMachineAction,
): SpeakingMachineState {
  switch (action.type) {
    case 'history_loading':
      return { ...state, historyError: null, historyStatus: 'loading' }
    case 'history_loaded':
      return {
        ...state,
        historyError: null,
        historyStatus: 'ready',
        sessions: action.sessions,
      }
    case 'history_failed':
      return {
        ...state,
        historyError: action.message,
        historyStatus: 'error',
      }
    case 'select_exam':
      return { ...state, examType: action.examType }
    case 'set_phase':
      return {
        ...state,
        error: null,
        phase: action.phase,
        retryAction: null,
      }
    case 'landing_error':
      return {
        ...state,
        error: action.message,
        phase: 'landing',
        retryAction: null,
      }
    case 'inline_error':
      return {
        ...state,
        error: action.message,
        phase: action.phase,
        retryAction: null,
      }
    case 'session_loaded':
      return {
        ...state,
        error: null,
        examType: action.session.exam_type,
        phase: action.phase,
        retryAction: null,
        session: action.session,
      }
    case 'fail':
      return {
        ...state,
        error: action.message,
        phase: 'recoverable_error',
        retryAction: action.retryAction,
        session: action.session ?? state.session,
      }
    case 'clear_error':
      return {
        ...state,
        error: null,
        phase: action.phase ?? state.phase,
        retryAction: null,
      }
    case 'show_history':
      return {
        ...state,
        error: null,
        examType: action.session.exam_type,
        phase: 'history_detail',
        retryAction: null,
        session: action.session,
      }
    case 'back_to_landing':
      return {
        ...state,
        error: null,
        phase: 'landing',
        retryAction: null,
        session: null,
        sessions: action.sessions ?? state.sessions,
      }
  }
}
