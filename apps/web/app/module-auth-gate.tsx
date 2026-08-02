'use client'

import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect } from 'react'

import { useAuth } from '@/app/auth-provider'
import { authPathFor } from '@/lib/safe-next'

const protectedRoots = ['/reading', '/speaking', '/writing', '/listening']

function isProtectedPath(pathname: string) {
  return protectedRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  )
}

export function ModuleAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { status, restoreError } = useAuth()
  const protectedPath = isProtectedPath(pathname)

  useEffect(() => {
    if (protectedPath && status === 'anonymous') {
      const nextPath = `${pathname}${window.location.search}${window.location.hash}`
      router.replace(authPathFor(nextPath))
    }
  }, [pathname, protectedPath, router, status])

  if (!protectedPath) return children

  if (status === 'authenticated') return children

  return (
    <main className="grid min-h-svh place-items-center bg-[#f4f1e8] p-6 text-[#18302d]">
      <div className="max-w-sm text-center">
        <span className="mx-auto block size-3 animate-pulse rounded-full bg-[#e57d55]" />
        <p className="mt-4 text-sm font-black">
          {status === 'loading'
            ? 'در حال بررسی ورود شما…'
            : 'در حال انتقال به صفحهٔ ورود…'}
        </p>
        {restoreError && (
          <p role="alert" className="mt-3 text-xs leading-6 text-[#a14e32]">
            {restoreError}
          </p>
        )}
      </div>
    </main>
  )
}
