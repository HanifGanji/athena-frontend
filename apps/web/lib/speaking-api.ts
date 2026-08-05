import { apiRequest, jsonBody } from '@/lib/api-client'

export type SpeakingExamType = 'ielts' | 'toefl'
export type SpeakingSessionStatus = 'in_progress' | 'completed' | 'abandoned'
export type SpeakingStage =
  | 'ielts_part_1'
  | 'ielts_part_2_long'
  | 'ielts_part_2_follow_up'
  | 'ielts_part_3'
  | 'toefl_repeat'
  | 'toefl_interview'
  | 'completed'
  | ''

export type SpeakingTurnKind =
  | 'greeting'
  | 'question'
  | 'cue_card'
  | 'repeat_sentence'
  | 'interview_question'
  | 'answer'
  | 'closing'

export type SpeakingTurn = {
  id: string
  role: 'examiner' | 'learner'
  kind: SpeakingTurnKind
  stage: SpeakingStage
  item_index: number | null
  sequence: number
  transcript: string | null
  prompt_id: string | null
  suggested_duration_ms: number | null
  recording_duration_ms: number | null
  duration_difference_ms: number | null
  is_hidden: boolean
  created_at: string
}

export type SpeakingTimingSummary = {
  actual_duration_ms: number
  suggested_duration_ms: number
  difference_ms: number
}

export type SpeakingSessionSummary = {
  id: string
  exam_type: SpeakingExamType
  status: SpeakingSessionStatus
  current_stage: SpeakingStage
  current_item_index: number
  required_response_count: number
  response_count: number
  timing_summary: SpeakingTimingSummary
  started_at: string
  updated_at: string
  completed_at: string | null
  abandoned_at: string | null
}

export type SpeakingSession = SpeakingSessionSummary & {
  prompt_version: string
  current_prompt_id: string | null
  turns: SpeakingTurn[]
}

export type SpeakingResponseInput = {
  audio: Blob
  clientEventId: string
  filename: string
  promptId: string
  recordingDurationMs: number
}

export const speakingApi = {
  listSessions: () =>
    apiRequest<SpeakingSessionSummary[]>('/speaking/sessions/'),

  createSession: (examType: SpeakingExamType) =>
    apiRequest<SpeakingSession>('/speaking/sessions/', {
      method: 'POST',
      body: jsonBody({ exam_type: examType }),
    }),

  getSession: (sessionId: string) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/`),

  advance: (sessionId: string) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/advance/`, {
      method: 'POST',
      body: jsonBody({}),
    }),

  submitResponse: (sessionId: string, input: SpeakingResponseInput) => {
    const formData = new FormData()
    formData.append('audio', input.audio, input.filename)
    formData.append('prompt_id', input.promptId)
    formData.append('client_event_id', input.clientEventId)
    formData.append('recording_duration_ms', String(input.recordingDurationMs))
    return apiRequest<SpeakingSession>(
      `/speaking/sessions/${sessionId}/responses/`,
      { method: 'POST', body: formData },
    )
  },

  getSpeech: (sessionId: string, turnId: string) =>
    apiRequest<Blob>(
      `/speaking/sessions/${sessionId}/turns/${turnId}/speech/`,
      { method: 'POST', body: jsonBody({}), responseType: 'blob' },
    ),

  abandon: (sessionId: string) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/abandon/`, {
      method: 'POST',
      body: jsonBody({}),
    }),
}
