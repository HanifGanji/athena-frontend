'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { authApi, type AuthUser } from '@/lib/auth-api'
import { ApiError, AUTH_REQUIRED_EVENT } from '@/lib/api-client'
import { authPathFor, safeNextPath } from '@/lib/safe-next'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  restoreError: string | null
  refresh: () => Promise<AuthUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await authApi.getMe()
      setUser(response.user)
      setStatus('authenticated')
      setRestoreError(null)
      return response.user
    } catch (reason) {
      setUser(null)
      setStatus('anonymous')
      if (reason instanceof ApiError && reason.status === 401) {
        setRestoreError(null)
      } else {
        setRestoreError(
          reason instanceof Error
            ? reason.message
            : 'بازیابی نشست کاربری ناموفق بود.',
        )
      }
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    void authApi
      .getMe()
      .then((response) => {
        if (!active) return
        setUser(response.user)
        setStatus('authenticated')
        setRestoreError(null)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setUser(null)
        setStatus('anonymous')
        if (reason instanceof ApiError && reason.status === 401) {
          setRestoreError(null)
        } else {
          setRestoreError(
            reason instanceof Error
              ? reason.message
              : 'بازیابی نشست کاربری ناموفق بود.',
          )
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function requireAuthentication(event: Event) {
      const detail = (event as CustomEvent<{ next?: string }>).detail
      setUser(null)
      setStatus('anonymous')
      router.replace(authPathFor(safeNextPath(detail?.next)))
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, requireAuthentication)
    return () =>
      window.removeEventListener(AUTH_REQUIRED_EVENT, requireAuthentication)
  }, [router])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.status === 401)) throw reason
    }
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({ user, status, restoreError, refresh, logout }),
    [logout, refresh, restoreError, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function useOptionalAuth() {
  return useContext(AuthContext)
}
