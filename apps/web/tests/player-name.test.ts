import { describe, expect, it } from 'vitest'

import {
  getPreferredPlayerName,
  loadPlayerName,
  savePlayerName,
} from '../src/player-name'
import type { RoomSessionStorage } from '../src/room-session'

function createStorage(initialValues: Record<string, string> = {}): RoomSessionStorage {
  const values = new Map(Object.entries(initialValues))

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, nextValue) => values.set(key, nextValue),
    removeItem: (key) => values.delete(key),
  }
}

describe('player name storage', () => {
  it('trims and stores a reusable player name', () => {
    const storage = createStorage()

    expect(savePlayerName('  Alice  ', storage)).toBe('Alice')
    expect(loadPlayerName(storage)).toBe('Alice')
  })

  it('returns the stored name before the legacy room-session fallback', () => {
    expect(getPreferredPlayerName('  Alice  ', 'Bob')).toBe('Alice')
    expect(getPreferredPlayerName(null, '  Bob  ')).toBe('Bob')
    expect(getPreferredPlayerName(null, '   ')).toBeNull()
  })

  it('rejects an empty name instead of persisting it', () => {
    const storage = createStorage()

    expect(() => savePlayerName('   ', storage)).toThrow('玩家名称不能为空')
    expect(loadPlayerName(storage)).toBeNull()
  })
})
