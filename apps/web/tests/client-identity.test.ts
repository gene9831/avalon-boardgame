import { describe, expect, it } from 'vitest'

import {
  CLIENT_ID_KEY,
  createClientID,
  getClientID,
} from '../src/client-identity'
import type { RoomSessionStorage } from '../src/room-session'

function createStorage(initialValue?: string): RoomSessionStorage {
  let value = initialValue

  return {
    getItem: () => value ?? null,
    setItem: (_key, nextValue) => {
      value = nextValue
    },
    removeItem: () => {
      value = undefined
    },
  }
}

describe('client identity storage', () => {
  it('creates and reuses one identity for a browser profile', () => {
    const storage = createStorage()

    expect(getClientID(storage, () => 'client-1')).toBe('client-1')
    expect(getClientID(storage, () => 'client-2')).toBe('client-1')
  })

  it('ignores an empty stored identity', () => {
    const storage = createStorage('')

    expect(getClientID(storage, () => 'client-1')).toBe('client-1')
    expect(storage.getItem(CLIENT_ID_KEY)).toBe('client-1')
  })

  it('uses getRandomValues when randomUUID is unavailable', () => {
    const sourceBytes = Uint8Array.from([
      0x00, 0x11, 0x22, 0x33,
      0x44, 0x55, 0x66, 0x77,
      0x88, 0x99, 0xaa, 0xbb,
      0xcc, 0xdd, 0xee, 0xff,
    ])

    expect(createClientID({
      getRandomValues: (target) => {
        target.set(sourceBytes)
        return target
      },
    })).toBe('00112233-4455-4677-8899-aabbccddeeff')
  })
})
