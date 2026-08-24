import { describe, expect, it } from 'vitest'

import {
  PLAYER_PROFILE_KEY,
  loadOrCreatePlayerProfile,
  savePlayerProfile,
} from '../src/player-profile'
import { PLAYER_NAME_KEY } from '../src/player-name'
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

describe('browser player profile', () => {
  it('creates and persists a random profile on first visit', () => {
    const { storage, values } = createStorage()

    const profile = loadOrCreatePlayerProfile(storage, () => 0)

    expect(profile).toEqual({
      avatarID: 'assassin',
      name: '银月骑士',
    })
    expect(JSON.parse(values.get(PLAYER_PROFILE_KEY)!)).toEqual(profile)
  })

  it('can generate a medieval-style name beyond the original name pool', () => {
    const { storage } = createStorage()

    expect(loadOrCreatePlayerProfile(storage, () => 0.999)).toEqual({
      avatarID: 'percival',
      name: '星辉领航者',
    })
  })

  it('migrates the previous saved name into the new profile', () => {
    const { storage } = createStorage({
      [PLAYER_NAME_KEY]: '  Guinevere  ',
    })

    expect(loadOrCreatePlayerProfile(storage, () => 0)).toEqual({
      avatarID: 'assassin',
      name: 'Guinevere',
    })
  })

  it('loads a valid saved profile without replacing it', () => {
    const saved = { avatarID: 'percival', name: '雾林旅人' }
    const { storage } = createStorage({
      [PLAYER_PROFILE_KEY]: JSON.stringify(saved),
    })

    expect(loadOrCreatePlayerProfile(storage, () => 0.9)).toEqual(saved)
  })

  it('trims and stores an explicitly saved profile', () => {
    const { storage, values } = createStorage()

    expect(savePlayerProfile({
      avatarID: 'morgana',
      name: '  Arthur  ',
    }, storage)).toEqual({
      avatarID: 'morgana',
      name: 'Arthur',
    })
    expect(JSON.parse(values.get(PLAYER_PROFILE_KEY)!)).toEqual({
      avatarID: 'morgana',
      name: 'Arthur',
    })
  })

  it('rejects invalid names and unknown avatar IDs', () => {
    const { storage } = createStorage()

    expect(() => savePlayerProfile({
      avatarID: 'assassin',
      name: '   ',
    }, storage)).toThrow('玩家名称不能为空')
    expect(() => savePlayerProfile({
      avatarID: 'unknown' as 'assassin',
      name: 'Arthur',
    }, storage)).toThrow('请选择有效头像')
  })
})
