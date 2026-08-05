import type {
  SpeakingExamType,
  SpeakingSession,
  SpeakingSessionSummary,
} from '@/lib/speaking-api'

export type SpeakingPhase =
  | 'loading_history'
  | 'landing'
  | 'checking_microphone'
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
  | 'generating_next'
  | 'recoverable_error'
  | 'completed'
  | 'history_detail'

export type MicrophoneState =
  'unknown' | 'checking' | 'ready' | 'denied' | 'unavailable'

export type RetryAction =
  | 'load_history'
  | 'create_session'
  | 'advance'
  | 'speech'
  | 'submit'
  | 'resume'
  | null

export type SpeakingMachineState = {
  examType: SpeakingExamType
  error: string | null
  microphone: MicrophoneState
  phase: SpeakingPhase
  retryAction: RetryAction
  session: SpeakingSession | null
  sessions: SpeakingSessionSummary[]
}

export type SpeakingMachineAction =
  | { type: 'history_loaded'; sessions: SpeakingSessionSummary[] }
  | { type: 'select_exam'; examType: SpeakingExamType }
  | { type: 'microphone_checking' }
  | { type: 'microphone_result'; microphone: MicrophoneState }
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
  microphone: 'unknown',
  phase: 'loading_history',
  retryAction: null,
  session: null,
  sessions: [],
}

export function speakingMachine(
  state: SpeakingMachineState,
  action: SpeakingMachineAction,
): SpeakingMachineState {
  switch (action.type) {
    case 'history_loaded':
      return {
        ...state,
        error: null,
        phase: 'landing',
        retryAction: null,
        sessions: action.sessions,
      }
    case 'select_exam':
      return { ...state, examType: action.examType }
    case 'microphone_checking':
      return {
        ...state,
        error: null,
        microphone: 'checking',
        phase: 'checking_microphone',
        retryAction: null,
      }
    case 'microphone_result':
      return {
        ...state,
        microphone: action.microphone,
        phase: 'landing',
      }
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
