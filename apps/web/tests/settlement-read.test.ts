import { describe, expect, it } from 'vitest'

import { hasReadSettlement, markSettlementRead, settlementReadStorageKey } from '../src/settlement-read'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('settlement read receipts', () => {
  it('isolates encoded match IDs and later history entries', () => {
    const receipts = storage()
    const first = settlementReadStorageKey('room/a', 'teamVote:0')

    markSettlementRead(receipts, 'room/a', 'teamVote:0')

    expect(first).toContain('room%2Fa')
    expect(hasReadSettlement(receipts, 'room/a', 'teamVote:0')).toBe(true)
    expect(hasReadSettlement(receipts, 'room/a', 'teamVote:1')).toBe(false)
    expect(hasReadSettlement(receipts, 'room-b', 'teamVote:0')).toBe(false)
  })

  it('treats throwing storage as unavailable without interrupting presentation', () => {
    const unavailable = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }

    expect(hasReadSettlement(unavailable, 'room', 'quest:0')).toBe(false)
    expect(() => markSettlementRead(unavailable, 'room', 'quest:0')).not.toThrow()
  })
})
