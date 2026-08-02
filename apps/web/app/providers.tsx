'use client'

import type { ReactNode } from 'react'

import { AuthProvider } from '@/app/auth-provider'
import { ModuleAuthGate } from '@/app/module-auth-gate'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ModuleAuthGate>{children}</ModuleAuthGate>
    </AuthProvider>
  )
}
