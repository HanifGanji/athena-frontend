import { describe, expect, it } from 'vitest'

import {
  deriveSpeakingView,
  initialSpeakingState,
  speakingMachine,
  type SpeakingPhase,
} from './speaking-machine'

describe('speaking phase view', () => {
  it.each<[SpeakingPhase, string]>([
    ['creating_session', 'در حال آماده‌سازی تمرین…'],
    ['submitting', 'در حال ثبت پاسخ…'],
    ['reviewing_response', 'پاسخ ذخیره شد؛ بررسی کوتاه در حال انجام است…'],
    ['generating_next', 'پاسخ ثبت شد؛ سؤال بعدی آماده می‌شود…'],
    ['loading_examiner', 'صدا در حال آماده‌شدن است…'],
    ['loading_feedback', 'در حال آماده‌سازی بازخورد…'],
  ])('uses the canonical primary status for %s', (phase, status) => {
    const view = deriveSpeakingView(phase)
    expect(view.primaryStatus).toBe(status)
    expect(view.announcement).toBe(status)
    expect(view.examinerStatus).toBe(status)
  })

  it('keeps recorder visibility and behavior in the same derived view', () => {
    expect(deriveSpeakingView('local_review')).toMatchObject({
      recorderMode: 'review',
      showPreparedTake: true,
    })
    expect(deriveSpeakingView('submitting')).toMatchObject({
      recorderMode: 'submitting',
      showPreparedTake: true,
    })
    expect(deriveSpeakingView('generating_next')).toMatchObject({
      recorderMode: 'waiting_next',
      showPreparedTake: true,
    })
    expect(deriveSpeakingView('review_attention')).toMatchObject({
      recorderMode: 'idle',
    })
  })
})

describe('speaking history state', () => {
  it('renders landing while history is independently loading or failing', () => {
    expect(initialSpeakingState.phase).toBe('landing')
    expect(initialSpeakingState.historyStatus).toBe('loading')

    const failed = speakingMachine(initialSpeakingState, {
      type: 'history_failed',
      message: 'failed',
    })
    expect(failed).toMatchObject({
      historyError: 'failed',
      historyStatus: 'error',
      phase: 'landing',
    })
  })
})
