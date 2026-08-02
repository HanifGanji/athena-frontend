import type { Metadata } from 'next'

import { SpeakingWorkspace } from '@/app/speaking-workspace'

export const metadata: Metadata = {
  title: 'تمرین Speaking | آتنا',
  description:
    'تمرین ضبط پاسخ انگلیسی و دریافت پاسخ صوتی ممتحن، بدون نمایش متن یا ذخیره‌سازی',
}

export default function SpeakingPage() {
  return <SpeakingWorkspace />
}
