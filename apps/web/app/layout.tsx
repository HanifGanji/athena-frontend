import type { Metadata } from 'next'
import { Vazirmatn } from 'next/font/google'
import type { ReactNode } from 'react'

import { Providers } from '@/app/providers'

import './globals.css'

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-vazirmatn',
})

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
      <body
        className={`${vazirmatn.variable} ${vazirmatn.className} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
