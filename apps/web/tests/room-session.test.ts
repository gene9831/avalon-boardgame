import { describe, expect, it, vi } from 'vitest'

import {
  clearRoomSession,
  getAvailableSeatIDs,
  getRoomSessionInvalidationNotice,
  isRoomSessionStillValid,
  loadLastRoomSession,
  loadRoomSession,
  saveRoomSession,
  validateActiveRoomSessions,
  validateRoomSession,
  RoomSessionValidationHttpError,
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
  sessionID: 'join-session-123',
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

  it('loads a legacy room session without a join session ID', () => {
    const { sessionID: _sessionID, ...legacySession } = session
    const storage = createStorage({
      'avalon:room-session:room-123': JSON.stringify(legacySession),
    })

    expect(loadRoomSession(session.matchID, storage)).toEqual(legacySession)
  })

  it('returns unoccupied seat IDs in ascending order', () => {
    expect(getAvailableSeatIDs(5, ['0', '3'])).toEqual(['1', '2', '4'])
  })

  it('recognizes an empty current seat as an invalidated session', () => {
    expect(isRoomSessionStillValid({ players: [{ id: 2, name: undefined }] }, session)).toBe(false)
  })

  it('invalidates a stale session when a kicked seat is immediately reused', () => {
    expect(isRoomSessionStillValid({
      players: [{
        id: 2,
        name: 'Alice',
        data: { clientID: 'same-browser', sessionID: 'replacement-session' },
      }],
    }, session)).toBe(false)
  })

  it('accepts a legacy session only while the occupied seat is also legacy', () => {
    const { sessionID: _sessionID, ...legacySession } = session

    expect(isRoomSessionStillValid({
      players: [{ id: 2, name: 'Alice', data: { clientID: 'client-1' } }],
    }, legacySession)).toBe(true)
    expect(isRoomSessionStillValid({
      players: [{
        id: 2,
        name: 'Alice',
        data: { clientID: 'client-1', sessionID: 'replacement-session' },
      }],
    }, legacySession)).toBe(false)
  })

  it('validates the stored credential without exposing it in the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await validateRoomSession('http://localhost:8001', session, fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8001/rooms/avalon/room-123/players/2/session',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer credential-123' },
      },
    )
    expect(fetcher.mock.calls[0][0]).not.toContain('credential-123')
  })

  it('rejects an old credential even when replacement public data is copied', async () => {
    const copiedPublicRoom = {
      players: [{
        id: 2,
        name: 'Alice',
        data: { clientID: 'same-browser', sessionID: session.sessionID },
      }],
    }
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }))

    expect(isRoomSessionStillValid(copiedPublicRoom, session)).toBe(true)
    await expect(
      validateRoomSession('http://localhost:8001', session, fetcher),
    ).rejects.toEqual(new RoomSessionValidationHttpError(403))
    expect(getRoomSessionInvalidationNotice(new RoomSessionValidationHttpError(403)))
      .toBe('你的房间座位已被释放，已返回主页。')
  })

  it('classifies a missing room separately from an unauthorized seat', () => {
    expect(getRoomSessionInvalidationNotice(new RoomSessionValidationHttpError(404)))
      .toBe('房主已解散房间，已返回主页。')
    expect(getRoomSessionInvalidationNotice(new Error('network unavailable'))).toBeNull()
  })

  it('keeps only credential-validated sessions for active rooms', async () => {
    const finishedSession = { ...session, matchID: 'room-finished' }
    const storage = createStorage()
    saveRoomSession(session, storage)
    saveRoomSession(finishedSession, storage)
    const result = await validateActiveRoomSessions(
      [
        { matchID: session.matchID, status: 'playing' },
        { matchID: finishedSession.matchID, status: 'finished' },
      ],
      'http://localhost:8001',
      storage,
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    )

    expect(result).toEqual({
      sessions: [session],
      validationFailed: false,
    })
    expect(loadRoomSession(finishedSession.matchID, storage)).toEqual(finishedSession)
  })

  it('clears an active session rejected by credential validation', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const result = await validateActiveRoomSessions(
      [{ matchID: session.matchID, status: 'lobby' }],
      'http://localhost:8001',
      storage,
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    )

    expect(result).toEqual({ sessions: [], validationFailed: false })
    expect(loadRoomSession(session.matchID, storage)).toBeNull()
  })

  it('keeps an active session locked when credential validation is unavailable', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const result = await validateActiveRoomSessions(
      [{ matchID: session.matchID, status: 'lobby' }],
      'http://localhost:8001',
      storage,
      vi.fn().mockRejectedValue(new Error('network unavailable')),
    )

    expect(result).toEqual({
      sessions: [session],
      validationFailed: true,
    })
    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
  })
})
