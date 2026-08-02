import { describe, expect, it } from 'vitest'

import { authPathFor, safeNextPath } from '@/lib/safe-next'

describe('safeNextPath', () => {
  it('keeps local paths, queries, and hashes', () => {
    expect(safeNextPath('/reading?section=2#question-4')).toBe(
      '/reading?section=2#question-4',
    )
    expect(authPathFor('/speaking?exam=ielts')).toBe(
      '/auth?next=%2Fspeaking%3Fexam%3Dielts',
    )
  })

  it.each([
    'https://evil.example/reading',
    '//evil.example/reading',
    '/\\evil.example/reading',
    '/%5Cevil.example/reading',
    '/auth',
    '/auth/callback',
    'reading',
  ])('rejects unsafe or looping destination %s', (candidate) => {
    expect(safeNextPath(candidate)).toBe('/')
  })
})
