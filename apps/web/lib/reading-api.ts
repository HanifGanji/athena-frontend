import { apiRequest, jsonBody } from '@/lib/api-client'

export type ReadingTestSummary = {
  id: string
  slug: string
  module: 'academic' | 'general_training'
  version_number: number
  title: string
  description: string
  experience_type: 'diagnostic' | 'simulation'
  delivery_settings: {
    allowed_attempt_modes?: ReadingAttempt['mode'][]
    question_count?: number
    future_challenge?: {
      eligible: boolean
      selection_tags: string[]
      difficulty?: string
    }
  }
  time_limit_seconds: number
  question_count: number
}

export type ContentBlock = {
  id: string
  kind: string
  label: string
  sequence: number
  text_content: string
  metadata: Record<string, unknown>
}

export type StimulusDocument = {
  id: string
  label: string
  title: string
  kind: string
  sequence: number
  blocks: ContentBlock[]
}

export type StimulusBundle = {
  id: string
  title: string
  kind: string
  sequence: number
  documents: StimulusDocument[]
}

export type QuestionOption = {
  value: string
  label: string
  sequence: number
}

export type ResponseSlot = {
  id: string
  display_number: number
  prompt: string
  sequence: number
  score_weight: number
  is_example: boolean
  skills: string[]
  options: QuestionOption[]
}

export type QuestionGroup = {
  id: string
  stimulus_bundle_id: string
  interaction_type: string
  instructions: string
  sequence: number
  response_rules: Record<string, unknown>
  options: QuestionOption[]
  response_slots: ResponseSlot[]
}

export type ReadingSection = {
  id: string
  number: number
  title: string
  sequence: number
  recommended_minutes: number
  stimulus_bundles: StimulusBundle[]
  question_groups: QuestionGroup[]
}

export type ReadingTest = Omit<ReadingTestSummary, 'question_count'> & {
  sections: ReadingSection[]
}

export type ReadingAttempt = {
  id: string
  test_version_id: string
  mode: 'practice' | 'timed_mock'
  status: 'in_progress' | 'submitted' | 'abandoned'
  started_at: string
  submitted_at: string | null
  raw_score: number | null
  maximum_score: number | null
}

export type EvaluationResult = {
  question_id: string
  question_number: number
  submitted_value: unknown
  correct_value: unknown
  awarded_score: number
  result_code: 'correct' | 'incorrect' | 'unanswered' | 'invalid'
  evidence: { block_id: string; quote: string }[]
}

export type Evaluation = {
  evaluator_version: string
  raw_score: number
  maximum_score: number
  created_at: string
  results: EvaluationResult[]
}

export type AgentFeedback = {
  model_id: string
  summary_fa: string
  strengths_fa: string[]
  improvements_fa: string[]
  next_action_fa: string
  created_at: string
  cached: boolean
}

export const readingApi = {
  listTests: (signal?: AbortSignal) =>
    apiRequest<ReadingTestSummary[]>('/reading/tests/', { signal }),
  getTest: (slug: string) => apiRequest<ReadingTest>(`/reading/tests/${slug}/`),
  startAttempt: (slug: string, mode: ReadingAttempt['mode']) =>
    apiRequest<ReadingAttempt>(`/reading/tests/${slug}/attempts/`, {
      method: 'POST',
      body: jsonBody({ mode }),
    }),
  saveResponse: (
    attemptId: string,
    groupId: string,
    answers: Record<string, string>,
    clientEventId = crypto.randomUUID(),
  ) =>
    apiRequest(`/reading/attempts/${attemptId}/responses/${groupId}/`, {
      method: 'PUT',
      body: jsonBody({
        client_event_id: clientEventId,
        answer_payload: { answers },
      }),
    }),
  submitAttempt: (attemptId: string) =>
    apiRequest<Evaluation>(`/reading/attempts/${attemptId}/submit/`, {
      method: 'POST',
      body: jsonBody({}),
    }),
  requestFeedback: (attemptId: string) =>
    apiRequest<AgentFeedback>(`/reading/attempts/${attemptId}/feedback/`, {
      method: 'POST',
      body: jsonBody({}),
    }),
}
