'use client'

import type { CSSProperties, ReactNode } from 'react'

import { CheckIcon, MapIcon } from '@/app/listening/listening-icons'
import { ListeningVisual } from '@/app/listening/listening-media'
import type {
  ListeningContentBlock,
  ListeningContentSegment,
  ListeningEvaluationResult,
  ListeningQuestionGroup,
  ListeningQuestionOption,
  ListeningResponseSlot,
} from '@/lib/listening-api'

type Props = {
  group: ListeningQuestionGroup
  answers: Record<string, string>
  selectedOptions: string[]
  activeQuestionNumber: number | null
  disabled: boolean
  results: Map<string, ListeningEvaluationResult>
  onAnswer: (slotId: string, value: string) => void
  onToggleOption: (value: string) => void
  onCommit: () => void
}

function optionLabel(group: ListeningQuestionGroup, value: unknown) {
  const raw = String(value ?? '')
  const option = group.options.find((candidate) => candidate.value === raw)
  return option ? `${option.value} — ${option.label}` : raw
}

function correctAnswer(
  group: ListeningQuestionGroup,
  result: ListeningEvaluationResult,
) {
  const values = Array.isArray(result.correct_value)
    ? result.correct_value
    : [result.correct_value]
  return values.map((value) => optionLabel(group, value)).join(' / ')
}

function AnswerStatus({
  group,
  result,
}: {
  group: ListeningQuestionGroup
  result?: ListeningEvaluationResult
}) {
  if (!result) return null
  const correct = result.result_code === 'correct'
  return (
    <div
      role="status"
      className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-6 ${
        correct
          ? 'border-[#8dbeb2] bg-[#e8f3ef] text-[#104b46]'
          : 'border-[#ddb7a6] bg-[#fff1ea] text-[#78351f]'
      }`}
    >
      <span className="font-black">
        {correct
          ? 'پاسخ درست است.'
          : result.result_code === 'unanswered'
            ? 'بدون پاسخ.'
            : 'پاسخ نیاز به اصلاح دارد.'}
      </span>
      {!correct && (
        <span className="mr-2">
          پاسخ پذیرفته‌شده: <b dir="ltr">{correctAnswer(group, result)}</b>
        </span>
      )}
    </div>
  )
}

function slotOptions(
  group: ListeningQuestionGroup,
  slot: ListeningResponseSlot,
) {
  return group.options.filter(
    (option) =>
      option.response_slot_id === null || option.response_slot_id === slot.id,
  )
}

function segmentText(segment: ListeningContentSegment) {
  if (segment.emphasis === 'strong') {
    return <strong className="font-black">{segment.text_content}</strong>
  }
  if (segment.emphasis === 'emphasis') {
    return <em>{segment.text_content}</em>
  }
  return segment.text_content
}

function StructuredCompletionGroup(props: Props) {
  const {
    group,
    answers,
    activeQuestionNumber,
    disabled,
    results,
    onAnswer,
    onCommit,
  } = props
  const slotById = new Map(group.response_slots.map((slot) => [slot.id, slot]))
  const blockById = new Map(
    group.content_blocks.map((block) => [block.id, block]),
  )
  const childrenByParent = new Map<string | null, ListeningContentBlock[]>()

  for (const block of group.content_blocks) {
    const siblings = childrenByParent.get(block.parent_id) ?? []
    siblings.push(block)
    childrenByParent.set(block.parent_id, siblings)
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => left.sequence - right.sequence)
  }

  function renderSegments(block: ListeningContentBlock) {
    return [...block.segments]
      .sort((left, right) => left.sequence - right.sequence)
      .map((segment) => {
        if (segment.kind === 'text') {
          return <span key={segment.id}>{segmentText(segment)}</span>
        }

        const slot = segment.response_slot_id
          ? slotById.get(segment.response_slot_id)
          : undefined
        if (!slot) return null
        const active = activeQuestionNumber === slot.display_number
        return (
          <span
            key={segment.id}
            id={`question-${slot.display_number}`}
            data-listening-question={slot.display_number}
            data-question-active={active || undefined}
            tabIndex={-1}
            className="mx-1 inline-flex scroll-mt-40 items-center gap-1.5 rounded-lg px-1 py-0.5 align-middle transition-[background-color,box-shadow] data-[question-active=true]:bg-[#fff1ea] data-[question-active=true]:ring-4 data-[question-active=true]:ring-[#e57d55]/20"
          >
            <span className="inline-grid size-7 shrink-0 place-items-center rounded-full bg-[#18302d] font-mono text-xs font-black text-white">
              {slot.display_number}
            </span>
            <input
              value={answers[slot.id] ?? ''}
              onChange={(event) => onAnswer(slot.id, event.target.value)}
              onBlur={onCommit}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              placeholder={slot.placeholder}
              aria-label={`Question ${slot.display_number}: ${slot.prompt}`}
              className="h-10 w-24 max-w-[calc(100vw-8rem)] border-x-0 border-t-0 border-b-2 border-[#18302d]/35 bg-[#fffdf8] px-2 text-base font-bold text-[#18302d] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-[#8a9693] focus:border-[#155e57] focus:bg-white focus:ring-3 focus:ring-[#155e57]/15 disabled:cursor-not-allowed disabled:bg-[#ece8dc] sm:w-44"
            />
          </span>
        )
      })
  }

  function renderStatuses(block: ListeningContentBlock) {
    const seen = new Set<string>()
    return block.segments.flatMap((segment) => {
      const slotId = segment.response_slot_id
      if (!slotId || seen.has(slotId)) return []
      seen.add(slotId)
      const result = results.get(slotId)
      return result ? (
        <AnswerStatus key={slotId} group={group} result={result} />
      ) : (
        []
      )
    })
  }

  function renderBlock(block: ListeningContentBlock): ReactNode {
    const children = (childrenByParent.get(block.id) ?? []).map(renderBlock)
    const segments = renderSegments(block)
    const statuses = renderStatuses(block)
    const spacingAfter = block.metadata.spacing_after === 'section'
    const line = (
      <div className="text-[15px] leading-10 text-[#263f3b] sm:text-base">
        {segments}
      </div>
    )

    if (block.kind === 'panel') {
      return (
        <div
          key={block.id}
          className="rounded-2xl border-2 border-[#18302d]/18 bg-[#fffdf8] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-7"
        >
          {block.metadata.variant === 'document' && (
            <h3
              id={`group-${group.id}`}
              className="mb-5 text-center text-xl font-black tracking-[-0.02em] text-[#18302d] sm:text-2xl"
            >
              {group.title}
            </h3>
          )}
          <div className="grid gap-1">{children}</div>
        </div>
      )
    }
    if (block.kind === 'heading') {
      return (
        <h4
          key={block.id}
          className="mt-4 mb-1 text-base font-black text-[#18302d] first:mt-0 sm:text-lg"
        >
          {segments}
        </h4>
      )
    }
    if (block.kind === 'section') {
      const columns = Math.max(1, Number(block.metadata.columns ?? 1))
      const columnStyle = {
        '--listening-section-columns': `repeat(${columns}, minmax(0, 1fr))`,
      } as CSSProperties
      return (
        <section
          key={block.id}
          aria-label={
            typeof block.metadata.label === 'string'
              ? block.metadata.label
              : undefined
          }
          style={columnStyle}
          className={`min-w-0 ${
            block.metadata.layout === 'columns'
              ? 'grid gap-x-8 gap-y-3 sm:[grid-template-columns:var(--listening-section-columns)]'
              : 'grid gap-1'
          } ${spacingAfter ? 'mb-4' : ''}`}
        >
          {segments.length > 0 && line}
          {statuses}
          {children}
        </section>
      )
    }
    if (block.kind === 'list_item') {
      const indented = Number(block.metadata.indent ?? 0) > 0
      return (
        <div
          key={block.id}
          className={`grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2 ${
            indented ? 'ml-5 sm:ml-9' : ''
          } ${spacingAfter ? 'mb-4' : ''}`}
        >
          <span aria-hidden="true" className="pt-2 text-center font-black">
            {block.metadata.marker === 'dash' ? '–' : '•'}
          </span>
          <div>
            {line}
            {statuses}
            {children}
          </div>
        </div>
      )
    }
    if (block.kind === 'table') {
      return (
        <div
          key={block.id}
          role="table"
          aria-label={
            typeof block.metadata.label === 'string'
              ? block.metadata.label
              : undefined
          }
          className="my-3 overflow-hidden rounded-xl border border-[#18302d]/15 bg-white"
        >
          {children}
        </div>
      )
    }
    if (block.kind === 'table_row') {
      const parent = block.parent_id
        ? blockById.get(block.parent_id)
        : undefined
      const columns = Math.max(
        1,
        Number(block.metadata.columns ?? parent?.metadata.columns ?? 2),
      )
      const rowStyle = {
        '--listening-table-columns': `repeat(${columns}, minmax(0, 1fr))`,
      } as CSSProperties
      const header = block.metadata.role === 'header'
      return (
        <div
          key={block.id}
          role="row"
          style={rowStyle}
          className={`grid gap-3 border-t border-[#18302d]/10 p-3 first:border-t-0 sm:[grid-template-columns:var(--listening-table-columns)] ${
            header
              ? 'bg-[#18302d] font-black text-white'
              : 'bg-white text-[#263f3b]'
          }`}
        >
          {segments.length > 0 && <div role="cell">{line}</div>}
          {children}
          {statuses}
        </div>
      )
    }
    if (block.kind === 'table_cell') {
      return (
        <div key={block.id} role="cell" className="min-w-0">
          {line}
          {statuses}
          {children}
        </div>
      )
    }
    if (block.kind === 'option_bank') {
      return (
        <div
          key={block.id}
          className="my-4 rounded-xl border border-[#18302d]/20 bg-white p-4"
        >
          {line}
          {children}
        </div>
      )
    }
    if (block.kind === 'flow_step') {
      const connector = block.metadata.connector !== false
      return (
        <div
          key={block.id}
          className={`relative mb-5 rounded-xl border border-[#155e57]/25 bg-[#eef7f3] p-4 text-center last:mb-0 ${
            connector
              ? 'after:absolute after:top-full after:left-1/2 after:h-5 after:w-px after:bg-[#155e57]/35 after:content-[""]'
              : ''
          }`}
        >
          {line}
          {statuses}
          {children}
          {connector && (
            <span
              aria-hidden="true"
              className="absolute top-[calc(100%+0.75rem)] left-1/2 size-2 -translate-x-1/2 rotate-45 border-r border-b border-[#155e57]/55"
            />
          )}
        </div>
      )
    }
    if (block.kind === 'field') {
      return (
        <div
          key={block.id}
          className="rounded-xl border border-[#18302d]/10 bg-white px-3 py-2"
        >
          {line}
          {statuses}
          {children}
        </div>
      )
    }
    if (block.kind === 'caption') {
      return (
        <div key={block.id} className="text-xs leading-6 text-[#65716e] italic">
          {segments}
          {children}
        </div>
      )
    }
    if (block.kind === 'divider') {
      return <hr key={block.id} className="my-4 border-[#18302d]/12" />
    }
    return (
      <div key={block.id} className={spacingAfter ? 'mb-4' : undefined}>
        {line}
        {statuses}
        {children}
      </div>
    )
  }

  return <div>{(childrenByParent.get(null) ?? []).map(renderBlock)}</div>
}

function CompletionGroup({
  group,
  answers,
  activeQuestionNumber,
  disabled,
  results,
  onAnswer,
  onCommit,
}: Props) {
  const flowchart = group.presentation === 'flowchart'
  const table = group.presentation === 'table'
  const notes = group.presentation === 'notes'
  return (
    <div
      className={
        table
          ? 'overflow-hidden rounded-2xl border border-[#18302d]/15'
          : flowchart
            ? 'grid gap-3'
            : 'grid gap-3'
      }
    >
      {table && (
        <div className="grid grid-cols-[1fr_minmax(9rem,0.55fr)] bg-[#18302d] px-4 py-3 text-xs font-bold text-white">
          <span>Detail</span>
          <span>Answer</span>
        </div>
      )}
      {group.response_slots.map((slot, index) => {
        const result = results.get(slot.id)
        return (
          <div
            key={slot.id}
            id={`question-${slot.display_number}`}
            data-listening-question={slot.display_number}
            data-question-active={
              activeQuestionNumber === slot.display_number || undefined
            }
            tabIndex={-1}
            className={`scroll-mt-40 transition-[border-color,box-shadow] data-[question-active=true]:border-[#e57d55]/70 data-[question-active=true]:ring-4 data-[question-active=true]:ring-[#e57d55]/20 ${
              table
                ? 'grid gap-3 border-t border-[#18302d]/10 bg-white p-4 sm:grid-cols-[1fr_minmax(9rem,0.55fr)] sm:items-start'
                : flowchart
                  ? 'relative rounded-2xl border border-[#155e57]/20 bg-[#eef7f3] p-4 before:absolute before:-bottom-4 before:right-8 before:h-4 before:w-px before:bg-[#155e57]/30 last:before:hidden'
                  : notes
                    ? 'relative rounded-xl bg-[#f8f6ef] py-4 pr-11 pl-4 before:absolute before:top-6 before:right-5 before:size-2 before:rounded-full before:bg-[#a14e32]'
                    : 'grid gap-3 rounded-2xl border border-[#18302d]/10 bg-[#fffdf8] p-4 sm:grid-cols-[1fr_minmax(10rem,0.6fr)] sm:items-start'
            }`}
          >
            <label
              htmlFor={`answer-${slot.id}`}
              className="text-sm leading-7 font-bold text-[#263f3b]"
            >
              <span className="mr-3 inline-grid size-7 shrink-0 place-items-center rounded-full bg-[#18302d] font-mono text-xs text-white">
                {slot.display_number}
              </span>
              {slot.prompt}
            </label>
            <div className={flowchart || notes ? 'mt-3' : undefined}>
              <input
                id={`answer-${slot.id}`}
                value={answers[slot.id] ?? ''}
                onChange={(event) => onAnswer(slot.id, event.target.value)}
                onBlur={onCommit}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                placeholder={slot.placeholder}
                className="min-h-12 w-full rounded-xl border border-[#18302d]/20 bg-white px-4 text-base text-[#18302d] outline-none transition placeholder:text-[#8a9693] focus:border-[#155e57] focus:ring-3 focus:ring-[#155e57]/15 disabled:cursor-not-allowed disabled:bg-[#ece8dc]"
              />
              <AnswerStatus group={group} result={result} />
            </div>
            {flowchart && index < group.response_slots.length - 1 && (
              <span className="sr-only">سپس</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SingleChoiceGroup({
  group,
  answers,
  activeQuestionNumber,
  disabled,
  results,
  onAnswer,
}: Props) {
  return (
    <div className="grid gap-5">
      {group.response_slots.map((slot) => (
        <fieldset
          key={slot.id}
          id={`question-${slot.display_number}`}
          data-listening-question={slot.display_number}
          data-question-active={
            activeQuestionNumber === slot.display_number || undefined
          }
          tabIndex={-1}
          className="scroll-mt-40 rounded-2xl border border-[#18302d]/10 bg-[#fffdf8] p-4 transition-[border-color,box-shadow] data-[question-active=true]:border-[#e57d55]/70 data-[question-active=true]:ring-4 data-[question-active=true]:ring-[#e57d55]/20 sm:p-5"
        >
          <legend className="px-1 text-sm leading-7 font-black text-[#263f3b]">
            <span className="mr-3 inline-grid size-7 shrink-0 place-items-center rounded-full bg-[#18302d] font-mono text-xs text-white">
              {slot.display_number}
            </span>
            {slot.prompt}
          </legend>
          <div className="mt-3 grid gap-2">
            {slotOptions(group, slot).map((option) => (
              <ChoiceLabel
                key={option.id}
                option={option}
                type="radio"
                name={`slot-${slot.id}`}
                checked={answers[slot.id] === option.value}
                disabled={disabled}
                onChange={() => onAnswer(slot.id, option.value)}
              />
            ))}
          </div>
          <AnswerStatus group={group} result={results.get(slot.id)} />
        </fieldset>
      ))}
    </div>
  )
}

function ChoiceLabel({
  option,
  type,
  name,
  checked,
  disabled,
  onChange,
}: {
  option: ListeningQuestionOption
  type: 'radio' | 'checkbox'
  name: string
  checked: boolean
  disabled: boolean
  onChange: () => void
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm leading-6 transition ${
        checked
          ? 'border-[#155e57] bg-[#e8f3ef] text-[#104b46]'
          : 'border-[#18302d]/12 bg-white hover:border-[#155e57]/45'
      } ${disabled ? 'cursor-not-allowed opacity-75' : ''}`}
    >
      <input
        type={type}
        name={name}
        value={option.value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-5 shrink-0 accent-[#155e57]"
      />
      <b className="font-mono text-xs">{option.value}</b>
      <span>{option.label}</span>
    </label>
  )
}

function MultiSelectGroup(props: Props) {
  const { group, selectedOptions, disabled, results, onToggleOption } = props
  const maximum = Number(group.response_rules.maximum_selections ?? 2)
  const groupResults = group.response_slots
    .map((slot) => results.get(slot.id))
    .filter((result): result is ListeningEvaluationResult => Boolean(result))
  const firstResult = groupResults[0]
  const aggregateResult = firstResult
    ? {
        ...firstResult,
        result_code: groupResults.every(
          (result) => result.result_code === 'correct',
        )
          ? ('correct' as const)
          : groupResults.every((result) => result.result_code === 'unanswered')
            ? ('unanswered' as const)
            : ('incorrect' as const),
      }
    : undefined
  return (
    <fieldset
      id={`question-${group.response_slots[0]?.display_number}`}
      data-listening-question={group.response_slots
        .map((slot) => slot.display_number)
        .join(' ')}
      data-question-active={
        group.response_slots.some(
          (slot) => slot.display_number === props.activeQuestionNumber,
        ) || undefined
      }
      tabIndex={-1}
      className="scroll-mt-40 rounded-2xl border border-[#18302d]/10 bg-[#fffdf8] p-4 transition-[border-color,box-shadow] data-[question-active=true]:border-[#e57d55]/70 data-[question-active=true]:ring-4 data-[question-active=true]:ring-[#e57d55]/20 sm:p-5"
    >
      <legend className="px-1 text-sm font-black text-[#263f3b]">
        Questions{' '}
        {group.response_slots.map((slot) => slot.display_number).join(' & ')}
      </legend>
      <p className="mt-2 text-xs leading-6 text-[#65716e]">
        {selectedOptions.length} از {maximum} گزینه انتخاب شده
      </p>
      <div className="mt-3 grid gap-2">
        {group.options.map((option) => {
          const checked = selectedOptions.includes(option.value)
          return (
            <ChoiceLabel
              key={option.id}
              option={option}
              type="checkbox"
              name={`group-${group.id}`}
              checked={checked}
              disabled={
                disabled || (!checked && selectedOptions.length >= maximum)
              }
              onChange={() => onToggleOption(option.value)}
            />
          )
        })}
      </div>
      <AnswerStatus group={group} result={aggregateResult} />
    </fieldset>
  )
}

function OptionBank({ group }: { group: ListeningQuestionGroup }) {
  return (
    <section
      aria-label={`${group.title} answer choices`}
      className="rounded-2xl border-2 border-[#18302d]/16 bg-[#f8f6ef] p-4 sm:p-5"
    >
      <h4 className="text-center text-sm font-black text-[#18302d]">
        Answer choices
      </h4>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {group.options.map((option) => (
          <div
            key={option.id}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2 text-sm leading-6"
          >
            <b className="font-mono text-[#155e57]">{option.value}</b>
            <span>{option.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function SourcePageReference({ group }: { group: ListeningQuestionGroup }) {
  const visuals =
    group.visual_assets && group.visual_assets.length > 0
      ? group.visual_assets
      : group.visual_asset
        ? [group.visual_asset]
        : []
  if (visuals.length === 0) return null

  const pages = (
    <div className="grid gap-4">
      {visuals.map((asset) => (
        <ListeningVisual key={asset.id} asset={asset} />
      ))}
    </div>
  )
  if (group.interaction_type === 'spatial_labeling') {
    return (
      <section aria-label="Original source plan" className="mb-5 grid gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#155e57]">
          <MapIcon className="size-5" />
          نقشه یا پلان اصلی را با دقت بررسی کن
        </div>
        {pages}
      </section>
    )
  }
  return (
    <details
      open
      className="group/source mb-5 rounded-2xl border border-[#18302d]/12 bg-[#f8f6ef] p-3 sm:p-4"
    >
      <summary className="min-h-11 cursor-pointer list-none rounded-xl px-2 py-2 text-left text-sm font-black text-[#155e57] marker:content-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#155e57]">
        <span className="inline-flex items-center gap-2">
          <MapIcon className="size-5" />
          Original source layout
          <span
            aria-hidden="true"
            className="transition group-open/source:rotate-180"
          >
            ↓
          </span>
        </span>
      </summary>
      <div className="mt-3">{pages}</div>
    </details>
  )
}

function SelectGroup({
  group,
  answers,
  activeQuestionNumber,
  disabled,
  results,
  onAnswer,
}: Props) {
  return (
    <div className="grid gap-4">
      {group.interaction_type === 'matching' && <OptionBank group={group} />}
      {group.response_slots.map((slot) => (
        <div
          key={slot.id}
          id={`question-${slot.display_number}`}
          data-listening-question={slot.display_number}
          data-question-active={
            activeQuestionNumber === slot.display_number || undefined
          }
          tabIndex={-1}
          className="grid scroll-mt-40 gap-3 rounded-2xl border border-[#18302d]/10 bg-[#fffdf8] p-4 transition-[border-color,box-shadow] data-[question-active=true]:border-[#e57d55]/70 data-[question-active=true]:ring-4 data-[question-active=true]:ring-[#e57d55]/20 sm:grid-cols-[1fr_minmax(10rem,0.45fr)] sm:items-start"
        >
          <label
            htmlFor={`select-${slot.id}`}
            className="text-sm leading-7 font-bold"
          >
            <span className="mr-3 inline-grid size-7 shrink-0 place-items-center rounded-full bg-[#18302d] font-mono text-xs text-white">
              {slot.display_number}
            </span>
            {slot.prompt}
          </label>
          <div>
            <select
              id={`select-${slot.id}`}
              value={answers[slot.id] ?? ''}
              onChange={(event) => onAnswer(slot.id, event.target.value)}
              disabled={disabled}
              dir="ltr"
              className="min-h-12 w-full rounded-xl border border-[#18302d]/20 bg-white px-3 text-base outline-none focus:border-[#155e57] focus:ring-3 focus:ring-[#155e57]/15 disabled:cursor-not-allowed disabled:bg-[#ece8dc]"
            >
              <option value="">Select…</option>
              {slotOptions(group, slot).map((option) => (
                <option key={option.id} value={option.value}>
                  {option.value} — {option.label}
                </option>
              ))}
            </select>
            <AnswerStatus group={group} result={results.get(slot.id)} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListeningQuestionGroup(props: Props) {
  const { group } = props
  const firstQuestion = group.response_slots[0]?.display_number
  const lastQuestion = group.response_slots.at(-1)?.display_number
  const hasStructuredContent = group.content_blocks.some(
    (block) => block.kind === 'panel' || block.segments.length > 0,
  )
  const hasDocumentLayout = group.content_blocks.some(
    (block) => block.kind === 'panel' && block.metadata.variant === 'document',
  )
  return (
    <section
      aria-labelledby={`group-${group.id}`}
      className="rounded-[1.75rem] border border-[#18302d]/12 bg-white/70 p-4 shadow-[0_14px_40px_rgba(24,48,45,0.05)] sm:p-6"
    >
      <div className="mb-5 border-b border-[#18302d]/10 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {firstQuestion !== undefined && (
            <span className="rounded-full border border-[#18302d]/12 bg-[#fffdf8] px-3 py-1 font-mono text-[11px] font-black text-[#52625f]">
              Questions {firstQuestion}
              {lastQuestion !== firstQuestion ? `–${lastQuestion}` : ''}
            </span>
          )}
          <span className="rounded-full bg-[#dcebe5] px-3 py-1 text-[11px] font-black tracking-wide text-[#155e57] uppercase">
            {group.presentation === 'plain'
              ? group.interaction_type.replace('_', ' ')
              : group.presentation}
          </span>
          {props.disabled && (
            <span className="flex items-center gap-1 rounded-full bg-[#ece8dc] px-3 py-1 text-[11px] font-bold text-[#52625f]">
              <CheckIcon className="size-3.5" />
              تصحیح‌شده
            </span>
          )}
        </div>
        {!hasDocumentLayout && (
          <h3
            id={`group-${group.id}`}
            dir="ltr"
            className="mt-3 text-left text-xl font-black text-[#18302d]"
          >
            {group.title}
          </h3>
        )}
        <p
          dir="ltr"
          className="mt-2 text-left text-sm leading-7 font-medium text-[#52625f]"
        >
          {group.instructions}
        </p>
      </div>
      <SourcePageReference group={group} />
      <div dir="ltr">
        {group.interaction_type === 'completion' && hasStructuredContent ? (
          <StructuredCompletionGroup {...props} />
        ) : group.interaction_type === 'completion' ? (
          <CompletionGroup {...props} />
        ) : group.interaction_type === 'single_choice' ? (
          <SingleChoiceGroup {...props} />
        ) : group.interaction_type === 'multi_select' ? (
          <MultiSelectGroup {...props} />
        ) : (
          <SelectGroup {...props} />
        )}
      </div>
    </section>
  )
}
