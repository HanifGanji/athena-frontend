import { afterEach, describe, expect, it, vi } from 'vitest'

import { speakingApi } from './speaking-api'

describe('speakingApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards an AbortSignal through every Speaking request', async () => {
    document.cookie = 'csrftoken=speaking-api-test; path=/'
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        if (String(input).endsWith('/speech/')) {
          return Promise.resolve(
            new Response(new Blob(['audio'], { type: 'audio/mpeg' }), {
              status: 200,
            }),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      })
    const signal = new AbortController().signal

    await speakingApi.listSessions(signal)
    await speakingApi.createSession('ielts', signal)
    await speakingApi.getSession('session-id', signal)
    await speakingApi.advance('session-id', signal)
    await speakingApi.submitResponse(
      'session-id',
      {
        audio: new Blob(['voice'], { type: 'audio/webm' }),
        clientEventId: 'event-id',
        filename: 'answer.webm',
        promptId: 'prompt-id',
        recordingDurationMs: 1_000,
      },
      signal,
    )
    await speakingApi.getSpeech('session-id', 'turn-id', signal)
    await speakingApi.abandon('session-id', signal)
    await speakingApi.getOrCreateFeedback('session-id', signal)

    expect(fetchMock).toHaveBeenCalledTimes(8)
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBe(signal)
    }
  })
})
