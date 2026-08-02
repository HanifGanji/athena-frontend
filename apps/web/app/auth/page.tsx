import type { Metadata } from 'next'

import { AuthScreen, type AuthMode } from '@/app/auth/auth-screen'
import { safeNextPath } from '@/lib/safe-next'

export const metadata: Metadata = {
  title: 'ورود و ثبت‌نام | آتنا',
  description: 'ورود یا ساخت حساب آتنا با شمارهٔ موبایل',
}

type AuthPageProps = {
  searchParams: Promise<{
    mode?: string | string[]
    next?: string | string[]
  }>
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const query = await searchParams
  const modeValue = Array.isArray(query.mode) ? query.mode[0] : query.mode
  const nextValue = Array.isArray(query.next) ? query.next[0] : query.next
  const initialMode: AuthMode = modeValue === 'register' ? 'register' : 'login'

  return (
    <AuthScreen initialMode={initialMode} nextPath={safeNextPath(nextValue)} />
  )
}
