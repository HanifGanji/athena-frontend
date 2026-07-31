import type { Metadata } from 'next'

import { ReadingWorkspace } from '@/app/reading-workspace'

export const metadata: Metadata = {
  title: 'تمرین Reading | آتنا',
  description: 'تمرین هوشمند IELTS Reading برای فارسی‌زبانان',
}

export default function ReadingPage() {
  return <ReadingWorkspace />
}
