import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest, ApiError, AUTH_REQUIRED_EVENT } from '@/lib/api-client'

function json(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function setCsrfCookie(value: string) {
  document.cookie = `csrftoken=${value}; path=/`
}

function clearCsrfCookie() {
  document.cookie = 'csrftoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

describe('apiRequest', () => {
  beforeEach(() => {
    clearCsrfCookie()
    window.history.replaceState({}, '', '/reading?section=2#question-4')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearCsrfCookie()
  })

  it('includes credentials on safe requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(json({ ok: true }))

    await expect(apiRequest<{ ok: boolean }>('/example/')).resolves.toEqual({
      ok: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/example/',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    )
  })

  it('bootstraps CSRF, merges headers, and leaves FormData content type to the browser', async () => {
    const formData = new FormData()
    formData.append(
      'audio',
      new Blob(['voice'], { type: 'audio/webm' }),
      'voice.webm',
    )
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => {
        setCsrfCookie('bootstrapped-token')
        return Promise.resolve(new Response(null, { status: 204 }))
      })
      .mockReturnValueOnce(json({ created: true }, 201))

    await apiRequest('/upload/', {
      method: 'POST',
      body: formData,
      headers: { 'X-Client': 'athena' },
    })

    expect(fetchMock.mock.calls[0]).toEqual([
      'http://localhost:8000/api/v1/auth/csrf/',
      { credentials: 'include' },
    ])
    const upload = fetchMock.mock.calls[1]?.[1]
    const headers = new Headers(upload?.headers)
    expect(upload?.credentials).toBe('include')
    expect(upload?.body).toBe(formData)
    expect(headers.get('X-Client')).toBe('athena')
    expect(headers.get('X-CSRFToken')).toBe('bootstrapped-token')
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('reads a freshly rotated CSRF cookie for every unsafe request', async () => {
    setCsrfCookie('before-login')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => json({}))

    await apiRequest('/auth/login/verify/', { method: 'POST', body: '{}' })
    setCsrfCookie('after-login')
    await apiRequest('/reading/attempts/', { method: 'POST', body: '{}' })

    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-CSRFToken'),
    ).toBe('before-login')
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-CSRFToken'),
    ).toBe('after-login')
  })

  it('returns binary responses without converting them to JSON', async () => {
    setCsrfCookie('binary-token')
    const audio = new Blob(['mp3'], { type: 'audio/mpeg' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(audio, { headers: { 'Content-Type': 'audio/mpeg' } }),
    )

    const result = await apiRequest<Blob>('/speech/', {
      method: 'POST',
      responseType: 'blob',
    })

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('audio/mpeg')
  })

  it('retains DRF field errors and announces only 401 responses as expired sessions', async () => {
    setCsrfCookie('error-token')
    const listener = vi.fn()
    window.addEventListener(AUTH_REQUIRED_EVENT, listener)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(
        json(
          {
            phone_number: ['این شماره پیدا نشد.'],
            email: ['ایمیل معتبر نیست.'],
          },
          400,
        ),
      )
      .mockReturnValueOnce(json({ detail: 'CSRF failed.' }, 403))
      .mockReturnValueOnce(json({ detail: 'نشست منقضی شده است.' }, 401))

    const fieldFailure = await apiRequest('/auth/login/request-code/', {
      method: 'POST',
      body: '{}',
    }).catch((reason: unknown) => reason)
    expect(fieldFailure).toBeInstanceOf(ApiError)
    expect((fieldFailure as ApiError).fieldErrors).toEqual({
      phone_number: 'این شماره پیدا نشد.',
      email: 'ایمیل معتبر نیست.',
    })
    expect(listener).not.toHaveBeenCalled()

    await expect(apiRequest('/csrf-failure/')).rejects.toMatchObject({
      status: 403,
    })
    expect(listener).not.toHaveBeenCalled()

    await expect(apiRequest('/reading/tests/')).rejects.toMatchObject({
      status: 401,
    })
    expect(listener).toHaveBeenCalledOnce()
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      next: '/reading?section=2#question-4',
    })
    window.removeEventListener(AUTH_REQUIRED_EVENT, listener)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
