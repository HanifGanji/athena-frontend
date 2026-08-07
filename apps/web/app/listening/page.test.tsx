import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ListeningPage from '@/app/listening/page'

const summary = {
  id: 'test-1',
  slug: 'demo',
  module: 'both',
  series: {
    id: 'series-1',
    slug: 'athena-original-listening',
    title: 'Athena Original Listening',
    publisher: 'Athena',
    volume_number: null,
    release_year: null,
    sequence: 1000,
  },
  series_test_number: 1,
  version_number: 1,
  title: 'Listening sampler',
  description: 'An original sampler.',
  time_limit_seconds: 1200,
  question_count: 7,
  part_count: 1,
  content_origin: 'athena_original',
  rights_status: 'owned',
}

const publisherSummary = {
  ...summary,
  id: 'test-2',
  slug: 'publisher-source',
  series: {
    id: 'series-2',
    slug: 'cambridge-ielts-19',
    title: 'Cambridge IELTS 19',
    publisher: 'Cambridge University Press & Assessment',
    volume_number: 19,
    release_year: 2024,
    sequence: 19,
  },
  title: 'Cambridge IELTS 19 · Listening Test 1',
  description: 'A complete publisher-source sample.',
  time_limit_seconds: 1800,
  question_count: 40,
  part_count: 4,
  content_origin: 'publisher_source',
  rights_status: 'internal_only',
}

const slots = {
  completion: {
    id: 'slot-1',
    display_number: 1,
    prompt: 'Day of workshop',
    sequence: 1,
    score_weight: 1,
    placeholder: 'day',
  },
  single: {
    id: 'slot-2',
    display_number: 2,
    prompt: 'What is included?',
    sequence: 1,
    score_weight: 1,
    placeholder: '',
  },
  multiA: {
    id: 'slot-3',
    display_number: 3,
    prompt: 'First reason',
    sequence: 1,
    score_weight: 1,
    placeholder: '',
  },
  multiB: {
    id: 'slot-4',
    display_number: 4,
    prompt: 'Second reason',
    sequence: 2,
    score_weight: 1,
    placeholder: '',
  },
  matching: {
    id: 'slot-5',
    display_number: 5,
    prompt: 'Literature review',
    sequence: 1,
    score_weight: 1,
    placeholder: '',
  },
  map: {
    id: 'slot-6',
    display_number: 6,
    prompt: 'Café',
    sequence: 1,
    score_weight: 1,
    placeholder: '',
  },
  note: {
    id: 'slot-7',
    display_number: 7,
    prompt: 'Protection needed',
    sequence: 1,
    score_weight: 1,
    placeholder: 'one word',
  },
}

const detail = {
  ...summary,
  parts: [
    {
      id: 'part-1',
      number: 1,
      sequence: 1,
      title: 'Everyday contexts',
      context: 'Listen and answer.',
      instructions: 'Play the recording.',
      media: [
        {
          role: 'primary',
          sequence: 1,
          start_offset_ms: 0,
          end_offset_ms: null,
          asset: {
            id: 'audio-1',
            title: 'Part 1 audio',
            mime_type: 'audio/mp4',
            duration_ms: 30000,
            url: '/listening/media/audio-1/',
          },
        },
      ],
      question_groups: [
        {
          id: 'group-completion',
          interaction_type: 'completion',
          presentation: 'form',
          title: 'Booking form',
          instructions: 'Write one word.',
          sequence: 1,
          response_rules: {},
          visual_asset: null,
          options: [],
          response_slots: [slots.completion],
          content_blocks: [],
        },
        {
          id: 'group-single',
          interaction_type: 'single_choice',
          presentation: 'plain',
          title: 'Membership',
          instructions: 'Choose one answer.',
          sequence: 2,
          response_rules: { maximum_selections: 1 },
          visual_asset: null,
          options: [
            {
              id: 'option-a',
              response_slot_id: 'slot-2',
              value: 'A',
              label: 'Classes',
              sequence: 1,
            },
            {
              id: 'option-b',
              response_slot_id: 'slot-2',
              value: 'B',
              label: 'Equipment loan',
              sequence: 2,
            },
          ],
          response_slots: [slots.single],
          content_blocks: [],
        },
        {
          id: 'group-multi',
          interaction_type: 'multi_select',
          presentation: 'plain',
          title: 'Reasons',
          instructions: 'Choose two answers.',
          sequence: 3,
          response_rules: { maximum_selections: 2 },
          visual_asset: null,
          options: [
            {
              id: 'multi-a',
              response_slot_id: null,
              value: 'A',
              label: 'Flexible time',
              sequence: 1,
            },
            {
              id: 'multi-b',
              response_slot_id: null,
              value: 'B',
              label: 'Local data',
              sequence: 2,
            },
          ],
          response_slots: [slots.multiA, slots.multiB],
          content_blocks: [],
        },
        {
          id: 'group-matching',
          interaction_type: 'matching',
          presentation: 'plain',
          title: 'Responsibilities',
          instructions: 'Match each task.',
          sequence: 4,
          response_rules: {},
          visual_asset: null,
          options: [
            {
              id: 'match-a',
              response_slot_id: null,
              value: 'A',
              label: 'Mina',
              sequence: 1,
            },
          ],
          response_slots: [slots.matching],
          content_blocks: [],
        },
        {
          id: 'group-map',
          interaction_type: 'spatial_labeling',
          presentation: 'map',
          title: 'Centre plan',
          instructions: 'Label the map.',
          sequence: 5,
          response_rules: {},
          visual_asset: {
            id: 'map-1',
            title: 'Centre map',
            alt_text: 'A lettered learning-centre plan.',
            mime_type: 'image/svg+xml',
            url: '/listening/visuals/map-1/',
          },
          options: [
            {
              id: 'map-b',
              response_slot_id: null,
              value: 'B',
              label: 'Area B',
              sequence: 1,
            },
          ],
          response_slots: [slots.map],
          content_blocks: [],
        },
        {
          id: 'group-notes',
          interaction_type: 'completion',
          presentation: 'notes',
          title: 'Lecture notes',
          instructions: 'Write one word.',
          sequence: 6,
          response_rules: {},
          visual_asset: null,
          options: [],
          response_slots: [slots.note],
          content_blocks: [
            {
              id: 'notes-panel',
              parent_id: null,
              response_slot_id: null,
              kind: 'panel',
              sequence: 1,
              text_content: '',
              metadata: { variant: 'document' },
              segments: [],
            },
            {
              id: 'notes-heading',
              parent_id: 'notes-panel',
              response_slot_id: null,
              kind: 'heading',
              sequence: 2,
              text_content: 'Growing conditions',
              metadata: {},
              segments: [
                {
                  id: 'notes-heading-text',
                  response_slot_id: null,
                  kind: 'text',
                  sequence: 1,
                  text_content: 'Growing conditions',
                  emphasis: 'normal',
                },
              ],
            },
            {
              id: 'notes-line',
              parent_id: 'notes-panel',
              response_slot_id: 'slot-7',
              kind: 'list_item',
              sequence: 3,
              text_content: 'Protection needed: [7]',
              metadata: { marker: 'bullet' },
              segments: [
                {
                  id: 'notes-line-text',
                  response_slot_id: null,
                  kind: 'text',
                  sequence: 1,
                  text_content: 'Protection needed: ',
                  emphasis: 'normal',
                },
                {
                  id: 'notes-line-response',
                  response_slot_id: 'slot-7',
                  kind: 'response',
                  sequence: 2,
                  text_content: '',
                  emphasis: 'normal',
                },
              ],
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

describe('ListeningPage', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=listening-test-token; path=/'
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:listening-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('lists original and locally reviewed publisher-source tests distinctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (
        String(input).endsWith('/listening/tests/') &&
        init?.method === 'GET'
      ) {
        return json([summary, publisherSummary])
      }
      return json({ detail: 'Unexpected request' }, 500)
    })

    render(<ListeningPage />)

    expect(await screen.findByText(summary.title)).toBeVisible()
    expect(screen.getByText(publisherSummary.title)).toBeVisible()
    expect(screen.getByText('Athena Original')).toBeVisible()
    expect(screen.getByText('Publisher source · local review')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Athena Original Listening' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Cambridge IELTS 19' }),
    ).toBeVisible()
    expect(screen.getByText('Volume 19')).toBeVisible()
    expect(screen.getByText('02 TESTS')).toBeVisible()
  })

  it('plays protected audio, answers every interaction type, and shows results', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = String(input)
        if (url.endsWith('/listening/tests/') && init?.method === 'GET') {
          return json([summary])
        }
        if (url.endsWith('/listening/tests/demo/')) return json(detail)
        if (url.endsWith('/listening/tests/demo/attempts/')) {
          return json(
            {
              id: 'attempt-1',
              test_version_id: 'test-1',
              mode: 'practice',
              status: 'in_progress',
              manifest: {},
              started_at: new Date().toISOString(),
              submitted_at: null,
              active_duration_seconds: 0,
              raw_score: null,
              maximum_score: null,
              responses: [],
            },
            201,
          )
        }
        if (url.includes('/listening/media/')) {
          return Promise.resolve(new Response(new Blob(['audio'])))
        }
        if (url.includes('/listening/visuals/')) {
          return Promise.resolve(new Response(new Blob(['svg'])))
        }
        if (url.includes('/responses/')) {
          return json({ group_id: 'saved', answer_payload: {} })
        }
        if (url.endsWith('/listening/attempts/attempt-1/submit/')) {
          return json({
            evaluator_version: 'listening-v1',
            raw_score: 7,
            maximum_score: 7,
            created_at: new Date().toISOString(),
            results: Object.values(slots).map((slot) => ({
              question_id: slot.id,
              question_number: slot.display_number,
              submitted_value: 'answer',
              normalized_value: 'answer',
              correct_value: ['answer'],
              awarded_score: 1,
              result_code: 'correct',
            })),
          })
        }
        return json({ detail: `Unexpected request: ${url}` }, 500)
      })

    render(<ListeningPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'شروع تمرین ←' }))

    const audio = await screen.findByLabelText('فایل صوتی Part 1 audio')
    expect(audio).toBeVisible()
    expect(audio).toHaveProperty('playbackRate', 1)
    fireEvent.click(screen.getByRole('button', { name: 'سرعت پخش 1.5 برابر' }))
    await waitFor(() => expect(audio).toHaveProperty('playbackRate', 1.5))
    expect(
      screen.getByRole('button', { name: 'سرعت پخش 1.5 برابر' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      await screen.findByAltText('A lettered learning-centre plan.'),
    ).toBeVisible()

    const day = screen.getByRole('textbox', { name: /Day of workshop/ })
    const firstQuestion = document.querySelector<HTMLElement>(
      '[data-listening-question="1"]',
    )
    expect(firstQuestion).not.toBeNull()
    const firstQuestionScroll = vi.fn()
    firstQuestion!.scrollIntoView = firstQuestionScroll
    fireEvent.click(screen.getByRole('button', { name: 'رفتن به سؤال 1' }))
    expect(firstQuestionScroll).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    })
    expect(day).toHaveFocus()
    expect(firstQuestion).toHaveAttribute('data-question-active', 'true')
    expect(
      document.querySelector('label[for="answer-slot-1"] span'),
    ).toHaveClass('mr-3')
    fireEvent.change(day, { target: { value: 'Saturday' } })
    fireEvent.blur(day)
    fireEvent.click(screen.getByRole('radio', { name: /Equipment loan/ }))
    const flexibleTime = screen.getByRole('checkbox', {
      name: /Flexible time/,
    })
    const multiQuestion = document.querySelector<HTMLElement>(
      '[data-listening-question~="4"]',
    )
    expect(multiQuestion).not.toBeNull()
    const multiQuestionScroll = vi.fn()
    multiQuestion!.scrollIntoView = multiQuestionScroll
    fireEvent.click(screen.getByRole('button', { name: 'رفتن به سؤال 4' }))
    expect(multiQuestionScroll).toHaveBeenCalled()
    expect(flexibleTime).toHaveFocus()
    expect(multiQuestion).toHaveAttribute('data-question-active', 'true')
    fireEvent.click(flexibleTime)
    fireEvent.click(screen.getByRole('checkbox', { name: /Local data/ }))
    fireEvent.change(
      screen.getByRole('combobox', { name: /Literature review/ }),
      { target: { value: 'A' } },
    )
    expect(
      screen.getByRole('region', { name: 'Responsibilities answer choices' }),
    ).toHaveTextContent('AMina')
    fireEvent.change(screen.getByRole('combobox', { name: /Café/ }), {
      target: { value: 'B' },
    })
    const note = screen.getByRole('textbox', { name: /Protection needed/ })
    expect(note.closest('[data-listening-question="7"]')).toHaveClass(
      'inline-flex',
    )
    expect(
      note.closest('[data-listening-question="7"]')?.parentElement,
    ).toHaveTextContent('Protection needed:')
    expect(screen.getByRole('heading', { name: 'Lecture notes' })).toBeVisible()
    fireEvent.change(note, { target: { value: 'shade' } })
    fireEvent.blur(note)

    fireEvent.click(screen.getByRole('button', { name: 'پایان و تصحیح' }))
    expect(
      screen.getByRole('heading', { name: 'پاسخ‌ها ثبت نهایی شوند؟' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت و تصحیح' }))

    expect(
      await screen.findByRole('heading', { name: 'پاسخ‌ها تصحیح شدند.' }),
    ).toBeVisible()
    expect(screen.getAllByText('7/7').length).toBeGreaterThan(0)
    expect(screen.getAllByText('پاسخ درست است.').length).toBeGreaterThan(0)
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/listening/media/'),
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.credentials === 'include'),
    ).toBe(true)
    const unsafeCalls = fetchMock.mock.calls.filter(([, init]) =>
      ['POST', 'PUT'].includes(String(init?.method)),
    )
    expect(
      unsafeCalls.every(
        ([, init]) =>
          new Headers(init?.headers).get('X-CSRFToken') ===
          'listening-test-token',
      ),
    ).toBe(true)
  })
})
