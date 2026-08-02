const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'

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

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function firstErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string') return payload
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
    return null
  }
  if (payload && typeof payload === 'object') {
    const values = Object.values(payload)
    for (const value of values) {
      const message = firstErrorMessage(value)
      if (message) return message
    }
  }
  return null
}

async function errorFrom(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown
  return new ApiError(
    firstErrorMessage(payload) ?? 'ارتباط با سرور ناموفق بود.',
    response.status,
  )
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) throw await errorFrom(response)
  return (await response.json()) as T
}

export const speakingApi = {
  startSession: (examType: SpeakingExamType) =>
    requestJson<SpeakingSession>('/speaking/sessions/', {
      method: 'POST',
      body: JSON.stringify({ exam_type: examType }),
    }),
  getSession: (sessionId: string) =>
    requestJson<SpeakingSession>(`/speaking/sessions/${sessionId}/`),
  submitAudio: async (sessionId: string, audio: Blob, filename: string) => {
    const formData = new FormData()
    formData.append('audio', audio, filename)
    const response = await fetch(
      `${API_BASE_URL}/speaking/sessions/${sessionId}/turns/`,
      { method: 'POST', body: formData },
    )
    if (!response.ok) throw await errorFrom(response)
    return (await response.json()) as SpeakingTurnResult
  },
  synthesizeTurn: async (sessionId: string, turnId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/speaking/sessions/${sessionId}/turns/${turnId}/speech/`,
      { method: 'POST' },
    )
    if (!response.ok) throw await errorFrom(response)
    return response.blob()
  },
  completeSession: (sessionId: string) =>
    requestJson<SpeakingSession>(`/speaking/sessions/${sessionId}/complete/`, {
      method: 'POST',
      body: '{}',
    }),
}
