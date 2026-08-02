import { apiRequest } from '@/lib/api-client'

export type SpeakingExamType = 'ielts' | 'toefl'

export const speakingApi = {
  respond: (examType: SpeakingExamType, audio: Blob, filename: string) => {
    const formData = new FormData()
    formData.append('exam_type', examType)
    formData.append('audio', audio, filename)
    return apiRequest<Blob>('/speaking/respond/', {
      method: 'POST',
      body: formData,
      responseType: 'blob',
    })
  },
}
