'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { useAuth } from '@/app/auth-provider'
import { authApi, type RegistrationDetails } from '@/lib/auth-api'
import { ApiError } from '@/lib/api-client'
import { safeNextPath } from '@/lib/safe-next'

export type AuthMode = 'login' | 'register'

type AuthScreenProps = {
  initialMode?: AuthMode
  nextPath?: string
}

type AuthField = keyof RegistrationDetails | 'code'

const emptyDetails: RegistrationDetails = {
  phone_number: '',
  first_name: '',
  last_name: '',
  email: '',
}

const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
const arabicDigits = '٠١٢٣٤٥٦٧٨٩'

function asciiDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
}

function errorDetail(error: ApiError) {
  const payload = error.payload
  if (
    payload &&
    !Array.isArray(payload) &&
    typeof payload === 'object' &&
    typeof payload.detail === 'string'
  ) {
    return payload.detail
  }
  return Object.keys(error.fieldErrors).length === 0 ? error.message : null
}

export function AuthScreen({
  initialMode = 'login',
  nextPath = '/',
}: AuthScreenProps) {
  const router = useRouter()
  const { refresh } = useAuth()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [details, setDetails] = useState<RegistrationDetails>(emptyDetails)
  const [submittedDetails, setSubmittedDetails] =
    useState<RegistrationDetails | null>(null)
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<AuthField, string>>
  >({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function resetMessages() {
    setFieldErrors({})
    setGeneralError(null)
    setNotice(null)
  }

  function changeMode(nextMode: AuthMode) {
    if (loading || nextMode === mode) return
    setMode(nextMode)
    setStep('details')
    setCode('')
    setSubmittedDetails(null)
    resetMessages()
  }

  function updateDetail(field: keyof RegistrationDetails, value: string) {
    setDetails((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function showRequestError(reason: unknown, fallback: string) {
    if (reason instanceof ApiError) {
      setFieldErrors(reason.fieldErrors)
      setGeneralError(errorDetail(reason))
      return
    }
    setGeneralError(reason instanceof Error ? reason.message : fallback)
  }

  async function requestCode(resend = false) {
    setLoading(true)
    resetMessages()

    const normalizedDetails: RegistrationDetails = {
      phone_number: details.phone_number.trim(),
      first_name: details.first_name.trim(),
      last_name: details.last_name.trim(),
      email: details.email.trim().toLowerCase(),
    }

    try {
      if (mode === 'login') {
        await authApi.requestLoginCode(normalizedDetails.phone_number)
      } else {
        await authApi.requestRegistrationCode(normalizedDetails)
      }
      setDetails(normalizedDetails)
      setSubmittedDetails(normalizedDetails)
      setCode('')
      setStep('code')
      if (resend) setNotice('درخواست تازه ثبت شد؛ هر کد شش‌رقمی را وارد کنید.')
    } catch (reason) {
      showRequestError(reason, 'درخواست کد ورود ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await requestCode()
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()

    const normalizedCode = asciiDigits(code).replace(/\D/g, '')
    if (!/^\d{6}$/.test(normalizedCode)) {
      setFieldErrors({ code: 'کد باید دقیقاً شش رقم باشد.' })
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') await authApi.verifyLogin(normalizedCode)
      else await authApi.verifyRegistration(normalizedCode)

      const restoredUser = await refresh()
      if (!restoredUser) {
        throw new Error(
          'ورود انجام شد، اما بازیابی نشست ناموفق بود؛ دوباره تلاش کنید.',
        )
      }
      router.replace(safeNextPath(nextPath))
    } catch (reason) {
      showRequestError(reason, 'تأیید کد ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }

  const phoneNumber = submittedDetails?.phone_number ?? details.phone_number

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#f4f1e8] px-5 py-10 text-[#18302d]">
      <div
        aria-hidden="true"
        className="absolute -top-28 -left-24 size-80 rounded-full bg-[#dcebe5] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-36 -bottom-32 size-96 rounded-full bg-[#f3dfd6] blur-3xl"
      />

      <div className="relative w-full max-w-lg">
        <Link
          href="/"
          aria-label="بازگشت به صفحهٔ اصلی آتنا"
          className="mb-6 inline-block"
        >
          <p className="font-mono text-[10px] tracking-[0.25em] text-[#a14e32]">
            ATHENA · MEMBER ACCESS
          </p>
          <p className="mt-1 text-2xl font-black">آتنا</p>
        </Link>

        <section className="rounded-[2.25rem] border border-[#18302d]/12 bg-[#fffdf8] p-6 shadow-[0_24px_80px_rgba(24,48,45,0.1)] sm:p-9">
          <p className="text-sm font-bold text-[#a14e32]">حساب کاربری آتنا</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            {step === 'details'
              ? 'با شمارهٔ موبایل ادامه بده'
              : 'کد شش‌رقمی را وارد کن'}
          </h1>

          <div
            role="tablist"
            aria-label="روش ورود"
            className="mt-7 grid grid-cols-2 rounded-2xl bg-[#ece8dc] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => changeMode('login')}
              disabled={loading}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                mode === 'login'
                  ? 'bg-white text-[#155e57] shadow-sm'
                  : 'text-[#65716e]'
              }`}
            >
              ورود
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => changeMode('register')}
              disabled={loading}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                mode === 'register'
                  ? 'bg-white text-[#155e57] shadow-sm'
                  : 'text-[#65716e]'
              }`}
            >
              ثبت‌نام
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-[#e57d55]/25 bg-[#f3dfd6]/55 p-4 text-xs leading-6 text-[#7d402d]">
            <strong className="block font-black">نسخهٔ توسعه</strong>
            پیامکی ارسال نمی‌شود؛ هر کد شش‌رقمی پذیرفته می‌شود.
          </div>

          {generalError && (
            <div
              role="alert"
              className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-800"
            >
              {generalError}
            </div>
          )}
          {notice && (
            <p
              role="status"
              className="mt-5 rounded-2xl bg-[#dcebe5] p-4 text-sm font-bold text-[#155e57]"
            >
              {notice}
            </p>
          )}

          {step === 'details' ? (
            <form
              onSubmit={submitDetails}
              className="mt-6 space-y-4"
              noValidate
            >
              <label className="grid gap-2 text-sm font-black">
                شمارهٔ موبایل
                <input
                  name="phone_number"
                  type="tel"
                  dir="ltr"
                  autoComplete="tel"
                  required
                  value={details.phone_number}
                  onChange={(event) =>
                    updateDetail('phone_number', event.target.value)
                  }
                  aria-invalid={Boolean(fieldErrors.phone_number)}
                  aria-describedby={
                    fieldErrors.phone_number ? 'phone-number-error' : undefined
                  }
                  placeholder="09123456789"
                  className="rounded-2xl border border-[#18302d]/20 bg-white px-4 py-3.5 text-left outline-none transition focus:border-[#155e57]"
                />
                {fieldErrors.phone_number && (
                  <span
                    id="phone-number-error"
                    className="text-xs font-normal text-red-700"
                  >
                    {fieldErrors.phone_number}
                  </span>
                )}
              </label>

              {mode === 'register' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-black">
                      نام
                      <input
                        name="first_name"
                        autoComplete="given-name"
                        required
                        value={details.first_name}
                        onChange={(event) =>
                          updateDetail('first_name', event.target.value)
                        }
                        aria-invalid={Boolean(fieldErrors.first_name)}
                        className="rounded-2xl border border-[#18302d]/20 bg-white px-4 py-3.5 outline-none transition focus:border-[#155e57]"
                      />
                      {fieldErrors.first_name && (
                        <span className="text-xs font-normal text-red-700">
                          {fieldErrors.first_name}
                        </span>
                      )}
                    </label>
                    <label className="grid gap-2 text-sm font-black">
                      نام خانوادگی
                      <input
                        name="last_name"
                        autoComplete="family-name"
                        required
                        value={details.last_name}
                        onChange={(event) =>
                          updateDetail('last_name', event.target.value)
                        }
                        aria-invalid={Boolean(fieldErrors.last_name)}
                        className="rounded-2xl border border-[#18302d]/20 bg-white px-4 py-3.5 outline-none transition focus:border-[#155e57]"
                      />
                      {fieldErrors.last_name && (
                        <span className="text-xs font-normal text-red-700">
                          {fieldErrors.last_name}
                        </span>
                      )}
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-black">
                    ایمیل
                    <input
                      name="email"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      required
                      value={details.email}
                      onChange={(event) =>
                        updateDetail('email', event.target.value)
                      }
                      aria-invalid={Boolean(fieldErrors.email)}
                      className="rounded-2xl border border-[#18302d]/20 bg-white px-4 py-3.5 text-left outline-none transition focus:border-[#155e57]"
                    />
                    {fieldErrors.email && (
                      <span className="text-xs font-normal text-red-700">
                        {fieldErrors.email}
                      </span>
                    )}
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#155e57] px-6 py-4 text-sm font-black text-white transition hover:bg-[#104b46] disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? 'در حال ثبت درخواست…' : 'دریافت کد ورود'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="mt-6 space-y-5" noValidate>
              <p className="text-sm leading-7 text-[#65716e]">
                کد برای درخواست شمارهٔ{' '}
                <strong dir="ltr" className="text-[#18302d]">
                  {phoneNumber}
                </strong>{' '}
                ثبت شده و تا ۱۰ دقیقه معتبر است.
              </p>
              <label className="grid gap-2 text-sm font-black">
                کد ورود
                <input
                  name="code"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(
                      asciiDigits(event.target.value)
                        .replace(/\D/g, '')
                        .slice(0, 6),
                    )
                    setFieldErrors((current) => ({
                      ...current,
                      code: undefined,
                    }))
                  }}
                  aria-invalid={Boolean(fieldErrors.code)}
                  className="w-full rounded-2xl border border-[#18302d]/20 bg-white px-4 py-4 text-center font-mono text-2xl tracking-[0.35em] outline-none transition focus:border-[#155e57]"
                />
                {fieldErrors.code && (
                  <span className="text-xs font-normal text-red-700">
                    {fieldErrors.code}
                  </span>
                )}
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#155e57] px-6 py-4 text-sm font-black text-white transition hover:bg-[#104b46] disabled:cursor-wait disabled:opacity-60"
              >
                {loading
                  ? mode === 'login'
                    ? 'در حال ورود…'
                    : 'در حال ساخت حساب…'
                  : mode === 'login'
                    ? 'ورود به آتنا'
                    : 'ساخت حساب و ورود'}
              </button>

              <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs font-bold text-[#155e57]">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void requestCode(true)}
                  className="underline decoration-[#155e57]/30 underline-offset-4 disabled:opacity-50"
                >
                  درخواست دوبارهٔ کد
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep('details')
                    setCode('')
                    resetMessages()
                  }}
                  className="underline decoration-[#155e57]/30 underline-offset-4 disabled:opacity-50"
                >
                  ویرایش شماره و مشخصات
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
