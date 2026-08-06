import type { Metadata } from 'next'

import { WritingWorkspace } from '@/app/writing-workspace'

export const metadata: Metadata = {
  title: 'تمرین Writing | آتنا',
  description: 'تمرین IELTS Writing با ذخیرهٔ امن و بازخورد معیاربه‌معیار',
}

export default function WritingPage() {
  return <WritingWorkspace />
}
