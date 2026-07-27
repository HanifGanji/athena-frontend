import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

export const metadata: Metadata = {
  title: 'آتنا',
  description: 'رابط وب آتنا',
}

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  )
}
