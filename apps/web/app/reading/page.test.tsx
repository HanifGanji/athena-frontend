import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ReadingPage from '@/app/reading/page'

const summary = {
  id: 'test-1',
  slug: 'demo',
  module: 'academic',
  source_title: 'Cambridge IELTS 8 Academic Reading Test 1',
  version_number: 1,
  title: 'Academic Reading Test 01',
  description: 'A complete Academic Reading test.',
  experience_type: 'simulation',
  delivery_settings: {
    allowed_attempt_modes: ['timed_mock'],
    future_challenge: { eligible: true, selection_tags: ['full-length'] },
  },
  time_limit_seconds: 1200,
  question_count: 2,
}

const detail = {
  ...summary,
  sections: [
    {
      id: 'section-1',
      number: 1,
      title: 'Section one',
      sequence: 1,
      recommended_minutes: 20,
      stimulus_bundles: [
        {
          id: 'bundle-1',
          title: 'A useful passage',
          kind: 'passage',
          sequence: 1,
          documents: [
            {
              id: 'document-1',
              label: 'Passage',
              title: 'A useful passage',
              kind: 'article',
              sequence: 1,
              blocks: [
                {
                  id: 'block-1',
                  kind: 'paragraph',
                  label: 'A',
                  sequence: 1,
                  text_content: 'Careful readers look for evidence.',
                  metadata: {},
                },
              ],
            },
          ],
        },
      ],
      question_groups: [
        {
          id: 'group-1',
          stimulus_bundle_id: 'bundle-1',
          interaction_type: 'true_false_not_given',
          instructions: 'Choose the correct answer.',
          sequence: 1,
          response_rules: {},
          options: [
            { value: 'TRUE', label: 'True', sequence: 1 },
            { value: 'FALSE', label: 'False', sequence: 2 },
          ],
          response_slots: [
            {
              id: 'slot-1',
              display_number: 1,
              prompt: 'Readers should use evidence.',
              sequence: 1,
              score_weight: 1,
              is_example: false,
              skills: ['evidence'],
            },
          ],
        },
      ],
    },
    {
      id: 'section-2',
      number: 2,
      title: 'Section two',
      sequence: 2,
      recommended_minutes: 20,
      stimulus_bundles: [
        {
          id: 'bundle-2',
          title: 'A second passage',
          kind: 'passage',
          sequence: 1,
          documents: [
            {
              id: 'document-2',
              label: 'Passage',
              title: 'A second passage',
              kind: 'article',
              sequence: 1,
              blocks: [
                {
                  id: 'block-2',
                  kind: 'paragraph',
                  label: 'A',
                  sequence: 1,
                  text_content: 'Each passage has its own focused page.',
                  metadata: {},
                },
              ],
            },
          ],
        },
      ],
      question_groups: [
        {
          id: 'group-2',
          stimulus_bundle_id: 'bundle-2',
          interaction_type: 'true_false_not_given',
          instructions: 'Choose the correct answer for passage two.',
          sequence: 1,
          response_rules: {},
          options: [
            { value: 'TRUE', label: 'True', sequence: 1 },
            { value: 'FALSE', label: 'False', sequence: 2 },
          ],
          response_slots: [
            {
              id: 'slot-2',
              display_number: 2,
              prompt: 'This question belongs to passage two.',
              sequence: 1,
              score_weight: 1,
              is_example: false,
              skills: ['evidence'],
            },
          ],
        },
      ],
    },
  ],
}

function json(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('ReadingPage', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=reading-test-token; path=/'
  })

  afterEach(() => vi.restoreAllMocks())

  it('completes the Reading flow from test selection to AI feedback', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = String(input)
        if (url.endsWith('/reading/tests/') && init?.method === 'GET') {
          return json([summary])
        }
        if (url.endsWith('/reading/tests/demo/')) return json(detail)
        if (url.endsWith('/reading/tests/demo/attempts/')) {
          return json(
            {
              id: 'attempt-1',
              test_version_id: 'test-1',
              mode: 'timed_mock',
              status: 'in_progress',
              started_at: new Date().toISOString(),
              submitted_at: null,
              raw_score: null,
              maximum_score: null,
            },
            201,
          )
        }
        if (url.includes('/responses/group-1/')) {
          return json({ group_id: 'group-1', answer_payload: {} })
        }
        if (url.endsWith('/submit/')) {
          return json({
            evaluator_version: 'reading-v1',
            raw_score: 1,
            maximum_score: 1,
            created_at: new Date().toISOString(),
            results: [
              {
                question_id: 'slot-1',
                question_number: 1,
                submitted_value: 'TRUE',
                correct_value: 'TRUE',
                awarded_score: 1,
                result_code: 'correct',
                evidence: [{ block_id: 'block-1', quote: 'look for evidence' }],
              },
            ],
          })
        }
        if (url.endsWith('/feedback/')) {
          return json({
            model_id: 'low-cost-model',
            summary_fa: 'عملکرد دقیق بود.',
            strengths_fa: ['پیدا کردن شاهد'],
            improvements_fa: ['مدیریت زمان'],
            next_action_fa: 'یک متن دیگر تمرین کن.',
            created_at: new Date().toISOString(),
            cached: false,
          })
        }
        return json({ detail: 'Unexpected request' }, 500)
      })

    render(<ReadingPage />)

    expect(
      await screen.findByRole('heading', { name: 'Academic Reading Test 01' }),
    ).toBeVisible()
    expect(screen.getByText('IELTS 8 · Academic · Reading 1')).toBeVisible()
    expect(screen.queryByText('1 سؤال')).not.toBeInTheDocument()
    expect(screen.queryByText(/simulation/i)).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /شروع آزمون/ }))
    expect(
      await screen.findByRole('heading', { name: 'A useful passage' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'A second passage' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('PASSAGES')).not.toBeInTheDocument()
    const passageNavigation = screen.getByRole('navigation', {
      name: 'جابه‌جایی میان متن‌های Reading',
    })
    const questionNavigation = screen.getByRole('navigation', {
      name: 'جابه‌جایی میان سؤال‌های متن فعال',
    })
    expect(passageNavigation).toBeVisible()
    expect(questionNavigation).toBeVisible()
    expect(passageNavigation.compareDocumentPosition(questionNavigation)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(document.getElementById('reading-workspace-start')).toHaveAttribute(
      'dir',
      'ltr',
    )
    expect(screen.getByLabelText('Reading questions')).toHaveAttribute(
      'dir',
      'rtl',
    )
    const questionPane = screen.getByLabelText('Reading questions')
    const submitFooter = screen.getByLabelText('ارسال آزمون Reading')
    expect(questionPane).toContainElement(submitFooter)
    expect(submitFooter).toHaveClass('bg-[#efede5]')
    expect(screen.getByText('آمادهٔ پایان آزمون؟')).toBeVisible()
    expect(questionPane).toContainElement(
      screen.getByRole('button', { name: 'پایان و تصحیح' }),
    )
    expect(screen.getByRole('button', { name: 'رفتن به سؤال 1' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'رفتن به سؤال 2' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'رفتن به سؤال 1' }))
    expect(document.getElementById('question-1')).toHaveAttribute(
      'aria-current',
      'location',
    )

    const passageText = screen.getByText('Careful readers look for evidence.')
    const selectionMock = vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => ({
        commonAncestorContainer: passageText,
        getBoundingClientRect: () => ({
          top: 220,
          right: 180,
          bottom: 240,
          left: 100,
          width: 80,
          height: 20,
          x: 100,
          y: 220,
          toJSON: () => ({}),
        }),
      }),
      toString: () => 'look for evidence',
    } as unknown as Selection)
    fireEvent.mouseUp(passageText)
    const translateLink = screen.getByRole('link', {
      name: /ترجمهٔ انگلیسی به فارسی/,
    }) as HTMLAnchorElement
    const translateUrl = new URL(translateLink.href)
    expect(translateUrl.hostname).toBe('translate.google.com')
    expect(translateUrl.searchParams.get('sl')).toBe('en')
    expect(translateUrl.searchParams.get('tl')).toBe('fa')
    expect(translateUrl.searchParams.get('text')).toBe('look for evidence')
    fireEvent.click(screen.getByRole('button', { name: 'بستن پنجرهٔ معنی' }))
    selectionMock.mockRestore()

    fireEvent.click(screen.getByRole('button', { name: 'رفتن به متن 2' }))
    expect(
      await screen.findByRole('heading', { name: 'A second passage' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'A useful passage' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'رفتن به سؤال 2' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'رفتن به سؤال 1' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'رفتن به متن 1' }))

    fireEvent.click(screen.getByRole('radio', { name: /True/ }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('/responses/'),
        ),
      ).toBe(true),
    )

    const submit = screen.getByRole('button', { name: 'پایان و تصحیح' })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    expect(await screen.findByText('پاسخ درست است.')).toBeVisible()

    fireEvent.click(screen.getByRole('link', { name: /شاهد:/ }))
    expect(document.getElementById('block-block-1')).toHaveAttribute(
      'aria-current',
      'location',
    )
    expect(screen.getByText('شاهد مرتبط در متن برجسته شد.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'تحلیل فارسی با AI' }))
    expect(await screen.findByText('پیدا کردن شاهد')).toBeVisible()
    expect(screen.getByText('یک متن دیگر تمرین کن.')).toBeVisible()
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.credentials === 'include'),
    ).toBe(true)
    const saveCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/responses/'),
    )
    expect(new Headers(saveCall?.[1]?.headers).get('X-CSRFToken')).toBe(
      'reading-test-token',
    )
    const startCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/reading/tests/demo/attempts/'),
    )
    expect(String(startCall?.[1]?.body)).toContain('timed_mock')
  })
})
