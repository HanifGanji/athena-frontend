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
  planning_questions: [],
  response_shape: 'opinion',
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

const submittedEssay =
  'Public services can support every household and create fairer cities.'

function attempt(status = 'in_progress', response = initialResponse) {
  return {
    id: 'attempt-1',
    mode: 'single_task',
    experience_mode: 'exam',
    experience: {
      title: 'Exam simulation',
      timer_enabled: true,
      planning_enabled: false,
      post_submission_feedback_enabled: true,
      rewrite_enabled: true,
      version_number: 1,
    },
    status,
    started_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    submitted_at: status === 'in_progress' ? null : new Date().toISOString(),
    completed_at: null,
    active_duration_seconds: 0,
    parent_submission_id: null,
    tasks: [
      {
        id: 'task-1',
        task_number: 2,
        sequence: 1,
        score_weight: 2,
        recommended_time_seconds: 2400,
        prompt,
        response,
        plan: null,
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
        if (url.endsWith('/writing/attempts/')) return json([])
        if (url.endsWith('/writing/progress/')) return json({ skills: [] })
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
                criterion_results: prompt.criteria.map((criterion, index) => ({
                  code: criterion.code,
                  name_en: criterion.name_en,
                  name_fa: criterion.name_fa,
                  band_score: ['7.0', '6.5', '6.0', '5.5'][index],
                  rationale_fa:
                    index === 0
                      ? 'موضع روشن است، اما یک مثال دقیق‌تر پاسخ را کامل می‌کند.'
                      : 'این معیار شواهد و محدودیت متفاوتی در متن دارد.',
                })),
                feedback_items: [
                  {
                    id: 'feedback-1',
                    kind: 'strength',
                    criterion_code: 'task-response',
                    skill_code: 'position-clarity',
                    skill_name_fa: 'شفافیت موضع',
                    title_fa: 'موضع روشن',
                    explanation_fa: 'دیدگاه اصلی از ابتدا مشخص است.',
                    original_excerpt: 'Public services',
                    suggested_revision: '',
                    start_offset: 0,
                    end_offset: 15,
                    sequence: 1,
                    learner_decision: null,
                  },
                  {
                    id: 'feedback-2',
                    kind: 'strength',
                    criterion_code: 'task-response',
                    skill_code: 'evidence-relevance',
                    skill_name_fa: 'پشتیبانی مرتبط',
                    title_fa: 'نتیجهٔ مرتبط',
                    explanation_fa:
                      'نتیجهٔ اجتماعی مستقیماً به ادعا مربوط است.',
                    original_excerpt: 'fairer cities',
                    suggested_revision: '',
                    start_offset: submittedEssay.indexOf('fairer cities'),
                    end_offset:
                      submittedEssay.indexOf('fairer cities') +
                      'fairer cities'.length,
                    sequence: 2,
                    learner_decision: null,
                  },
                  {
                    id: 'feedback-3',
                    kind: 'improvement',
                    criterion_code: 'task-response',
                    skill_code: 'idea-development',
                    skill_name_fa: 'بسط ایده',
                    title_fa: 'فعل کلی',
                    explanation_fa:
                      'فعل support نوع حمایت را مشخص نمی‌کند و استدلال را مبهم می‌گذارد.',
                    original_excerpt: 'can support',
                    suggested_revision: 'can provide reliable access to',
                    start_offset: submittedEssay.indexOf('can support'),
                    end_offset:
                      submittedEssay.indexOf('can support') +
                      'can support'.length,
                    sequence: 3,
                    learner_decision: null,
                  },
                  {
                    id: 'feedback-4',
                    kind: 'improvement',
                    criterion_code: 'task-response',
                    skill_code: 'task-coverage',
                    skill_name_fa: 'پوشش کامل سؤال',
                    title_fa: 'دامنهٔ مخاطب نامشخص',
                    explanation_fa:
                      'عبارت every household تفاوت نیازهای خانوارها را نشان نمی‌دهد.',
                    original_excerpt: 'every household',
                    suggested_revision: 'low-income and vulnerable households',
                    start_offset: submittedEssay.indexOf('every household'),
                    end_offset:
                      submittedEssay.indexOf('every household') +
                      'every household'.length,
                    sequence: 4,
                    learner_decision: null,
                  },
                  {
                    id: 'feedback-5',
                    kind: 'language_issue',
                    criterion_code: 'lexical-resource',
                    skill_code: 'word-choice-precision',
                    skill_name_fa: 'دقت انتخاب واژه',
                    title_fa: 'انتخاب واژهٔ دقیق‌تر',
                    explanation_fa:
                      'create درست است اما اثر سیاست را با دقت کافی بیان نمی‌کند.',
                    original_excerpt: 'create',
                    suggested_revision: 'help build more equitable',
                    start_offset: submittedEssay.indexOf('create'),
                    end_offset:
                      submittedEssay.indexOf('create') + 'create'.length,
                    sequence: 5,
                    learner_decision: null,
                  },
                ],
                recommendations: [
                  {
                    criterion_code: 'task-response',
                    skill_code: 'idea-development',
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
        value: submittedEssay,
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

    expect(
      await screen.findByRole('heading', {
        name: 'پاسخ تو با نکته‌های قابل بررسی',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'نمایش بازخورد: موضع روشن' }),
    ).toBeVisible()
    expect(screen.getAllByText('فعل کلی').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('تمرین بسط ایده')).toBeVisible()
    expect(screen.getAllByText('7.0').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('5.5').length).toBeGreaterThanOrEqual(1)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'نمایش بازخورد: دامنهٔ مخاطب نامشخص',
      }),
    )
    expect(
      screen.getByText('low-income and vulnerable households'),
    ).toBeVisible()
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
      if (url.endsWith('/writing/attempts/')) return json([])
      if (url.endsWith('/writing/progress/')) return json({ skills: [] })
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

  it('keeps exam mode as default and runs guided planning without AI', async () => {
    const planningQuestions = [
      {
        id: 'plan-question-1',
        kind: 'position',
        title_fa: 'موضع تو چیست؟',
        hint_fa: 'تصمیم اصلی را بنویس.',
        sequence: 1,
        required: true,
      },
      {
        id: 'plan-question-2',
        kind: 'main_idea',
        title_fa: 'ایدهٔ اصلی',
        hint_fa: 'قوی‌ترین دلیل را بنویس.',
        sequence: 2,
        required: true,
      },
    ]
    const guidedAttempt = {
      ...attempt(),
      experience_mode: 'guided',
      experience: {
        title: 'Guided learning',
        timer_enabled: false,
        planning_enabled: true,
        post_submission_feedback_enabled: true,
        rewrite_enabled: true,
        version_number: 1,
      },
      tasks: [
        {
          ...attempt().tasks[0],
          prompt: {
            ...prompt,
            assets: [
              {
                id: 'asset-1',
                kind: 'chart',
                url: '/writing/assets/asset-1/',
                alt_text: 'Public transport comparison chart',
                caption: '',
                sequence: 1,
                width_pixels: 1200,
                height_pixels: 720,
              },
            ],
            planning_questions: planningQuestions,
          },
          plan: {
            status: 'draft',
            revision_number: 0,
            entries: [],
            updated_at: new Date().toISOString(),
            completed_at: null,
          },
        },
      ],
    }
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = String(input)
        if (url.endsWith('/writing/prompts/')) return json([promptSummary])
        if (url.endsWith('/writing/tests/')) return json([])
        if (url.endsWith('/writing/attempts/')) return json([])
        if (url.endsWith('/writing/progress/')) return json({ skills: [] })
        if (url.endsWith('/writing/prompts/demo/attempts/')) {
          const body = JSON.parse(String(init?.body)) as {
            experience_mode: string
          }
          expect(body.experience_mode).toBe('guided')
          return json(guidedAttempt, 201)
        }
        if (url.endsWith('/tasks/task-1/plan/')) {
          return json({
            cached: false,
            plan: {
              ...guidedAttempt.tasks[0]!.plan,
              status: 'complete',
              revision_number: 1,
              entries: planningQuestions.map((question) => ({
                question_id: question.id,
                text_content: 'Learner plan',
                updated_at: new Date().toISOString(),
              })),
              completed_at: new Date().toISOString(),
            },
          })
        }
        return json({ detail: `Unexpected request: ${url}` }, 500)
      })

    render(<WritingPage />)

    expect(
      await screen.findByRole('button', { name: /شبیه‌سازی آزمون/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /یادگیری هدایت‌شده/ }))
    fireEvent.click(screen.getByRole('button', { name: 'شروع نوشتن ←' }))

    expect(
      await screen.findByRole('heading', { name: 'نقشهٔ کوتاه پاسخ خودت' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', {
        name: 'Public transport comparison chart',
      }),
    ).toBeVisible()
    const planFields = screen.getAllByPlaceholderText(
      'تصمیم خودت را کوتاه و روشن بنویس…',
    )
    for (const field of planFields) {
      fireEvent.change(field, { target: { value: 'Learner plan' } })
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'ذخیرهٔ نقشه و شروع نوشتن' }),
    )

    expect(
      await screen.findByRole('textbox', {
        name: 'Writing Task 2 response',
      }),
    ).toBeVisible()
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/feedback/')),
    ).toBe(false)
  })

  it('bypasses a legacy empty plan and resumes the exact draft after safe exit', async () => {
    const lunchBreakDraft =
      'I believe clean water should remain affordable because public health depends on reliable access.'
    let savedResponse = initialResponse
    const legacyGuidedAttempt = {
      ...attempt(),
      experience_mode: 'guided',
      experience: {
        title: 'Guided learning',
        timer_enabled: false,
        planning_enabled: true,
        post_submission_feedback_enabled: true,
        rewrite_enabled: true,
        version_number: 1,
      },
      tasks: [
        {
          ...attempt().tasks[0],
          plan: {
            status: 'draft',
            revision_number: 0,
            entries: [],
            updated_at: new Date().toISOString(),
            completed_at: null,
          },
        },
      ],
    }
    let attemptListCalls = 0
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = String(input)
        if (url.endsWith('/writing/prompts/')) return json([promptSummary])
        if (url.endsWith('/writing/tests/')) return json([])
        if (url.endsWith('/writing/progress/')) return json({ skills: [] })
        if (url.endsWith('/writing/attempts/')) {
          attemptListCalls += 1
          return json(
            attemptListCalls === 1
              ? []
              : [
                  {
                    id: 'attempt-1',
                    mode: 'single_task',
                    experience_mode: 'guided',
                    status: 'in_progress',
                    title: prompt.title,
                    task_type: prompt.task_type,
                    word_count: 13,
                    estimated_band_score: null,
                    started_at: legacyGuidedAttempt.started_at,
                    last_activity_at: new Date().toISOString(),
                    submitted_at: null,
                  },
                ],
          )
        }
        if (url.endsWith('/writing/prompts/demo/attempts/')) {
          return json(legacyGuidedAttempt, 201)
        }
        if (url.endsWith('/tasks/task-1/draft/')) {
          const body = JSON.parse(String(init?.body)) as { text: string }
          savedResponse = {
            ...savedResponse,
            draft_text: body.text,
            draft_revision_number: 1,
            draft_word_count: 13,
            updated_at: new Date().toISOString(),
          }
          return json({ response: savedResponse, cached: false, changed: true })
        }
        if (url.endsWith('/writing/attempts/attempt-1/')) {
          return json({
            ...legacyGuidedAttempt,
            tasks: [
              {
                ...legacyGuidedAttempt.tasks[0],
                response: savedResponse,
              },
            ],
          })
        }
        return json({ detail: `Unexpected request: ${url}` }, 500)
      })

    render(<WritingPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /یادگیری هدایت‌شده/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'شروع نوشتن ←' }))

    const editor = await screen.findByRole('textbox', {
      name: 'Writing Task 2 response',
    })
    expect(
      screen.queryByRole('heading', { name: 'نقشهٔ کوتاه پاسخ خودت' }),
    ).not.toBeInTheDocument()
    fireEvent.change(editor, { target: { value: lunchBreakDraft } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و خروج' }))

    expect(await screen.findByText(/همهٔ تغییرها ذخیره شد/)).toBeVisible()
    const resumeLabel = screen.getByText('ادامهٔ پیش‌نویس')
    fireEvent.click(resumeLabel.closest('button')!)

    expect(
      await screen.findByRole('textbox', {
        name: 'Writing Task 2 response',
      }),
    ).toHaveValue(lunchBreakDraft)
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/plan/')),
    ).toBe(false)
  })

  it('preserves an incomplete Guided plan across save, leave, and resume', async () => {
    const planningQuestion = {
      id: 'plan-question-lunch-break',
      kind: 'main_idea',
      title_fa: 'ایدهٔ اصلی',
      hint_fa: 'قوی‌ترین دلیل را بنویس.',
      sequence: 1,
      required: true,
    }
    const partialPlan = 'Public health is the strongest supporting reason.'
    const emptyPlan = {
      status: 'draft',
      revision_number: 0,
      entries: [],
      updated_at: new Date().toISOString(),
      completed_at: null,
    }
    const guidedAttempt = {
      ...attempt(),
      experience_mode: 'guided',
      experience: {
        title: 'Guided learning',
        timer_enabled: false,
        planning_enabled: true,
        post_submission_feedback_enabled: true,
        rewrite_enabled: true,
        version_number: 1,
      },
      tasks: [
        {
          ...attempt().tasks[0],
          prompt: {
            ...prompt,
            planning_questions: [planningQuestion],
          },
          plan: emptyPlan,
        },
      ],
    }
    const savedPlan = {
      ...emptyPlan,
      revision_number: 1,
      entries: [
        {
          question_id: planningQuestion.id,
          text_content: partialPlan,
          updated_at: new Date().toISOString(),
        },
      ],
    }
    let attemptListCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.endsWith('/writing/prompts/')) return json([promptSummary])
      if (url.endsWith('/writing/tests/')) return json([])
      if (url.endsWith('/writing/progress/')) return json({ skills: [] })
      if (url.endsWith('/writing/attempts/')) {
        attemptListCalls += 1
        return json(
          attemptListCalls === 1
            ? []
            : [
                {
                  id: 'attempt-1',
                  mode: 'single_task',
                  experience_mode: 'guided',
                  status: 'in_progress',
                  title: prompt.title,
                  task_type: prompt.task_type,
                  word_count: 0,
                  estimated_band_score: null,
                  started_at: guidedAttempt.started_at,
                  last_activity_at: new Date().toISOString(),
                  submitted_at: null,
                },
              ],
        )
      }
      if (url.endsWith('/writing/prompts/demo/attempts/')) {
        return json(guidedAttempt, 201)
      }
      if (url.endsWith('/tasks/task-1/plan/')) {
        const body = JSON.parse(String(init?.body)) as {
          entries: Array<{ question_id: string; text: string }>
          mark_complete: boolean
        }
        expect(body.mark_complete).toBe(false)
        expect(body.entries).toEqual([
          { question_id: planningQuestion.id, text: partialPlan },
        ])
        return json({ plan: savedPlan, cached: false })
      }
      if (url.endsWith('/writing/attempts/attempt-1/')) {
        return json({
          ...guidedAttempt,
          tasks: [{ ...guidedAttempt.tasks[0], plan: savedPlan }],
        })
      }
      return json({ detail: `Unexpected request: ${url}` }, 500)
    })

    render(<WritingPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /یادگیری هدایت‌شده/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'شروع نوشتن ←' }))
    const planField = await screen.findByPlaceholderText(
      'تصمیم خودت را کوتاه و روشن بنویس…',
    )
    fireEvent.change(planField, { target: { value: partialPlan } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و خروج' }))

    expect(await screen.findByText(/همهٔ تغییرها ذخیره شد/)).toBeVisible()
    fireEvent.click(screen.getByText('ادامهٔ پیش‌نویس').closest('button')!)

    expect(
      await screen.findByPlaceholderText('تصمیم خودت را کوتاه و روشن بنویس…'),
    ).toHaveValue(partialPlan)
  })
})
