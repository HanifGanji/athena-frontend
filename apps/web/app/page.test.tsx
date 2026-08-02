import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import HomePage from '@/app/page'

describe('HomePage', () => {
  it('links every IELTS module from the main page', () => {
    render(<HomePage />)

    expect(screen.getByRole('heading', { name: /انگلیسی را/ })).toBeVisible()
    expect(screen.getByRole('link', { name: /درک مطلب/ })).toHaveAttribute(
      'href',
      '/reading',
    )
    expect(screen.getByRole('link', { name: /نوشتن/ })).toHaveAttribute(
      'href',
      '/writing',
    )
    expect(screen.getByRole('link', { name: /شنیداری/ })).toHaveAttribute(
      'href',
      '/listening',
    )
    expect(screen.getByRole('link', { name: /مکالمه/ })).toHaveAttribute(
      'href',
      '/speaking',
    )
    expect(screen.getByText('02 ACTIVE · 02 NEXT')).toBeVisible()
    expect(screen.getByText('ورود به Speaking')).toBeVisible()
  })
})
