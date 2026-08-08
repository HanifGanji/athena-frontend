import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StaffTestPreviewCard } from '@/app/staff-test-preview-card'

describe('StaffTestPreviewCard', () => {
  it('announces failures and opens the prepared result', () => {
    const onOpen = vi.fn()
    render(
      <StaffTestPreviewCard
        moduleLabel="Speaking"
        loading={false}
        error="Preview unavailable"
        onOpen={onOpen}
      />,
    )

    expect(screen.getByText('STAFF · TEST TOOL')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Preview unavailable')
    fireEvent.click(
      screen.getByRole('button', { name: 'باز کردن نتیجهٔ آماده' }),
    )
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('disables repeat activation while the preview is loading', () => {
    render(
      <StaffTestPreviewCard
        moduleLabel="Reading"
        loading
        error={null}
        onOpen={() => undefined}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'در حال آماده‌سازی…' }),
    ).toBeDisabled()
  })
})
