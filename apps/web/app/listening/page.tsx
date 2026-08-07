import type { Metadata } from 'next'

import { ListeningWorkspace } from '@/app/listening-workspace'

export const metadata: Metadata = {
  title: 'تمرین Listening | آتنا',
  description: 'تمرین IELTS Listening با فایل صوتی، ذخیرهٔ امن و تصحیح فوری',
}

export default function ListeningPage() {
  return <ListeningWorkspace />
}
