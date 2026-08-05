import type { Metadata } from 'next'

import { SpeakingWorkspace } from '@/app/speaking-workspace'

export const metadata: Metadata = {
  title: 'تمرین Speaking | آتنا',
  description:
    'تمرین مرحله‌به‌مرحلهٔ Speaking آیلتس و تافل با ممتحن صوتی، بازبینی ضبط و تاریخچهٔ متنی',
}

export default function SpeakingPage() {
  return <SpeakingWorkspace />
}
