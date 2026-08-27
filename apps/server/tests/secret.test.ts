import { describe, expect, it } from 'vitest'

import { secretMatches } from '../src/secret'

describe('secret comparison', () => {
  it('accepts only the same non-empty opaque value', () => {
    expect(secretMatches('seat-secret', 'seat-secret')).toBe(true)
    expect(secretMatches('seat-secret', 'other-value')).toBe(false)
    expect(secretMatches('short', 'a-different-length')).toBe(false)
  })

  it.each([
    ['', ''],
    ['', 'stored'],
    ['provided', ''],
    [undefined, 'stored'],
    ['provided', undefined],
    [null, 'stored'],
    ['provided', null],
  ])('rejects missing or non-string secrets %#', (provided, stored) => {
    expect(secretMatches(provided, stored)).toBe(false)
  })

  it('does not trim opaque secrets', () => {
    expect(secretMatches(' seat-secret ', 'seat-secret')).toBe(false)
  })

  it('rejects secrets over the input budget', () => {
    const oversized = 'x'.repeat(513)
    expect(secretMatches(oversized, oversized)).toBe(false)
  })
})
