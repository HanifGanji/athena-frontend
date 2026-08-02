const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'

const CSRF_COOKIE_NAME = 'csrftoken'
const CSRF_HEADER_NAME = 'X-CSRFToken'

export const AUTH_REQUIRED_EVENT = 'athena:auth-required'

type ApiRequestOptions = RequestInit & {
  responseType?: 'json' | 'blob'
  redirectOnUnauthorized?: boolean
}

type ErrorPayload = Record<string, unknown> | unknown[] | string | null

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
    readonly payload: ErrorPayload = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item)
      if (message) return message
    }
    return null
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = firstMessage(item)
      if (message) return message
    }
  }

  return null
}

function fieldErrorsFrom(payload: ErrorPayload) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return {}
  }

  const fieldErrors: Record<string, string> = {}
  for (const [field, value] of Object.entries(payload)) {
    if (field === 'detail' || field === 'non_field_errors') continue
    if (field === 'code' && typeof payload.detail === 'string') continue
    const message = firstMessage(value)
    if (message) fieldErrors[field] = message
  }
  return fieldErrors
}

function cookieValue(name: string) {
  if (typeof document === 'undefined') return null

  const prefix = `${encodeURIComponent(name)}=`
  for (const part of document.cookie.split(';')) {
    const cookie = part.trim()
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length))
    }
  }
  return null
}

let csrfBootstrap: Promise<void> | null = null

async function ensureCsrfCookie() {
  if (cookieValue(CSRF_COOKIE_NAME)) return

  csrfBootstrap ??= fetch(`${API_BASE_URL}/auth/csrf/`, {
    credentials: 'include',
  })
    .then(async (response) => {
      if (response.ok) return
      const payload = (await response.json().catch(() => null)) as ErrorPayload
      throw new ApiError(
        firstMessage(payload) ?? 'دریافت توکن امنیتی ناموفق بود.',
        response.status,
        fieldErrorsFrom(payload),
        payload,
      )
    })
    .finally(() => {
      csrfBootstrap = null
    })

  await csrfBootstrap
}

function isUnsafe(method: string) {
  return !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase())
}

function currentNextPath() {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function announceExpiredSession() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(AUTH_REQUIRED_EVENT, {
      detail: { next: currentNextPath() },
    }),
  )
}

async function apiErrorFrom(response: Response) {
  const payload = (await response.json().catch(() => null)) as ErrorPayload
  return new ApiError(
    firstMessage(payload) ?? 'ارتباط با سرور ناموفق بود.',
    response.status,
    fieldErrorsFrom(payload),
    payload,
  )
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    responseType = 'json',
    redirectOnUnauthorized = true,
    ...init
  } = options
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)

  if (isUnsafe(method)) {
    await ensureCsrfCookie()
    // Django rotates this cookie after login, so it must be read for every
    // unsafe request rather than cached with the bootstrap response.
    const csrfToken = cookieValue(CSRF_COOKIE_NAME)
    if (!csrfToken) {
      throw new ApiError(
        'توکن امنیتی در دسترس نیست. آدرس فرانت‌اند و بک‌اند را با یک نام میزبان اجرا کنید.',
        0,
      )
    }
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 401 && redirectOnUnauthorized) {
      announceExpiredSession()
    }
    throw await apiErrorFrom(response)
  }

  if (responseType === 'blob') return (await response.blob()) as T
  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value)
}
