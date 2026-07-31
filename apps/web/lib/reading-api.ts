const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export type ReadingTestSummary = {
  id: string
  slug: string
  module: 'academic' | 'general_training'
  version_number: number
  title: string
  description: string
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

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new ApiError(
      payload?.detail ?? 'ارتباط با سرور ناموفق بود.',
      response.status,
    )
  }
  return (await response.json()) as T
}

export const readingApi = {
  listTests: (signal?: AbortSignal) =>
    request<ReadingTestSummary[]>('/reading/tests/', { signal }),
  getTest: (slug: string) => request<ReadingTest>(`/reading/tests/${slug}/`),
  startAttempt: (slug: string, mode: ReadingAttempt['mode']) =>
    request<ReadingAttempt>(`/reading/tests/${slug}/attempts/`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),
  saveResponse: (
    attemptId: string,
    groupId: string,
    answers: Record<string, string>,
    clientEventId = crypto.randomUUID(),
  ) =>
    request(`/reading/attempts/${attemptId}/responses/${groupId}/`, {
      method: 'PUT',
      body: JSON.stringify({
        client_event_id: clientEventId,
        answer_payload: { answers },
      }),
    }),
  submitAttempt: (attemptId: string) =>
    request<Evaluation>(`/reading/attempts/${attemptId}/submit/`, {
      method: 'POST',
      body: '{}',
    }),
  requestFeedback: (attemptId: string) =>
    request<AgentFeedback>(`/reading/attempts/${attemptId}/feedback/`, {
      method: 'POST',
      body: '{}',
    }),
}
