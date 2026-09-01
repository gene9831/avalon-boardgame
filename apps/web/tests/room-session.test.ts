import { describe, expect, it, vi } from 'vitest'

import {
  clearRoomSession,
  clearRoomSessionIfCurrent,
  beginSeatTransition,
  completeSeatTransition,
  getAvailableSeatIDs,
  getRoomSessionInvalidationNotice,
  isRoomSessionStillValid,
  loadLastRoomSession,
  loadRoomSession,
  loadSeatTransition,
  markSeatTransitionUncertain,
  renewSeatTransitionLease,
  recoverSeatTransition,
  saveRoomSession,
  validateActiveRoomSessions,
  validateRoomSession,
  RoomSessionValidationHttpError,
  SEAT_TRANSITION_LEASE_MS,
  type SeatTransitionRecoveryActions,
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
  avatarID: 'merlin' as const,
  matchID: 'room-123',
  playerID: '2',
  credentials: 'credential-123',
  playerName: 'Alice',
  sessionID: 'join-session-123',
}

function recoveryActions(
  overrides: Partial<SeatTransitionRecoveryActions> = {},
): SeatTransitionRecoveryActions {
  return {
    isDefinitiveRejection: () => false,
    replay: async (_matchID, _sourcePlayerID, credentials, targetPlayerID) => ({
      matchID: session.matchID,
      playerID: targetPlayerID,
      playerCredentials: credentials,
    }),
    validate: async () => false,
    ...overrides,
  }
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

  it('does not let a stale tab clear a migrated session', () => {
    const storage = createStorage()
    const targetSession = { ...session, playerID: '4' }

    saveRoomSession(targetSession, storage)
    clearRoomSessionIfCurrent(session, storage)

    expect(loadRoomSession(session.matchID, storage)).toEqual(targetSession)
  })

  it('saves the target session before completing a seat transition', () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    beginSeatTransition(session, '4', storage, 42)

    const transition = loadSeatTransition(session.matchID, storage)!
    completeSeatTransition(session, transition, {
      matchID: session.matchID,
      playerID: '4',
      playerCredentials: 'credential-456',
    }, storage)

    expect(loadRoomSession(session.matchID, storage)).toEqual({
      ...session,
      playerID: '4',
      credentials: 'credential-456',
    })
    expect(loadSeatTransition(session.matchID, storage)).toBeNull()
  })

  it('replays the exact transition before a stale source probe can settle recovery', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const transition = beginSeatTransition(session, '4', storage, 42)
    markSeatTransitionUncertain(transition, storage)
    const events: string[] = []
    const validate = vi.fn(async () => {
      events.push('validate-source')
      return true
    })
    const replay = vi.fn(async (
      matchID: string,
      sourcePlayerID: string,
      credentials: string,
      targetPlayerID: string,
    ) => {
      events.push('replay-commits-target')
      return { matchID, playerID: targetPlayerID, playerCredentials: credentials }
    })

    await expect(recoverSeatTransition(
      transition,
      recoveryActions({ replay, validate }),
      storage,
      43,
    )).resolves.toEqual({
      status: 'target',
      playerID: '4',
    })
    expect(events).toEqual(['replay-commits-target'])
    expect(replay).toHaveBeenCalledWith(
      session.matchID,
      session.playerID,
      session.credentials,
      '4',
    )
    expect(validate).not.toHaveBeenCalled()
    expect(loadRoomSession(session.matchID, storage)).toEqual({ ...session, playerID: '4' })
    expect(loadSeatTransition(session.matchID, storage)).toBeNull()
  })

  it('retains the source after a definitive occupied-target replay rejection', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const transition = beginSeatTransition(session, '4', storage, 42)
    markSeatTransitionUncertain(transition, storage)
    const rejection = new Error('seat unavailable')
    const validate = vi.fn(async (_matchID: string, playerID: string) => (
      playerID === session.playerID
    ))

    await expect(recoverSeatTransition(transition, recoveryActions({
      isDefinitiveRejection: (error) => error === rejection,
      replay: async () => { throw rejection },
      validate,
    }), storage)).resolves.toEqual({ status: 'source', playerID: session.playerID })

    expect(validate).toHaveBeenCalledTimes(1)
    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
    expect(loadSeatTransition(session.matchID, storage)).toBeNull()
  })

  it('keeps an uncertain marker and source session when replay is transient', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const transition = beginSeatTransition(session, '4', storage, 42)
    markSeatTransitionUncertain(transition, storage)
    const validate = vi.fn(async () => true)

    await expect(recoverSeatTransition(transition, recoveryActions({
      replay: async () => { throw new TypeError('Failed to fetch') },
      validate,
    }), storage)).rejects.toThrow('Failed to fetch')

    expect(validate).not.toHaveBeenCalled()
    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
    expect(loadSeatTransition(session.matchID, storage)).toMatchObject({
      transitionID: transition.transitionID,
      status: 'uncertain',
    })
  })

  it('does not let an older recovery overwrite a newer transition created during validation', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const older = beginSeatTransition(session, '4', storage, 42, () => 'older')
    markSeatTransitionUncertain(older, storage)
    let newer: ReturnType<typeof beginSeatTransition> | null = null

    await expect(recoverSeatTransition(older, recoveryActions({
      replay: async () => {
        newer = beginSeatTransition(session, '3', storage, 43, () => 'newer')
        return {
          matchID: session.matchID,
          playerID: older.targetPlayerID,
          playerCredentials: session.credentials,
        }
      },
    }), storage)).resolves.toEqual({ status: 'requesting', playerID: session.playerID })

    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
    expect(loadSeatTransition(session.matchID, storage)).toEqual(newer)
  })

  it('clears only the source session when neither seat credential is valid', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const transition = beginSeatTransition(session, '4', storage, 42)
    markSeatTransitionUncertain(transition, storage)

    const rejection = new Error('invalid session')
    await expect(recoverSeatTransition(transition, recoveryActions({
      isDefinitiveRejection: (error) => error === rejection,
      replay: async () => { throw rejection },
    }), storage)).resolves.toEqual({
      status: 'invalid',
    })
    expect(loadRoomSession(session.matchID, storage)).toBeNull()
    expect(loadSeatTransition(session.matchID, storage)).toBeNull()
  })

  it('does not recover or clear a transition while its request is in flight', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const transition = beginSeatTransition(session, '4', storage, 42)
    const actions = recoveryActions({ validate: vi.fn(async () => true) })

    await expect(recoverSeatTransition(transition, actions, storage, 43)).resolves.toEqual({
      status: 'requesting',
      playerID: session.playerID,
    })
    expect(actions.validate).not.toHaveBeenCalled()
    expect(loadSeatTransition(session.matchID, storage)).toEqual(transition)
  })

  it('loads legacy transition markers as uncertain recovery work', () => {
    const storage = createStorage({
      'avalon:seat-transition:room-123': JSON.stringify({
        matchID: session.matchID,
        sourcePlayerID: session.playerID,
        targetPlayerID: '4',
        credentials: session.credentials,
        startedAt: 42,
      }),
    })

    expect(loadSeatTransition(session.matchID, storage)).toMatchObject({ status: 'uncertain' })
  })

  it('keeps a recent requesting marker from the previous schema leased', async () => {
    const storage = createStorage({
      'avalon:seat-transition:room-123': JSON.stringify({
        matchID: session.matchID,
        sourcePlayerID: session.playerID,
        targetPlayerID: '4',
        credentials: session.credentials,
        startedAt: 42,
        status: 'requesting',
      }),
    })
    const transition = loadSeatTransition(session.matchID, storage)!
    const actions = recoveryActions({ validate: vi.fn(async () => true) })

    await expect(recoverSeatTransition(transition, actions, storage, 43)).resolves.toEqual({
      status: 'requesting',
      playerID: session.playerID,
    })
    expect(actions.validate).not.toHaveBeenCalled()
  })

  it('expires an orphaned requesting transition before replaying its exact move', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const transition = beginSeatTransition(session, '4', storage, 42, () => 'orphan')
    const replay = vi.fn(recoveryActions().replay)

    await expect(recoverSeatTransition(
      transition,
      recoveryActions({ replay }),
      storage,
      transition.leaseExpiresAt + 1,
    )).resolves.toEqual({ status: 'target', playerID: '4' })
    expect(replay).toHaveBeenCalledTimes(1)
    expect(loadRoomSession(session.matchID, storage)).toEqual({ ...session, playerID: '4' })
  })

  it('replays legacy uncertain markers through the same exact transition path', async () => {
    const storage = createStorage({
      'avalon:seat-transition:room-123': JSON.stringify({
        matchID: session.matchID,
        sourcePlayerID: session.playerID,
        targetPlayerID: '4',
        credentials: session.credentials,
        startedAt: 42,
      }),
    })
    saveRoomSession(session, storage)
    const transition = loadSeatTransition(session.matchID, storage)!
    const replay = vi.fn(recoveryActions().replay)

    await expect(recoverSeatTransition(
      transition,
      recoveryActions({ replay }),
      storage,
    )).resolves.toEqual({ status: 'target', playerID: '4' })

    expect(replay).toHaveBeenCalledWith(
      session.matchID,
      session.playerID,
      session.credentials,
      '4',
    )
    expect(loadSeatTransition(session.matchID, storage)).toBeNull()
  })

  it('renews an active request lease without changing its opaque identity', () => {
    const storage = createStorage()
    const transition = beginSeatTransition(session, '4', storage, 42, () => 'request-1')

    renewSeatTransitionLease(transition, storage, 1_000)

    expect(loadSeatTransition(session.matchID, storage)).toMatchObject({
      transitionID: 'request-1',
      status: 'requesting',
      leaseExpiresAt: 1_000 + SEAT_TRANSITION_LEASE_MS,
    })
  })

  it('gives different same-millisecond seat targets different opaque transition IDs', () => {
    const firstStorage = createStorage()
    const secondStorage = createStorage()

    const first = beginSeatTransition(session, '3', firstStorage, 42)
    const second = beginSeatTransition(session, '4', secondStorage, 42)

    expect(first.transitionID).not.toBe(second.transitionID)
  })

  it('does not let an older move overwrite its source or consume a newer transition marker', () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const older = beginSeatTransition(session, '4', storage, 42, () => 'older')
    const newer = beginSeatTransition(session, '3', storage, 42, () => 'newer')

    completeSeatTransition(session, older, {
      matchID: session.matchID,
      playerID: '4',
      playerCredentials: 'late-credential',
    }, storage)

    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
    expect(loadSeatTransition(session.matchID, storage)).toEqual(newer)
  })

  it('preserves and adopts a newer valid session when an old success arrives late', () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    const older = beginSeatTransition(session, '4', storage, 42, () => 'older')
    const newerSession = { ...session, playerID: '3', credentials: 'newer-credential' }
    saveRoomSession(newerSession, storage)

    expect(completeSeatTransition(session, older, {
      matchID: session.matchID,
      playerID: '4',
      playerCredentials: 'late-credential',
    }, storage)).toEqual(newerSession)

    expect(loadRoomSession(session.matchID, storage)).toEqual(newerSession)
    expect(loadSeatTransition(session.matchID, storage)).toEqual(older)
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
      .toBe('上次的座位已失效。')
  })

  it('classifies a missing room separately from an unauthorized seat', () => {
    expect(getRoomSessionInvalidationNotice(new RoomSessionValidationHttpError(404)))
      .toBe('房间已解散。')
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

  it('does not let a stale validation clear a completed seat migration', async () => {
    const storage = createStorage()
    const targetSession = { ...session, playerID: '4', credentials: 'credential-456' }
    let finishValidation: (response: Response) => void = () => {}
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => {
      finishValidation = resolve
    }))
    saveRoomSession(session, storage)

    const validation = validateActiveRoomSessions(
      [{ matchID: session.matchID, status: 'lobby' }],
      'http://localhost:8001',
      storage,
      fetcher,
    )
    saveRoomSession(targetSession, storage)
    finishValidation(new Response(null, { status: 403 }))

    await expect(validation).resolves.toEqual({ sessions: [], validationFailed: false })
    expect(loadRoomSession(session.matchID, storage)).toEqual(targetSession)
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

  it('does not clear a source session while another tab changes its seat', async () => {
    const storage = createStorage()
    saveRoomSession(session, storage)
    beginSeatTransition(session, '4', storage, 42)

    const result = await validateActiveRoomSessions(
      [{ matchID: session.matchID, status: 'lobby' }],
      'http://localhost:8001',
      storage,
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    )

    expect(result).toEqual({ sessions: [session], validationFailed: false })
    expect(loadRoomSession(session.matchID, storage)).toEqual(session)
  })
})
