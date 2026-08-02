import { apiRequest, jsonBody } from '@/lib/api-client'

export type SpeakingExamType = 'ielts' | 'toefl'
export type SpeakingSessionStatus = 'in_progress' | 'completed'
export type SpeakingTurnRole = 'learner' | 'examiner'

export type SpeakingTurn = {
  id: string
  role: SpeakingTurnRole
  sequence: number
  text: string
  created_at: string
}

export type SpeakingSession = {
  id: string
  exam_type: SpeakingExamType
  status: SpeakingSessionStatus
  created_at: string
  updated_at: string
  turns: SpeakingTurn[]
}

export type SpeakingTurnResult = {
  turns: SpeakingTurn[]
}

export const speakingApi = {
  startSession: (examType: SpeakingExamType) =>
    apiRequest<SpeakingSession>('/speaking/sessions/', {
      method: 'POST',
      body: jsonBody({ exam_type: examType }),
    }),
  getSession: (sessionId: string) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/`),
  submitAudio: async (sessionId: string, audio: Blob, filename: string) => {
    const formData = new FormData()
    formData.append('audio', audio, filename)
    return apiRequest<SpeakingTurnResult>(
      `/speaking/sessions/${sessionId}/turns/`,
      { method: 'POST', body: formData },
    )
  },
  synthesizeTurn: (sessionId: string, turnId: string) =>
    apiRequest<Blob>(
      `/speaking/sessions/${sessionId}/turns/${turnId}/speech/`,
      { method: 'POST', responseType: 'blob' },
    ),
  completeSession: (sessionId: string) =>
    apiRequest<SpeakingSession>(`/speaking/sessions/${sessionId}/complete/`, {
      method: 'POST',
      body: jsonBody({}),
    }),
}
