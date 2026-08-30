import { describe, expect, it } from 'vitest'

import {
  GAME_CLIENT_SETTINGS_KEY,
  loadGameClientSettings,
  saveGameClientSettings,
} from '../src/game-client-settings'
import type { RoomSessionStorage } from '../src/room-session'

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues))
  const storage: RoomSessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }

  return { storage, values }
}

describe('game client settings', () => {
  it.each([
    ['missing', undefined],
    ['malformed', '{not-json'],
    ['unsupported version', JSON.stringify({ version: 2, roleKnowledgeOpen: true })],
    ['invalid value', JSON.stringify({ version: 1, roleKnowledgeOpen: 'yes' })],
  ])('defaults to closed for %s storage', (_, storedValue) => {
    const { storage } = createStorage(
      storedValue === undefined ? {} : { [GAME_CLIENT_SETTINGS_KEY]: storedValue },
    )

    expect(loadGameClientSettings(storage)).toEqual({
      version: 1,
      roleKnowledgeOpen: false,
    })
  })

  it('persists only the versioned role-knowledge preference', () => {
    const { storage, values } = createStorage()

    expect(saveGameClientSettings({ roleKnowledgeOpen: true }, storage)).toEqual({
      version: 1,
      roleKnowledgeOpen: true,
    })
    expect(JSON.parse(values.get(GAME_CLIENT_SETTINGS_KEY)!)).toEqual({
      version: 1,
      roleKnowledgeOpen: true,
    })
  })

  it('keeps the preference usable when browser storage is inaccessible', () => {
    const storage: RoomSessionStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }

    expect(loadGameClientSettings(storage)).toEqual({
      version: 1,
      roleKnowledgeOpen: false,
    })
    expect(saveGameClientSettings({ roleKnowledgeOpen: true }, storage)).toEqual({
      version: 1,
      roleKnowledgeOpen: true,
    })
  })
})
