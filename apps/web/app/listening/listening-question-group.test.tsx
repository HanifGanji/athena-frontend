import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ListeningQuestionGroup } from '@/app/listening/listening-question-group'
import type {
  ListeningContentBlock,
  ListeningQuestionGroup as ListeningQuestionGroupType,
} from '@/lib/listening-api'

function textSegment(id: string, text: string) {
  return {
    id,
    response_slot_id: null,
    kind: 'text' as const,
    sequence: 1,
    text_content: text,
    emphasis: 'normal' as const,
  }
}

function responseSegment(id: string, slotId: string, sequence = 2) {
  return {
    id,
    response_slot_id: slotId,
    kind: 'response' as const,
    sequence,
    text_content: '',
    emphasis: 'normal' as const,
  }
}

const blocks: ListeningContentBlock[] = [
  {
    id: 'panel',
    parent_id: null,
    response_slot_id: null,
    kind: 'panel',
    sequence: 1,
    text_content: '',
    metadata: { variant: 'document' },
    segments: [],
  },
  {
    id: 'columns',
    parent_id: 'panel',
    response_slot_id: null,
    kind: 'section',
    sequence: 2,
    text_content: '',
    metadata: { layout: 'columns', columns: 2, label: 'Two-column notes' },
    segments: [],
  },
  {
    id: 'table',
    parent_id: 'columns',
    response_slot_id: null,
    kind: 'table',
    sequence: 3,
    text_content: '',
    metadata: { columns: 3, label: 'Course timetable' },
    segments: [],
  },
  {
    id: 'row',
    parent_id: 'table',
    response_slot_id: null,
    kind: 'table_row',
    sequence: 4,
    text_content: '',
    metadata: {},
    segments: [],
  },
  {
    id: 'cell-1',
    parent_id: 'row',
    response_slot_id: 'slot-1',
    kind: 'table_cell',
    sequence: 5,
    text_content: 'Start: [1]',
    metadata: {},
    segments: [
      textSegment('cell-1-text', 'Start: '),
      responseSegment('cell-1-response', 'slot-1'),
    ],
  },
  {
    id: 'cell-2',
    parent_id: 'row',
    response_slot_id: 'slot-2',
    kind: 'table_cell',
    sequence: 6,
    text_content: 'Room: [2]',
    metadata: {},
    segments: [
      textSegment('cell-2-text', 'Room: '),
      responseSegment('cell-2-response', 'slot-2'),
    ],
  },
  {
    id: 'cell-3',
    parent_id: 'row',
    response_slot_id: null,
    kind: 'table_cell',
    sequence: 7,
    text_content: 'Bring a notebook',
    metadata: {},
    segments: [textSegment('cell-3-text', 'Bring a notebook')],
  },
  {
    id: 'flow-1',
    parent_id: 'columns',
    response_slot_id: 'slot-3',
    kind: 'flow_step',
    sequence: 8,
    text_content: 'Finally: [3]',
    metadata: { connector: false },
    segments: [
      textSegment('flow-1-text', 'Finally: '),
      responseSegment('flow-1-response', 'slot-3'),
    ],
  },
]

const group: ListeningQuestionGroupType = {
  id: 'structured-group',
  interaction_type: 'completion',
  presentation: 'table',
  title: 'Structured listening document',
  instructions: 'Complete the document.',
  sequence: 1,
  response_rules: {},
  visual_asset: null,
  options: [],
  response_slots: [
    {
      id: 'slot-1',
      display_number: 1,
      prompt: 'Start time',
      sequence: 1,
      score_weight: 1,
      placeholder: 'time',
    },
    {
      id: 'slot-2',
      display_number: 2,
      prompt: 'Room',
      sequence: 2,
      score_weight: 1,
      placeholder: 'place',
    },
    {
      id: 'slot-3',
      display_number: 3,
      prompt: 'Final action',
      sequence: 3,
      score_weight: 1,
      placeholder: 'action',
    },
  ],
  content_blocks: blocks,
}

describe('ListeningQuestionGroup structured layouts', () => {
  it('renders columns, wide tables, and flow steps as one accessible document', () => {
    render(
      <ListeningQuestionGroup
        group={group}
        answers={{}}
        selectedOptions={[]}
        activeQuestionNumber={2}
        disabled={false}
        results={new Map()}
        onAnswer={vi.fn()}
        onToggleOption={vi.fn()}
        onCommit={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Structured listening document' }),
    ).toBeVisible()
    expect(
      screen.getByRole('table', { name: 'Course timetable' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Two-column notes' }),
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: /Start time/ })).toBeVisible()
    const roomInput = screen.getByRole('textbox', { name: /Room/ })
    expect(roomInput).toBeVisible()
    expect(screen.getByRole('textbox', { name: /Final action/ })).toBeVisible()
    expect(screen.getByText('Bring a notebook')).toBeVisible()
    expect(roomInput.closest('[data-question-active="true"]')).not.toBeNull()
  })

  it('shows ordered source pages in an expandable visual reference', () => {
    render(
      <ListeningQuestionGroup
        group={{
          ...group,
          visual_assets: [
            {
              id: 'source-1',
              title: 'Source page 1',
              alt_text: 'First original source page.',
              mime_type: 'image/jpeg',
              width: 800,
              height: 1200,
              url: '/listening/visuals/source-1/',
            },
            {
              id: 'source-2',
              title: 'Source page 2',
              alt_text: 'Second original source page.',
              mime_type: 'image/jpeg',
              width: 800,
              height: 1200,
              url: '/listening/visuals/source-2/',
            },
          ],
        }}
        answers={{}}
        selectedOptions={[]}
        activeQuestionNumber={null}
        disabled={false}
        results={new Map()}
        onAnswer={vi.fn()}
        onToggleOption={vi.fn()}
        onCommit={vi.fn()}
      />,
    )

    expect(screen.getByText('Original source layout')).toBeVisible()
    expect(screen.getByText('Source page 1')).toBeVisible()
    expect(screen.getByText('Source page 2')).toBeVisible()
    expect(
      screen.getByText('Original source layout').closest('details'),
    ).toHaveAttribute('open')
  })
})
