import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SpeakingSession, SpeakingTurn } from '@/lib/speaking-api'

import { SpeakingTranscript } from './speaking-transcript'

const now = '2026-08-05T10:00:00Z'

function examinerTurn(index: number): SpeakingTurn {
  return {
    created_at: now,
    duration_difference_ms: null,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    is_hidden: false,
    item_index: index,
    kind: 'question',
    prompt_id: null,
    recording_duration_ms: null,
    review: null,
    revision: 1,
    role: 'examiner',
    sequence: index,
    stage: 'ielts_part_1',
    suggested_duration_ms: 20_000,
    transcript: `Question ${index}`,
  }
}

function speakingSession(turnCount: number): SpeakingSession {
  return {
    abandoned_at: null,
    completed_at: null,
    current_item_index: turnCount,
    current_prompt_id: null,
    current_stage: 'ielts_part_1',
    exam_type: 'ielts',
    id: '10000000-0000-4000-8000-000000000001',
    prompt_version: 'speaking-v2',
    required_response_count: 16,
    response_count: 0,
    started_at: now,
    status: 'in_progress',
    timing_summary: {
      actual_duration_ms: 0,
      difference_ms: 0,
      suggested_duration_ms: 0,
    },
    topic_labels: ['Home', 'Study', 'Friends', 'Community'],
    turns: Array.from({ length: turnCount }, (_, index) =>
      examinerTurn(index + 1),
    ),
    updated_at: now,
  }
}

describe('SpeakingTranscript', () => {
  it('autoscrolls only its desktop container and only while near the bottom', async () => {
    const { rerender } = render(
      <SpeakingTranscript autoScroll session={speakingSession(1)} />,
    )
    const region = screen.getByRole('region', { name: 'متن جلسه' })
    const container = region.querySelector<HTMLElement>('[dir="ltr"]')!
    const scrollTo = vi.fn()
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTo: { configurable: true, value: scrollTo },
      scrollTop: { configurable: true, value: 100, writable: true },
    })

    fireEvent.scroll(container)
    rerender(<SpeakingTranscript autoScroll session={speakingSession(2)} />)
    await waitFor(() => expect(scrollTo).not.toHaveBeenCalled())

    container.scrollTop = 650
    fireEvent.scroll(container)
    rerender(<SpeakingTranscript autoScroll session={speakingSession(3)} />)
    await waitFor(() => expect(scrollTo).toHaveBeenCalledOnce())
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 1_000 }),
    )
  })
})
