import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock('@/app/auth-provider', () => ({
  useAuth: () => ({ refresh: mocks.refresh }),
}))

import { AuthScreen } from '@/app/auth/auth-screen'

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

function requestUrl(input: RequestInfo | URL) {
  return String(input)
}

describe('AuthScreen', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=auth-test-token; path=/'
    mocks.refresh.mockReset().mockResolvedValue(user)
    mocks.replace.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers in two steps, explains the development OTP, restores the session, and follows next', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url = requestUrl(input)
        if (url.endsWith('/auth/register/request-code/')) {
          return json({
            detail:
              'Development mode: no SMS was sent. Enter any six-digit code.',
          })
        }
        if (url.endsWith('/auth/register/verify/')) {
          return json({ user }, 201)
        }
        return json({ detail: `Unexpected request: ${url}` }, 500)
      })

    render(<AuthScreen initialMode="register" nextPath="/reading" />)

    expect(
      screen.getByText('پیامکی ارسال نمی‌شود؛ هر کد شش‌رقمی پذیرفته می‌شود.'),
    ).toBeVisible()
    expect(screen.getByRole('tab', { name: 'ثبت‌نام' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    fireEvent.change(screen.getByLabelText('شمارهٔ موبایل'), {
      target: { value: '۰۹۱۲ ۱۲۳ ۴۵۶۷' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^نام$/ }), {
      target: { value: ' آتنا ' },
    })
    fireEvent.change(screen.getByLabelText('نام خانوادگی'), {
      target: { value: ' آموز ' },
    })
    fireEvent.change(screen.getByLabelText('ایمیل'), {
      target: { value: ' ATHENA@EXAMPLE.COM ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }))

    const codeInput = await screen.findByLabelText('کد ورود')
    const requestCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input).endsWith('/auth/register/request-code/'),
    )
    expect(JSON.parse(String(requestCall?.[1]?.body))).toEqual({
      phone_number: '۰۹۱۲ ۱۲۳ ۴۵۶۷',
      first_name: 'آتنا',
      last_name: 'آموز',
      email: 'athena@example.com',
    })

    fireEvent.change(codeInput, { target: { value: '۱۲۳۴۵۶' } })
    fireEvent.click(screen.getByRole('button', { name: 'ساخت حساب و ورود' }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    expect(mocks.replace).toHaveBeenCalledWith('/reading')
    const verifyCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input).endsWith('/auth/register/verify/'),
    )
    expect(JSON.parse(String(verifyCall?.[1]?.body))).toEqual({
      code: '123456',
    })
  })

  it('keeps field errors, handles an expired challenge, and supports resend and editing', async () => {
    let requestCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.endsWith('/auth/login/request-code/')) {
        requestCount += 1
        if (requestCount === 1) {
          return json({ phone_number: ['کاربری با این شماره پیدا نشد.'] }, 400)
        }
        return json({ detail: 'Development mode.' })
      }
      if (url.endsWith('/auth/login/verify/')) {
        return json(
          {
            detail: 'درخواست کد منقضی شده است؛ کد تازه بگیرید.',
            code: 'challenge_expired',
          },
          400,
        )
      }
      return json({ detail: `Unexpected request: ${url}` }, 500)
    })

    render(<AuthScreen />)
    const phone = screen.getByLabelText('شمارهٔ موبایل')
    fireEvent.change(phone, { target: { value: '09121234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }))
    expect(
      await screen.findByText('کاربری با این شماره پیدا نشد.'),
    ).toBeVisible()
    expect(phone).toHaveAttribute('aria-invalid', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }))
    const codeInput = await screen.findByLabelText('کد ورود')
    fireEvent.change(codeInput, { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'ورود به آتنا' }))
    expect(await screen.findByText('کد باید دقیقاً شش رقم باشد.')).toBeVisible()

    fireEvent.change(codeInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'ورود به آتنا' }))
    expect(
      await screen.findByText('درخواست کد منقضی شده است؛ کد تازه بگیرید.'),
    ).toBeVisible()
    expect(screen.queryByText('challenge_expired')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'درخواست دوبارهٔ کد' }))
    expect(
      await screen.findByText(
        'درخواست تازه ثبت شد؛ هر کد شش‌رقمی را وارد کنید.',
      ),
    ).toBeVisible()
    expect(screen.getByLabelText('کد ورود')).toHaveValue('')

    fireEvent.click(
      screen.getByRole('button', { name: 'ویرایش شماره و مشخصات' }),
    )
    expect(screen.getByLabelText('شمارهٔ موبایل')).toHaveValue('09121234567')
  })

  it('logs in an existing user, refreshes the session, and returns to the protected route', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url = requestUrl(input)
        if (url.endsWith('/auth/login/request-code/')) {
          return json({ detail: 'Development mode.' })
        }
        if (url.endsWith('/auth/login/verify/')) return json({ user })
        return json({ detail: `Unexpected request: ${url}` }, 500)
      })

    render(<AuthScreen nextPath="/speaking?exam=ielts" />)
    fireEvent.change(screen.getByLabelText('شمارهٔ موبایل'), {
      target: { value: '+989121234567' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }))
    fireEvent.change(await screen.findByLabelText('کد ورود'), {
      target: { value: '654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ورود به آتنا' }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    expect(mocks.replace).toHaveBeenCalledWith('/speaking?exam=ielts')
    const verifyCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input).endsWith('/auth/login/verify/'),
    )
    expect(JSON.parse(String(verifyCall?.[1]?.body))).toEqual({
      code: '654321',
    })
  })

  it('exposes a loading state while requesting a code', async () => {
    let resolveRequest!: (response: Response) => void
    const pendingRequest = new Promise<Response>((resolve) => {
      resolveRequest = resolve
    })
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingRequest)

    render(<AuthScreen />)
    fireEvent.change(screen.getByLabelText('شمارهٔ موبایل'), {
      target: { value: '09121234567' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }))

    expect(
      screen.getByRole('button', { name: 'در حال ثبت درخواست…' }),
    ).toBeDisabled()
    resolveRequest(
      new Response(JSON.stringify({ detail: 'Development mode.' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(await screen.findByLabelText('کد ورود')).toBeVisible()
  })
})
