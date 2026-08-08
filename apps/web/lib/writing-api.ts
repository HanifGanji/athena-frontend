import { apiRequest, jsonBody } from '@/lib/api-client'

export type WritingModule = 'academic' | 'general_training'
export type WritingTaskType = 'academic_task_1' | 'general_task_1' | 'task_2'
export type WritingExperienceMode = 'exam' | 'guided'

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

export type WritingPlanningQuestion = {
  id: string
  kind:
    | 'position'
    | 'overview'
    | 'main_idea'
    | 'evidence'
    | 'counterpoint'
    | 'key_feature'
    | 'checklist'
  title_fa: string
  hint_fa: string
  sequence: number
  required: boolean
}

export type WritingPrompt = WritingPromptSummary & {
  prompt_text: string
  instructions: string
  requirements: WritingPromptRequirement[]
  assets: WritingPromptAsset[]
  criteria: WritingCriterion[]
  planning_questions: WritingPlanningQuestion[]
  response_shape: string | null
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
  plan: WritingPlan | null
}

export type WritingPlan = {
  status: 'draft' | 'complete'
  revision_number: number
  entries: Array<{
    question_id: string
    text_content: string
    updated_at: string
  }>
  updated_at: string
  completed_at: string | null
}

export type WritingExperience = {
  title: string
  timer_enabled: boolean
  planning_enabled: boolean
  post_submission_feedback_enabled: boolean
  rewrite_enabled: boolean
  version_number: number
}

export type WritingAttemptResult = {
  estimated_band_score: string
  calculation_version: string
  created_at: string
}

export type WritingAttempt = {
  id: string
  mode: 'single_task' | 'full_mock'
  experience_mode: WritingExperienceMode
  experience: WritingExperience | null
  status: 'in_progress' | 'submitted' | 'evaluating' | 'evaluated' | 'abandoned'
  started_at: string
  last_activity_at: string
  submitted_at: string | null
  completed_at: string | null
  active_duration_seconds: number
  tasks: WritingAttemptTask[]
  result?: WritingAttemptResult
  parent_submission_id: string | null
}

export type WritingAttemptSummary = {
  id: string
  mode: 'single_task' | 'full_mock'
  experience_mode: WritingExperienceMode
  status: WritingAttempt['status']
  title: string
  task_type: WritingTaskType | null
  word_count: number
  estimated_band_score: string | null
  started_at: string
  last_activity_at: string
  submitted_at: string | null
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
  id: string
  kind: 'strength' | 'improvement' | 'language_issue'
  criterion_code: string | null
  skill_code: string | null
  skill_name_fa: string | null
  title_fa: string
  explanation_fa: string
  original_excerpt: string
  suggested_revision: string
  start_offset: number | null
  end_offset: number | null
  sequence: number
  learner_decision: {
    decision: 'accepted' | 'fixed' | 'dismissed' | 'not_useful'
    note: string
  } | null
}

export type WritingRecommendation = {
  criterion_code: string | null
  skill_code: string | null
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

export type WritingProgressSkill = {
  code: string
  parent_code: string | null
  criterion_code: string
  name_en: string
  name_fa: string
  strength_count: number
  growth_count: number
  fixed_count: number
}

export const writingApi = {
  listPrompts: (signal?: AbortSignal) =>
    apiRequest<WritingPromptSummary[]>('/writing/prompts/', { signal }),
  listTests: (signal?: AbortSignal) =>
    apiRequest<WritingTestSummary[]>('/writing/tests/', { signal }),
  listAttempts: (signal?: AbortSignal) =>
    apiRequest<WritingAttemptSummary[]>('/writing/attempts/', { signal }),
  getProgress: (signal?: AbortSignal) =>
    apiRequest<{ skills: WritingProgressSkill[] }>('/writing/progress/', {
      signal,
    }),
  startPrompt: (slug: string, experienceMode: WritingExperienceMode = 'exam') =>
    apiRequest<WritingAttempt>(`/writing/prompts/${slug}/attempts/`, {
      method: 'POST',
      body: jsonBody({ experience_mode: experienceMode }),
    }),
  startTest: (slug: string, experienceMode: WritingExperienceMode = 'exam') =>
    apiRequest<WritingAttempt>(`/writing/tests/${slug}/attempts/`, {
      method: 'POST',
      body: jsonBody({ experience_mode: experienceMode }),
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
  savePlan: (
    attemptId: string,
    taskId: string,
    input: {
      expected_revision_number: number
      entries: Array<{ question_id: string; text: string }>
      mark_complete: boolean
    },
  ) =>
    apiRequest<{ plan: WritingPlan; cached: boolean }>(
      `/writing/attempts/${attemptId}/tasks/${taskId}/plan/`,
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
  startRewrite: (submissionId: string, feedbackItemId?: string) =>
    apiRequest<WritingAttempt>(
      `/writing/submissions/${submissionId}/rewrite/`,
      {
        method: 'POST',
        body: jsonBody({ feedback_item_id: feedbackItemId ?? null }),
      },
    ),
  setFeedbackDecision: (
    feedbackItemId: string,
    decision: 'accepted' | 'fixed' | 'dismissed' | 'not_useful',
  ) =>
    apiRequest<{
      feedback_item_id: string
      decision: string
      note: string
      updated_at: string
    }>(`/writing/feedback-items/${feedbackItemId}/decision/`, {
      method: 'PUT',
      body: jsonBody({ decision }),
    }),
  getStaffPreview: () =>
    apiRequest<{ attempt: WritingAttempt }>('/staff/test-previews/writing/', {
      method: 'POST',
      body: jsonBody({}),
    }),
}
