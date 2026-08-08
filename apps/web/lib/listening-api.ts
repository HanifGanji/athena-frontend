import { apiRequest, jsonBody } from '@/lib/api-client'

export type ListeningSeriesSummary = {
  id: string
  slug: string
  title: string
  publisher: string
  volume_number: number | null
  release_year: number | null
  sequence: number
}

export type ListeningTestSummary = {
  id: string
  slug: string
  module: 'academic' | 'general_training' | 'both'
  series: ListeningSeriesSummary | null
  series_test_number: number | null
  version_number: number
  title: string
  description: string
  time_limit_seconds: number
  question_count: number
  part_count: number
  content_origin: 'athena_original' | 'publisher_source'
  rights_status: 'owned' | 'licensed' | 'internal_only' | 'review_required'
}

export type ListeningMediaAsset = {
  id: string
  title: string
  mime_type: string
  duration_ms: number
  url: string
}

export type ListeningVisualAsset = {
  id: string
  title: string
  alt_text: string
  mime_type: string
  width?: number | null
  height?: number | null
  url: string
}

export type ListeningResponseSlot = {
  id: string
  display_number: number
  prompt: string
  sequence: number
  score_weight: number
  placeholder: string
}

export type ListeningQuestionOption = {
  id: string
  response_slot_id: string | null
  value: string
  label: string
  sequence: number
}

export type ListeningContentBlock = {
  id: string
  parent_id: string | null
  response_slot_id: string | null
  kind:
    | 'panel'
    | 'section'
    | 'heading'
    | 'paragraph'
    | 'list_item'
    | 'field'
    | 'table'
    | 'table_row'
    | 'table_cell'
    | 'note'
    | 'flow_step'
    | 'option_bank'
    | 'caption'
    | 'divider'
  sequence: number
  text_content: string
  metadata: Record<string, unknown>
  segments: ListeningContentSegment[]
}

export type ListeningContentSegment = {
  id: string
  response_slot_id: string | null
  kind: 'text' | 'response'
  sequence: number
  text_content: string
  emphasis: 'normal' | 'strong' | 'emphasis'
}

export type ListeningQuestionGroup = {
  id: string
  interaction_type:
    | 'completion'
    | 'single_choice'
    | 'multi_select'
    | 'matching'
    | 'spatial_labeling'
  presentation:
    | 'plain'
    | 'form'
    | 'table'
    | 'notes'
    | 'flowchart'
    | 'map'
    | 'plan'
    | 'diagram'
  title: string
  instructions: string
  sequence: number
  response_rules: Record<string, unknown>
  visual_asset: ListeningVisualAsset | null
  visual_assets?: ListeningVisualAsset[]
  options: ListeningQuestionOption[]
  response_slots: ListeningResponseSlot[]
  content_blocks: ListeningContentBlock[]
}

export type ListeningPart = {
  id: string
  number: number
  sequence: number
  title: string
  context: string
  instructions: string
  media: {
    role: 'primary' | 'supplementary'
    sequence: number
    start_offset_ms: number
    end_offset_ms: number | null
    asset: ListeningMediaAsset
  }[]
  question_groups: ListeningQuestionGroup[]
}

export type ListeningTest = Omit<
  ListeningTestSummary,
  'question_count' | 'part_count'
> & {
  parts: ListeningPart[]
}

export type ListeningAnswerPayload =
  { answers: Record<string, string> } | { selected_options: string[] }

export type ListeningAttempt = {
  id: string
  test_version_id: string
  mode: 'practice' | 'timed_mock'
  status: 'in_progress' | 'submitted' | 'abandoned'
  manifest: Record<string, unknown>
  started_at: string
  submitted_at: string | null
  active_duration_seconds: number
  raw_score: number | null
  maximum_score: number | null
  responses: {
    group_id: string
    answer_payload: ListeningAnswerPayload
    updated_at: string
  }[]
}

export type ListeningEvaluationResult = {
  question_id: string
  question_number: number
  submitted_value: unknown
  normalized_value: unknown
  correct_value: unknown
  awarded_score: number
  result_code: 'correct' | 'incorrect' | 'unanswered'
}

export type ListeningEvaluation = {
  evaluator_version: string
  raw_score: number
  maximum_score: number
  created_at: string
  results: ListeningEvaluationResult[]
}

export type ListeningStaffPreview = {
  test_slug: string
  attempt: ListeningAttempt
  evaluation: ListeningEvaluation
}

export const listeningApi = {
  listTests: (signal?: AbortSignal) =>
    apiRequest<ListeningTestSummary[]>('/listening/tests/', { signal }),
  getTest: (slug: string) =>
    apiRequest<ListeningTest>(`/listening/tests/${slug}/`),
  startAttempt: (slug: string, mode: ListeningAttempt['mode']) =>
    apiRequest<ListeningAttempt>(`/listening/tests/${slug}/attempts/`, {
      method: 'POST',
      body: jsonBody({ mode }),
    }),
  saveResponse: (
    attemptId: string,
    groupId: string,
    answerPayload: ListeningAnswerPayload,
    clientEventId = crypto.randomUUID(),
  ) =>
    apiRequest(`/listening/attempts/${attemptId}/responses/${groupId}/`, {
      method: 'PUT',
      body: jsonBody({
        client_event_id: clientEventId,
        answer_payload: answerPayload,
      }),
    }),
  submitAttempt: (attemptId: string) =>
    apiRequest<ListeningEvaluation>(
      `/listening/attempts/${attemptId}/submit/`,
      { method: 'POST', body: jsonBody({}) },
    ),
  getAsset: (url: string, signal?: AbortSignal) =>
    apiRequest<Blob>(url, { responseType: 'blob', signal }),
  getStaffPreview: () =>
    apiRequest<ListeningStaffPreview>('/staff/test-previews/listening/', {
      method: 'POST',
      body: jsonBody({}),
    }),
}
