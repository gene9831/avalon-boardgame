import { describe, expect, it } from 'vitest'

import {
  loadPreferredPlayerCount,
  savePreferredPlayerCount,
} from '../src/create-game-preference'
import type { RoomSessionStorage } from '../src/room-session'

function createStorage(value: string | null = null): RoomSessionStorage {
  const values = new Map<string, string>()
  if (value !== null) values.set('avalon:create-player-count', value)
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, nextValue) => values.set(key, nextValue),
    removeItem: (key) => values.delete(key),
  }
}

describe('create game preference', () => {
  it('defaults to five players and restores only supported counts', () => {
    expect(loadPreferredPlayerCount(createStorage())).toBe(5)
    expect(loadPreferredPlayerCount(createStorage('8'))).toBe(8)
    expect(loadPreferredPlayerCount(createStorage('11'))).toBe(5)
  })

  it('persists a supported player count', () => {
    const storage = createStorage()

    expect(savePreferredPlayerCount(10, storage)).toBe(10)
    expect(loadPreferredPlayerCount(storage)).toBe(10)
  })
})
