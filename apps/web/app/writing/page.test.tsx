import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import WritingPage from '@/app/writing/page'

const promptSummary = {
  id: 'prompt-version-1',
  slug: 'demo',
  module: 'academic',
  task_type: 'task_2',
  version_number: 1,
  title: 'A fair public service',
  minimum_word_count: 250,
  recommended_time_seconds: 2400,
}

const prompt = {
  ...promptSummary,
  prompt_text:
    'Public services should be free for every household. Do you agree?',
  instructions: 'Give reasons and include relevant examples.',
  requirements: [
    { kind: 'question', text: 'State and support your position.', sequence: 1 },
  ],
  assets: [],
  criteria: [
    {
      code: 'task-response',
      name_en: 'Task Response',
      name_fa: 'پاسخ‌دهی به سؤال',
      sequence: 1,
      weight: '0.250',
    },
    {
      code: 'coherence-cohesion',
      name_en: 'Coherence and Cohesion',
      name_fa: 'انسجام و پیوستگی',
      sequence: 2,
      weight: '0.250',
    },
    {
      code: 'lexical-resource',
      name_en: 'Lexical Resource',
      name_fa: 'دامنهٔ واژگان',
      sequence: 3,
      weight: '0.250',
    },
    {
      code: 'grammatical-range-accuracy',
      name_en: 'Grammatical Range and Accuracy',
      name_fa: 'تنوع و دقت دستوری',
      sequence: 4,
      weight: '0.250',
    },
  ],
}

const initialResponse = {
  id: 'response-1',
  draft_text: '',
  draft_revision_number: 0,
  draft_word_count: 0,
  updated_at: new Date().toISOString(),
}

function attempt(status = 'in_progress', response = initialResponse) {
  return {
    id: 'attempt-1',
    mode: 'single_task',
    status,
    started_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    submitted_at: status === 'in_progress' ? null : new Date().toISOString(),
    completed_at: null,
    active_duration_seconds: 0,
    tasks: [
      {
        id: 'task-1',
        task_number: 2,
        sequence: 1,
        score_weight: 2,
        recommended_time_seconds: 2400,
        prompt,
        response,
        ...(status === 'in_progress'
          ? {}
          : {
              submission: {
                id: 'submission-1',
                text_content: response.draft_text,
                word_count: response.draft_word_count,
                submitted_at: new Date().toISOString(),
              },
            }),
      },
    ],
  }
}

function json(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('WritingPage', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=writing-test-token; path=/'
  })

  afterEach(() => vi.restoreAllMocks())

  it('saves, reviews, submits, and renders rich criterion feedback', async () => {
    let savedResponse = initialResponse
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = String(input)
        if (url.endsWith('/writing/prompts/')) return json([promptSummary])
        if (url.endsWith('/writing/tests/')) return json([])
        if (url.endsWith('/writing/prompts/demo/attempts/')) {
          return json(attempt(), 201)
        }
        if (url.endsWith('/tasks/task-1/draft/')) {
          const body = JSON.parse(String(init?.body)) as { text: string }
          savedResponse = {
            ...savedResponse,
            draft_text: body.text,
            draft_revision_number: savedResponse.draft_revision_number + 1,
            draft_word_count: 11,
            updated_at: new Date().toISOString(),
          }
          return json({ response: savedResponse, cached: false, changed: true })
        }
        if (url.endsWith('/writing/attempts/attempt-1/submit/')) {
          return json(attempt('submitted', savedResponse))
        }
        if (url.endsWith('/writing/attempts/attempt-1/feedback/')) {
          return json({
            result: {
              estimated_band_score: '6.5',
              calculation_version: 'writing-band-v1',
              created_at: new Date().toISOString(),
            },
            evaluations: [
              {
                submission_id: 'submission-1',
                model_id: 'best-value-model',
                estimated_band_score: '6.5',
                summary_fa: 'موضع روشن است و برای بسط ایده جا دارد.',
                examiner_comment_en: 'A clear position with relevant ideas.',
                criterion_results: prompt.criteria.map((criterion) => ({
                  code: criterion.code,
                  name_en: criterion.name_en,
                  name_fa: criterion.name_fa,
                  band_score: '6.5',
                  rationale_fa: 'عملکرد پایدار و قابل توسعه است.',
                })),
                feedback_items: [
                  {
                    kind: 'strength',
                    criterion_code: 'task-response',
                    title_fa: 'موضع روشن',
                    explanation_fa: 'دیدگاه اصلی از ابتدا مشخص است.',
                    original_excerpt: 'Public services',
                    suggested_revision: '',
                    start_offset: 0,
                    end_offset: 15,
                    sequence: 1,
                  },
                  {
                    kind: 'improvement',
                    criterion_code: 'task-response',
                    title_fa: 'مثال دقیق‌تر',
                    explanation_fa: 'برای ادعای اصلی یک مثال واقعی اضافه کن.',
                    original_excerpt: '',
                    suggested_revision: 'For example, local councils could…',
                    start_offset: null,
                    end_offset: null,
                    sequence: 2,
                  },
                ],
                recommendations: [
                  {
                    criterion_code: 'task-response',
                    title_fa: 'تمرین بسط ایده',
                    action_fa: 'برای هر ادعا یک دلیل و مثال بنویس.',
                    reason_fa: 'پاسخ کامل‌تر و متقاعدکننده‌تر می‌شود.',
                    priority: 1,
                    sequence: 1,
                  },
                ],
                created_at: new Date().toISOString(),
              },
            ],
          })
        }
        return json({ detail: `Unexpected request: ${url}` }, 500)
      })

    render(<WritingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'شروع نوشتن ←' }))
    const editor = await screen.findByRole('textbox', {
      name: 'Writing Task 2 response',
    })
    fireEvent.change(editor, {
      target: {
        value:
          'Public services can support every household and create fairer cities.',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس' }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).endsWith('/tasks/task-1/draft/'),
        ),
      ).toBe(true),
    )

    const review = screen.getByRole('button', { name: 'مرور و ثبت پاسخ' })
    await waitFor(() => expect(review).toBeEnabled())
    fireEvent.click(review)
    expect(screen.getByText(/متن کوتاه‌تر از حد پیشنهادی است/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نهایی پاسخ' }))

    expect(
      await screen.findByRole('heading', { name: 'پاسخت با موفقیت ثبت شد.' }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'دریافت تحلیل معیاربه‌معیار' }),
    )

    expect(await screen.findByText('موضع روشن')).toBeVisible()
    expect(screen.getByText('مثال دقیق‌تر')).toBeVisible()
    expect(screen.getByText('تمرین بسط ایده')).toBeVisible()
    expect(screen.getAllByText('6.5').length).toBeGreaterThanOrEqual(1)
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.credentials === 'include'),
    ).toBe(true)
    const unsafeCalls = fetchMock.mock.calls.filter(([, init]) =>
      ['POST', 'PUT'].includes(String(init?.method)),
    )
    expect(unsafeCalls.length).toBeGreaterThan(0)
    expect(
      unsafeCalls.every(
        ([, init]) =>
          new Headers(init?.headers).get('X-CSRFToken') ===
          'writing-test-token',
      ),
    ).toBe(true)
  })

  it('stops on a stale revision and lets the learner choose the saved draft', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/writing/prompts/')) return json([promptSummary])
      if (url.endsWith('/writing/tests/')) return json([])
      if (url.endsWith('/writing/prompts/demo/attempts/')) {
        return json(attempt(), 201)
      }
      if (url.endsWith('/tasks/task-1/draft/')) {
        return json(
          {
            detail: 'The draft changed in another save operation.',
            current_revision_number: 3,
            current_text: 'This is the newer saved version from another tab.',
            current_word_count: 9,
          },
          409,
        )
      }
      return json({ detail: 'Unexpected request' }, 500)
    })

    render(<WritingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'شروع نوشتن ←' }))
    const editor = await screen.findByRole('textbox', {
      name: 'Writing Task 2 response',
    })
    fireEvent.change(editor, { target: { value: 'My local draft.' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس' }))

    expect(
      await screen.findByRole('heading', {
        name: 'یک نسخهٔ جدیدتر ذخیره شده است.',
      }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', {
        name: /ادامه با نسخهٔ جدیدتر ذخیره‌شده/,
      }),
    )
    expect(editor).toHaveValue(
      'This is the newer saved version from another tab.',
    )
  })
})
