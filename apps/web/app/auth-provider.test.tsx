import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  pathname: '/',
  router: { replace: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation.router,
}))

import { AuthProvider } from '@/app/auth-provider'
import { HomeAuthControls } from '@/app/home-auth-controls'
import { Providers } from '@/app/providers'

const user = {
  id: 'user-1',
  phone_number: '+989121234567',
  first_name: 'آتنا',
  last_name: 'آموز',
  email: 'athena@example.com',
}

function json(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('AuthProvider and module route protection', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=provider-token; path=/'
    navigation.pathname = '/'
    navigation.router.replace.mockReset()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => vi.restoreAllMocks())

  it('restores the session, shows the user on home, and logs out', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url = String(input)
        if (url.endsWith('/auth/me/')) return json({ user })
        if (url.endsWith('/auth/logout/')) {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        return json({ detail: `Unexpected request: ${url}` }, 500)
      })

    render(
      <AuthProvider>
        <HomeAuthControls />
      </AuthProvider>,
    )

    expect(await screen.findByText('آتنا آموز')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'خروج' }))
    expect(await screen.findByRole('link', { name: 'ورود' })).toBeVisible()

    const meCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/auth/me/'),
    )
    const logoutCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/auth/logout/'),
    )
    expect(meCall?.[1]?.credentials).toBe('include')
    expect(logoutCall?.[1]?.credentials).toBe('include')
    expect(new Headers(logoutCall?.[1]?.headers).get('X-CSRFToken')).toBe(
      'provider-token',
    )
  })

  it('redirects an anonymous protected route while preserving query and hash', async () => {
    navigation.pathname = '/reading'
    window.history.replaceState({}, '', '/reading?section=2#question-4')
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      json({ detail: 'Authentication credentials were not provided.' }, 401),
    )

    render(
      <Providers>
        <p>Reading workspace</p>
      </Providers>,
    )

    expect(screen.queryByText('Reading workspace')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(navigation.router.replace).toHaveBeenCalledWith(
        '/auth?next=%2Freading%3Fsection%3D2%23question-4',
      ),
    )
  })

  it('keeps the public home route available to anonymous visitors', async () => {
    navigation.pathname = '/'
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      json({ detail: 'Authentication credentials were not provided.' }, 401),
    )

    render(
      <Providers>
        <p>Public home</p>
      </Providers>,
    )

    expect(screen.getByText('Public home')).toBeVisible()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(navigation.router.replace).not.toHaveBeenCalled()
  })
})
