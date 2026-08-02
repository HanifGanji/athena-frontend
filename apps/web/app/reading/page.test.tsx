import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ReadingPage from '@/app/reading/page'

const summary = {
  id: 'test-1',
  slug: 'demo',
  module: 'academic',
  version_number: 1,
  title: 'Reading diagnostic',
  description: 'A short diagnostic.',
  time_limit_seconds: 1200,
  question_count: 1,
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
              mode: 'practice',
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

    fireEvent.click(await screen.findByRole('button', { name: /شروع تمرین/ }))
    expect(
      await screen.findByRole('heading', { name: 'A useful passage' }),
    ).toBeVisible()

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
  })
})
