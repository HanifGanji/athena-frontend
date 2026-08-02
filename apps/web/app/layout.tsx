import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '@/app/providers'

import './globals.css'

export const metadata: Metadata = {
  title: 'آتنا | یادگیری IELTS برای فارسی‌زبانان',
  description: 'تمرین هوشمند مهارت‌های IELTS برای فارسی‌زبانان',
}

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
