import { describe, expect, it } from 'vitest'

import {
  clearRoomSession,
  getAvailableSeatIDs,
  isRoomSessionStillValid,
  loadLastRoomSession,
  loadRoomSession,
  saveRoomSession,
  type RoomSessionStorage,
} from '../src/room-session'

function createStorage(initialValues: Record<string, string> = {}): RoomSessionStorage {
  const values = new Map(Object.entries(initialValues))

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, nextValue) => values.set(key, nextValue),
    removeItem: (key) => values.delete(key),
  }
}

const session = {
  matchID: 'room-123',
  playerID: '2',
  credentials: 'credential-123',
  playerName: 'Alice',
}

describe('room session storage', () => {
  it('round-trips a seat-bound reconnect session', () => {
    const storage = createStorage()

    saveRoomSession(session, storage)

    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
    expect(loadLastRoomSession(storage)).toEqual(session)
  })

  it('keeps reconnect sessions isolated by room', () => {
    const otherSession = { ...session, matchID: 'room-456', playerID: '4' }
    const storage = createStorage()

    saveRoomSession(session, storage)
    saveRoomSession(otherSession, storage)

    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
    expect(loadRoomSession(otherSession.matchID, storage)).toEqual(otherSession)
    expect(loadLastRoomSession(storage)).toEqual(otherSession)
  })

  it('rejects malformed local data', () => {
    const storage = createStorage({
      'avalon:room-session:room-123': JSON.stringify({ matchID: 'room-123' }),
    })

    expect(loadRoomSession('room-123', storage)).toBeNull()
  })

  it('clears only the selected room session', () => {
    const otherSession = { ...session, matchID: 'room-456', playerID: '4' }
    const storage = createStorage()
    saveRoomSession(session, storage)
    saveRoomSession(otherSession, storage)

    clearRoomSession(session.matchID, storage)

    expect(loadRoomSession(session.matchID, storage)).toBeNull()
    expect(loadRoomSession(otherSession.matchID, storage)).toEqual(otherSession)
  })

  it('can read the previous single-session format for the matching room', () => {
    const storage = createStorage({
      'avalon:room-session': JSON.stringify(session),
    })

    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
    expect(loadRoomSession('room-456', storage)).toBeNull()
  })

  it('returns unoccupied seat IDs in ascending order', () => {
    expect(getAvailableSeatIDs(5, ['0', '3'])).toEqual(['1', '2', '4'])
  })

  it('recognizes an empty current seat as an invalidated session', () => {
    expect(isRoomSessionStillValid({ players: [{ id: 0, name: undefined }] }, '0')).toBe(false)
  })
})
