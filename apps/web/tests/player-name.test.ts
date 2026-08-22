import { describe, expect, it } from 'vitest'

import {
  PLAYER_NAME_KEY,
  loadPlayerName,
  savePlayerName,
} from '../src/player-name'

function createStorage(initialValue: string | null = null) {
  const values = new Map<string, string>()
  if (initialValue !== null) values.set(PLAYER_NAME_KEY, initialValue)

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('player name preference', () => {
  it('uses the trimmed local preference as the next dialog default', () => {
    expect(loadPlayerName(createStorage('  Guinevere  '))).toBe('Guinevere')
    expect(loadPlayerName(createStorage())).toBeNull()
  })

  it('stores and loads the last successfully used trimmed name', () => {
    const storage = createStorage()

    expect(savePlayerName('  Arthur  ', storage)).toBe('Arthur')
    expect(loadPlayerName(storage)).toBe('Arthur')
  })
})
