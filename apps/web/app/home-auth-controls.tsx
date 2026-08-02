'use client'

import Link from 'next/link'
import { useState } from 'react'

import { useOptionalAuth } from '@/app/auth-provider'

export function HomeAuthControls() {
  const auth = useOptionalAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth?.status === 'authenticated' && auth.user) {
    const displayName =
      `${auth.user.first_name} ${auth.user.last_name}`.trim() ||
      auth.user.phone_number

    return (
      <div className="flex items-center gap-2">
        <span className="max-w-24 truncate text-xs font-black text-[#155e57] sm:max-w-40">
          {displayName}
        </span>
        <button
          type="button"
          disabled={loggingOut}
          title={error ?? undefined}
          onClick={async () => {
            setLoggingOut(true)
            setError(null)
            try {
              await auth.logout()
            } catch (reason) {
              setError(
                reason instanceof Error ? reason.message : 'خروج ناموفق بود.',
              )
            } finally {
              setLoggingOut(false)
            }
          }}
          className="rounded-full border border-[#155e57]/25 bg-white/60 px-4 py-2 text-xs font-black text-[#155e57] disabled:cursor-wait disabled:opacity-60"
        >
          {loggingOut ? 'در حال خروج…' : 'خروج'}
        </button>
      </div>
    )
  }

  if (auth?.status === 'loading') {
    return (
      <span className="rounded-full border border-[#155e57]/20 bg-white/50 px-4 py-2 text-xs font-bold text-[#65716e]">
        بررسی ورود…
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs font-black">
      <Link
        href="/auth?mode=login"
        className="rounded-full border border-[#155e57]/25 bg-white/60 px-4 py-2 text-[#155e57]"
      >
        ورود
      </Link>
      <Link
        href="/auth?mode=register"
        className="rounded-full bg-[#155e57] px-4 py-2 text-white"
      >
        ثبت‌نام
      </Link>
    </div>
  )
}
