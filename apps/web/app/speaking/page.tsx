import type { Metadata } from 'next'

import { SpeakingWorkspace } from '@/app/speaking-workspace'

export const metadata: Metadata = {
  title: 'تمرین Speaking | آتنا',
  description: 'ضبط و تبدیل پاسخ انگلیسی به متن در آزمایشگاه Speaking آتنا',
}

export default function SpeakingPage() {
  return <SpeakingWorkspace />
}
