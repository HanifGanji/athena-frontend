import { apiRequest, jsonBody } from '@/lib/api-client'

export type WritingModule = 'academic' | 'general_training'
export type WritingTaskType = 'academic_task_1' | 'general_task_1' | 'task_2'

export type WritingPromptSummary = {
  id: string
  slug: string
  module: WritingModule
  task_type: WritingTaskType
  version_number: number
  title: string
  minimum_word_count: number
  recommended_time_seconds: number
}

export type WritingPromptRequirement = {
  kind: 'instruction' | 'question' | 'bullet_point'
  text: string
  sequence: number
}

export type WritingPromptAsset = {
  id: string
  kind: 'chart' | 'table' | 'graph' | 'map' | 'process' | 'diagram' | 'image'
  url: string
  alt_text: string
  width_pixels: number | null
  height_pixels: number | null
  sequence: number
}

export type WritingCriterion = {
  code: string
  name_en: string
  name_fa: string
  sequence: number
  weight: string
}

export type WritingPrompt = WritingPromptSummary & {
  prompt_text: string
  instructions: string
  requirements: WritingPromptRequirement[]
  assets: WritingPromptAsset[]
  criteria: WritingCriterion[]
}

export type WritingTestSummary = {
  id: string
  slug: string
  module: WritingModule
  version_number: number
  title: string
  description: string
  time_limit_seconds: number
  task_count: number
}

export type WritingResponse = {
  id: string
  draft_text: string
  draft_revision_number: number
  draft_word_count: number
  updated_at: string
}

export type WritingSubmission = {
  id: string
  text_content: string
  word_count: number
  submitted_at: string
}

export type WritingAttemptTask = {
  id: string
  task_number: 1 | 2
  sequence: number
  score_weight: number
  recommended_time_seconds: number
  prompt: WritingPrompt
  response: WritingResponse
  submission?: WritingSubmission
}

export type WritingAttemptResult = {
  estimated_band_score: string
  calculation_version: string
  created_at: string
}

export type WritingAttempt = {
  id: string
  mode: 'single_task' | 'full_mock'
  status: 'in_progress' | 'submitted' | 'evaluating' | 'evaluated' | 'abandoned'
  started_at: string
  last_activity_at: string
  submitted_at: string | null
  completed_at: string | null
  active_duration_seconds: number
  tasks: WritingAttemptTask[]
  result?: WritingAttemptResult
}

export type DraftSaveResult = {
  response: WritingResponse
  cached: boolean
  changed: boolean
}

export type WritingCriterionResult = {
  code: string
  name_en: string
  name_fa: string
  band_score: string
  rationale_fa: string
}

export type WritingFeedbackItem = {
  kind: 'strength' | 'improvement' | 'language_issue'
  criterion_code: string | null
  title_fa: string
  explanation_fa: string
  original_excerpt: string
  suggested_revision: string
  start_offset: number | null
  end_offset: number | null
  sequence: number
}

export type WritingRecommendation = {
  criterion_code: string | null
  title_fa: string
  action_fa: string
  reason_fa: string
  priority: 1 | 2 | 3
  sequence: number
}

export type WritingEvaluation = {
  submission_id: string
  model_id: string
  estimated_band_score: string
  summary_fa: string
  examiner_comment_en: string
  criterion_results: WritingCriterionResult[]
  feedback_items: WritingFeedbackItem[]
  recommendations: WritingRecommendation[]
  created_at: string
}

export type WritingFeedback = {
  evaluations: WritingEvaluation[]
  result: WritingAttemptResult | null
}

export const writingApi = {
  listPrompts: (signal?: AbortSignal) =>
    apiRequest<WritingPromptSummary[]>('/writing/prompts/', { signal }),
  listTests: (signal?: AbortSignal) =>
    apiRequest<WritingTestSummary[]>('/writing/tests/', { signal }),
  startPrompt: (slug: string) =>
    apiRequest<WritingAttempt>(`/writing/prompts/${slug}/attempts/`, {
      method: 'POST',
      body: jsonBody({}),
    }),
  startTest: (slug: string) =>
    apiRequest<WritingAttempt>(`/writing/tests/${slug}/attempts/`, {
      method: 'POST',
      body: jsonBody({}),
    }),
  getAttempt: (attemptId: string) =>
    apiRequest<WritingAttempt>(`/writing/attempts/${attemptId}/`),
  saveDraft: (
    attemptId: string,
    taskId: string,
    input: {
      client_event_id: string
      expected_revision_number: number
      text: string
      save_kind: 'autosave' | 'manual'
    },
  ) =>
    apiRequest<DraftSaveResult>(
      `/writing/attempts/${attemptId}/tasks/${taskId}/draft/`,
      {
        method: 'PUT',
        body: jsonBody(input),
      },
    ),
  submitAttempt: (attemptId: string, activeDurationSeconds: number) =>
    apiRequest<WritingAttempt>(`/writing/attempts/${attemptId}/submit/`, {
      method: 'POST',
      body: jsonBody({ active_duration_seconds: activeDurationSeconds }),
    }),
  requestFeedback: (attemptId: string) =>
    apiRequest<WritingFeedback>(`/writing/attempts/${attemptId}/feedback/`, {
      method: 'POST',
      body: jsonBody({}),
    }),
}
