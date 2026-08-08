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

export type SpeakingReviewVerdict = 'clear' | 'note' | 'warning'
export type SpeakingReviewIssueCode =
  | 'insufficient_response'
  | 'off_topic'
  | 'non_english'
  | 'inappropriate_content'
  | 'unusable_transcript'
  | 'repeat_mismatch'

export type SpeakingTurnReview = {
  verdict: SpeakingReviewVerdict
  issue_code: SpeakingReviewIssueCode | null
  message: string
  replacement_allowed: boolean
  reviewed_at: string
}

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
  revision: 1 | 2
  review: SpeakingTurnReview | null
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
  topic_labels: string[]
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

export type SpeakingReplacementInput = Omit<
  SpeakingResponseInput,
  'promptId'
> & {
  expectedRevision: 1 | 2
}

export type SpeakingFeedbackStrength = {
  title: string
  evidence: string
}

export type SpeakingFeedbackImprovement = {
  learner_excerpt: string
  improved_version: string
  explanation: string
}

export type SpeakingFeedbackNextGoal = {
  title: string
  practice: string
}

export type SpeakingFeedback = {
  session_id: string
  strengths: SpeakingFeedbackStrength[]
  improvements: SpeakingFeedbackImprovement[]
  next_goal: SpeakingFeedbackNextGoal
  generated_at: string
}

export const speakingApi = {
  listSessions: (signal?: AbortSignal) =>
    apiRequest<SpeakingSessionSummary[]>('/speaking/sessions/', { signal }),

  createSession: (examType: SpeakingExamType, signal?: AbortSignal) =>
    apiRequest<SpeakingSession>('/speaking/sessions/', {
      method: 'POST',
      body: jsonBody({ exam_type: examType }),
      signal,
    }),

  getSession: (sessionId: string, signal?: AbortSignal) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/`, { signal }),

  advance: (sessionId: string, signal?: AbortSignal) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/advance/`, {
      method: 'POST',
      body: jsonBody({}),
      signal,
    }),

  submitResponse: (
    sessionId: string,
    input: SpeakingResponseInput,
    signal?: AbortSignal,
  ) => {
    const formData = new FormData()
    formData.append('audio', input.audio, input.filename)
    formData.append('prompt_id', input.promptId)
    formData.append('client_event_id', input.clientEventId)
    formData.append('recording_duration_ms', String(input.recordingDurationMs))
    return apiRequest<SpeakingSession>(
      `/speaking/sessions/${sessionId}/responses/`,
      { method: 'POST', body: formData, signal },
    )
  },

  reviewResponse: (sessionId: string, answerId: string, signal?: AbortSignal) =>
    apiRequest<SpeakingSession>(
      `/speaking/sessions/${sessionId}/turns/${answerId}/review/`,
      { method: 'POST', body: jsonBody({}), signal },
    ),

  replaceResponse: (
    sessionId: string,
    answerId: string,
    input: SpeakingReplacementInput,
    signal?: AbortSignal,
  ) => {
    const formData = new FormData()
    formData.append('audio', input.audio, input.filename)
    formData.append('client_event_id', input.clientEventId)
    formData.append('recording_duration_ms', String(input.recordingDurationMs))
    formData.append('expected_revision', String(input.expectedRevision))
    return apiRequest<SpeakingSession>(
      `/speaking/sessions/${sessionId}/turns/${answerId}/replacement/`,
      { method: 'POST', body: formData, signal },
    )
  },

  getSpeech: (sessionId: string, turnId: string, signal?: AbortSignal) =>
    apiRequest<Blob>(
      `/speaking/sessions/${sessionId}/turns/${turnId}/speech/`,
      { method: 'POST', body: jsonBody({}), responseType: 'blob', signal },
    ),

  abandon: (sessionId: string, signal?: AbortSignal) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/abandon/`, {
      method: 'POST',
      body: jsonBody({}),
      signal,
    }),

  getOrCreateFeedback: (sessionId: string, signal?: AbortSignal) =>
    apiRequest<SpeakingFeedback>(`/speaking/sessions/${sessionId}/feedback/`, {
      method: 'POST',
      body: jsonBody({}),
      signal,
    }),

  getStaffPreview: () =>
    apiRequest<{ session: SpeakingSession }>('/staff/test-previews/speaking/', {
      method: 'POST',
      body: jsonBody({}),
    }),
}
