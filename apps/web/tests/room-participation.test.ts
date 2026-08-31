import { describe, expect, it, vi } from 'vitest'

import {
  changeRoomSeat,
  createBrowserSeatTransitionLock,
  createRoomParticipationClient,
  dissolveRoom,
  getRoomExitErrorMessage,
  getSeatChangeErrorMessage,
  getStartErrorMessage,
  leaveRoom,
  reconcileRoomExit,
  RoomParticipationHttpError,
  RoomParticipationResponseContractError,
  SeatTransitionPendingError,
  SeatTransitionLockUnavailableError,
  type SeatTransitionLeaseDatabase,
  type SeatTransitionLeaseRecord,
} from '../src/room-participation'
import {
  beginSeatTransition,
  loadSeatTransition,
  loadRoomSession,
  markSeatTransitionUncertain,
  recoverSeatTransition,
  saveRoomSession,
  type RoomSession,
  type RoomSessionStorage,
} from '../src/room-session'

function createStorage(): RoomSessionStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

const session = {
  matchID: 'room 123',
  playerID: '2',
  credentials: 'secret-credential',
}

const immediateSeatTransitionLock = async <T>(
  _matchID: string,
  action: () => Promise<T>,
) => action()

function createLeaseDatabase(initialRecords: SeatTransitionLeaseRecord[] = []) {
  const records = new Map(initialRecords.map((record) => [record.matchID, record]))
  let previousTransaction = Promise.resolve()
  const database: SeatTransitionLeaseDatabase = {
    close: () => undefined,
    transaction: async (operation) => {
      const transaction = previousTransaction.then(() => operation({
        delete: (matchID) => { records.delete(matchID) },
        get: async (matchID) => records.get(matchID),
        put: (record) => { records.set(record.matchID, record) },
      }))
      previousTransaction = transaction.then(() => undefined, () => undefined)
      return transaction
    },
  }
  return { database, records }
}

describe('room participation client', () => {
  it('treats a malformed committed seat response as uncertain and recovers the target', async () => {
    const storage = createStorage()
    const roomSession = {
      ...session,
      matchID: 'room-123',
      playerName: 'Alice',
    }
    saveRoomSession(roomSession, storage)
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      matchID: roomSession.matchID,
      playerID: '4',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(changeRoomSeat(
      createRoomParticipationClient('http://localhost:8001', fetcher),
      roomSession,
      '4',
      storage,
      immediateSeatTransitionLock,
    )).rejects.toBeInstanceOf(RoomParticipationResponseContractError)

    const uncertain = loadSeatTransition(roomSession.matchID, storage)!
    expect(uncertain).toMatchObject({ status: 'uncertain', targetPlayerID: '4' })
    const validate = vi.fn(async (_matchID: string, playerID: string) => playerID === '4')
    await expect(recoverSeatTransition(uncertain, validate, storage)).resolves.toEqual({
      status: 'target',
      playerID: '4',
    })
    expect(validate.mock.calls.map(([, playerID]) => playerID)).toEqual(['2', '4'])
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual({ ...roomSession, playerID: '4' })
  })

  it('keeps a malformed seat response recoverable until both seats prove invalid', async () => {
    const storage = createStorage()
    const roomSession = {
      ...session,
      matchID: 'room-123',
      playerName: 'Alice',
    }
    saveRoomSession(roomSession, storage)
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      matchID: roomSession.matchID,
      playerID: '4',
      playerCredentials: '',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(changeRoomSeat(
      createRoomParticipationClient('http://localhost:8001', fetcher),
      roomSession,
      '4',
      storage,
      immediateSeatTransitionLock,
    )).rejects.toBeInstanceOf(RoomParticipationResponseContractError)

    const uncertain = loadSeatTransition(roomSession.matchID, storage)!
    expect(uncertain.status).toBe('uncertain')
    await expect(recoverSeatTransition(uncertain, async () => false, storage)).resolves.toEqual({
      status: 'invalid',
    })
    expect(loadRoomSession(roomSession.matchID, storage)).toBeNull()
    expect(loadSeatTransition(roomSession.matchID, storage)).toBeNull()
  })

  it('keeps an in-flight marker until a lost response becomes recoverable', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    let rejectRequest!: (error: unknown) => void
    const pendingResponse = new Promise<never>((_resolve, reject) => { rejectRequest = reject })
    const request = changeRoomSeat({
      changeSeat: async () => pendingResponse,
      prepareStart: async () => {},
    }, roomSession, '4', storage, immediateSeatTransitionLock)

    const requesting = loadSeatTransition(roomSession.matchID, storage)!
    const validateWhilePending = vi.fn(async () => true)
    await expect(recoverSeatTransition(requesting, validateWhilePending, storage)).resolves.toEqual({
      status: 'requesting', playerID: '2',
    })
    expect(validateWhilePending).not.toHaveBeenCalled()
    expect(loadSeatTransition(roomSession.matchID, storage)).toMatchObject({ status: 'requesting' })

    rejectRequest(new TypeError('response lost after commit'))
    await expect(request).rejects.toThrow('response lost after commit')
    const uncertain = loadSeatTransition(roomSession.matchID, storage)!
    expect(uncertain).toMatchObject({ status: 'uncertain' })
    await expect(recoverSeatTransition(
      uncertain,
      async (_matchID, playerID) => playerID === '4',
      storage,
    )).resolves.toEqual({ status: 'target', playerID: '4' })
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual({ ...roomSession, playerID: '4' })
  })

  it('preserves a transition marker when a seat-change response is uncertain', async () => {
    const storage = createStorage()
    const roomSession = {
      ...session,
      avatarID: 'merlin' as const,
      playerName: 'Alice',
      sessionID: 'join-session-1',
    }
    saveRoomSession(roomSession, storage)

    await expect(changeRoomSeat({
      changeSeat: async () => { throw new TypeError('Failed to fetch') },
      prepareStart: async () => {},
    }, roomSession, '4', storage, immediateSeatTransitionLock)).rejects.toThrow('Failed to fetch')

    expect(loadSeatTransition(roomSession.matchID, storage)).toMatchObject({
      sourcePlayerID: '2',
      targetPlayerID: '4',
      status: 'uncertain',
    })
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual(roomSession)
  })

  it('clears a definitively failed request while preserving the source session', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)

    await expect(changeRoomSeat({
      changeSeat: async () => { throw new RoomParticipationHttpError(409, 'seat_unavailable') },
      prepareStart: async () => {},
    }, roomSession, '4', storage, immediateSeatTransitionLock)).rejects.toEqual(
      new RoomParticipationHttpError(409, 'seat_unavailable'),
    )
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual(roomSession)
    expect(loadSeatTransition(roomSession.matchID, storage)).toBeNull()
  })

  it('treats a 503 response as uncertain and recovers a target committed before the error', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)

    await expect(changeRoomSeat({
      changeSeat: async () => { throw new RoomParticipationHttpError(503) },
      prepareStart: async () => {},
    }, roomSession, '4', storage, immediateSeatTransitionLock)).rejects.toEqual(new RoomParticipationHttpError(503))

    const uncertain = loadSeatTransition(roomSession.matchID, storage)!
    expect(uncertain.status).toBe('uncertain')
    await recoverSeatTransition(
      uncertain,
      async (_matchID, playerID) => playerID === '4',
      storage,
    )
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual({ ...roomSession, playerID: '4' })
  })

  it.each([
    [400, null],
    [403, 'invalid_seat_session'],
    [404, 'room_not_found'],
    [409, 'seat_unavailable'],
  ] as const)('clears a stable HTTP %s rejection marker', async (status, code) => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)

    await expect(changeRoomSeat({
      changeSeat: async () => { throw new RoomParticipationHttpError(status, code) },
      prepareStart: async () => {},
    }, roomSession, '4', storage, immediateSeatTransitionLock)).rejects.toBeInstanceOf(RoomParticipationHttpError)
    expect(loadSeatTransition(roomSession.matchID, storage)).toBeNull()
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual(roomSession)
  })

  it('stores the server-authoritative target seat after changing rooms', async () => {
    const storage = createStorage()
    const roomSession = {
      ...session,
      avatarID: 'merlin' as const,
      playerName: 'Alice',
      sessionID: 'join-session-1',
    }
    saveRoomSession(roomSession, storage)

    const result = await changeRoomSeat({
      changeSeat: async () => ({
        matchID: roomSession.matchID,
        playerID: '4',
        playerCredentials: 'rebound-credential',
      }),
      prepareStart: async () => {},
    }, roomSession, '4', storage, immediateSeatTransitionLock)

    expect(result).toEqual({ ...roomSession, playerID: '4', credentials: 'rebound-credential' })
    expect(loadSeatTransition(roomSession.matchID, storage)).toBeNull()
  })

  it('rejects a second-tab seat move while the first tab owns the room lock', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    let releaseFirstRequest!: () => void
    const firstResponse = new Promise<void>((resolve) => { releaseFirstRequest = resolve })
    let lockHeld = false
    const exclusiveIfAvailableLock = async <T>(
      _matchID: string,
      action: () => Promise<T>,
    ): Promise<T | null> => {
      if (lockHeld) return null
      lockHeld = true
      try {
        return await action()
      } finally {
        lockHeld = false
      }
    }
    const firstClient = {
      changeSeat: vi.fn(async () => {
        await firstResponse
        return {
          matchID: roomSession.matchID,
          playerID: '3',
          playerCredentials: roomSession.credentials,
        }
      }),
      prepareStart: async () => {},
    }
    const secondClient = {
      changeSeat: vi.fn(async () => ({
        matchID: roomSession.matchID,
        playerID: '4',
        playerCredentials: roomSession.credentials,
      })),
      prepareStart: async () => {},
    }

    const firstMove = changeRoomSeat(
      firstClient,
      roomSession,
      '3',
      storage,
      exclusiveIfAvailableLock,
    )
    await vi.waitFor(() => expect(firstClient.changeSeat).toHaveBeenCalledTimes(1))

    await expect(changeRoomSeat(
      secondClient,
      roomSession,
      '4',
      storage,
      exclusiveIfAvailableLock,
    )).rejects.toMatchObject({ name: 'SeatTransitionPendingError' })
    expect(secondClient.changeSeat).not.toHaveBeenCalled()
    expect(loadSeatTransition(roomSession.matchID, storage)).toMatchObject({
      sourcePlayerID: '2',
      targetPlayerID: '3',
    })

    releaseFirstRequest()
    await expect(firstMove).resolves.toMatchObject({ playerID: '3' })
  })

  it('uses the IndexedDB lease fallback for one normal move when Web Locks are unavailable', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    const { database } = createLeaseDatabase()
    const client = {
      changeSeat: vi.fn(async () => ({
        matchID: roomSession.matchID,
        playerID: '4',
        playerCredentials: roomSession.credentials,
      })),
      prepareStart: async () => {},
    }
    const lock = createBrowserSeatTransitionLock({
      generateOwnerToken: () => 'fallback-owner',
      lockManager: null,
      now: () => 1_000,
      openLeaseDatabase: async () => database,
    })

    await expect(changeRoomSeat(client, roomSession, '4', storage, lock))
      .resolves.toMatchObject({ playerID: '4' })
    expect(client.changeSeat).toHaveBeenCalledTimes(1)
  })

  it('lets only one IndexedDB contender begin a same-room transition', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    const { database } = createLeaseDatabase()
    let ownerSequence = 0
    const lock = createBrowserSeatTransitionLock({
      generateOwnerToken: () => `fallback-owner-${ownerSequence += 1}`,
      lockManager: null,
      now: () => 1_000,
      openLeaseDatabase: async () => database,
    })
    let releaseFirstRequest!: () => void
    const firstRequestPending = new Promise<void>((resolve) => { releaseFirstRequest = resolve })
    const firstClient = {
      changeSeat: vi.fn(async () => {
        await firstRequestPending
        return {
          matchID: roomSession.matchID,
          playerID: '3',
          playerCredentials: roomSession.credentials,
        }
      }),
      prepareStart: async () => {},
    }
    const secondClient = {
      changeSeat: vi.fn(async () => ({
        matchID: roomSession.matchID,
        playerID: '4',
        playerCredentials: roomSession.credentials,
      })),
      prepareStart: async () => {},
    }

    const firstMove = changeRoomSeat(firstClient, roomSession, '3', storage, lock)
    await vi.waitFor(() => expect(firstClient.changeSeat).toHaveBeenCalledTimes(1))
    await expect(changeRoomSeat(secondClient, roomSession, '4', storage, lock))
      .rejects.toBeInstanceOf(SeatTransitionPendingError)
    expect(secondClient.changeSeat).not.toHaveBeenCalled()
    expect(loadSeatTransition(roomSession.matchID, storage)).toMatchObject({
      targetPlayerID: '3',
    })

    releaseFirstRequest()
    await expect(firstMove).resolves.toMatchObject({ playerID: '3' })
  })

  it('keeps the persisted transition authoritative after an active fallback lease expires', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    const { database } = createLeaseDatabase()
    let now = 1_000
    let ownerSequence = 0
    const lock = createBrowserSeatTransitionLock({
      generateOwnerToken: () => `fallback-owner-${ownerSequence += 1}`,
      leaseMs: 10,
      lockManager: null,
      now: () => now,
      openLeaseDatabase: async () => database,
    })
    let releaseFirstRequest!: () => void
    const firstRequestPending = new Promise<void>((resolve) => { releaseFirstRequest = resolve })
    const firstClient = {
      changeSeat: vi.fn(async () => {
        await firstRequestPending
        return {
          matchID: roomSession.matchID,
          playerID: '3',
          playerCredentials: roomSession.credentials,
        }
      }),
      prepareStart: async () => {},
    }
    const secondClient = {
      changeSeat: vi.fn(async () => ({
        matchID: roomSession.matchID,
        playerID: '4',
        playerCredentials: roomSession.credentials,
      })),
      prepareStart: async () => {},
    }

    const firstMove = changeRoomSeat(firstClient, roomSession, '3', storage, lock)
    await vi.waitFor(() => expect(firstClient.changeSeat).toHaveBeenCalledTimes(1))
    now = 1_011
    await expect(changeRoomSeat(secondClient, roomSession, '4', storage, lock))
      .rejects.toBeInstanceOf(SeatTransitionPendingError)
    expect(secondClient.changeSeat).not.toHaveBeenCalled()
    expect(loadSeatTransition(roomSession.matchID, storage)).toMatchObject({
      targetPlayerID: '3',
    })

    releaseFirstRequest()
    await expect(firstMove).resolves.toMatchObject({ playerID: '3' })
  })

  it('recovers an expired IndexedDB lease but refuses a live lease', async () => {
    const live = createLeaseDatabase([{
      expiresAt: 1_001,
      matchID: session.matchID,
      ownerToken: 'live-owner',
    }])
    const expired = createLeaseDatabase([{
      expiresAt: 999,
      matchID: session.matchID,
      ownerToken: 'orphan-owner',
    }])
    const liveAction = vi.fn(async () => 'live')
    const recoveredAction = vi.fn(async () => 'recovered')

    await expect(createBrowserSeatTransitionLock({
      generateOwnerToken: () => 'contender',
      lockManager: null,
      now: () => 1_000,
      openLeaseDatabase: async () => live.database,
    })(session.matchID, liveAction)).resolves.toBeNull()
    await expect(createBrowserSeatTransitionLock({
      generateOwnerToken: () => 'recovery-owner',
      lockManager: null,
      now: () => 1_000,
      openLeaseDatabase: async () => expired.database,
    })(session.matchID, recoveredAction)).resolves.toBe('recovered')
    expect(liveAction).not.toHaveBeenCalled()
    expect(recoveredAction).toHaveBeenCalledTimes(1)
  })

  it('releases an IndexedDB lease only while its owner token is still current', async () => {
    const { database, records } = createLeaseDatabase()
    const lock = createBrowserSeatTransitionLock({
      generateOwnerToken: () => 'original-owner',
      lockManager: null,
      now: () => 1_000,
      openLeaseDatabase: async () => database,
    })

    await expect(lock(session.matchID, async () => {
      await database.transaction(async (transaction) => {
        transaction.put({
          expiresAt: 3_000,
          matchID: session.matchID,
          ownerToken: 'replacement-owner',
        })
      })
      return 'completed'
    })).resolves.toBe('completed')

    expect(records.get(session.matchID)).toEqual({
      expiresAt: 3_000,
      matchID: session.matchID,
      ownerToken: 'replacement-owner',
    })
  })

  it.each([
    ['unavailable', null],
    ['failing', async () => { throw new Error('IndexedDB blocked') }],
  ] as const)('fails closed without requesting a seat when IndexedDB is %s', async (_condition, openLeaseDatabase) => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    const client = {
      changeSeat: vi.fn(),
      prepareStart: async () => {},
    }
    const lock = createBrowserSeatTransitionLock({
      lockManager: null,
      openLeaseDatabase,
    })

    await expect(changeRoomSeat(client, roomSession, '4', storage, lock))
      .rejects.toBeInstanceOf(SeatTransitionLockUnavailableError)
    expect(client.changeSeat).not.toHaveBeenCalled()
    expect(getSeatChangeErrorMessage(new SeatTransitionLockUnavailableError()))
      .toBe('当前浏览器无法安全换座，请刷新或更换浏览器后重试。')
  })

  it('rejects a new move without a request when a legacy transition marker exists', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    beginSeatTransition(roomSession, '3', storage, 42, () => 'existing')
    const client = {
      changeSeat: vi.fn(async () => ({
        matchID: roomSession.matchID,
        playerID: '4',
        playerCredentials: roomSession.credentials,
      })),
      prepareStart: async () => {},
    }

    await expect(changeRoomSeat(
      client,
      roomSession,
      '4',
      storage,
      immediateSeatTransitionLock,
    )).rejects.toMatchObject({ name: 'SeatTransitionPendingError' })
    expect(client.changeSeat).not.toHaveBeenCalled()
    expect(loadSeatTransition(roomSession.matchID, storage)).toMatchObject({
      transitionID: 'existing',
      targetPlayerID: '3',
    })
  })

  it('uses a same-room exclusive browser lock without queueing behind its owner', async () => {
    const storage = createStorage()
    const roomSession = { ...session, playerName: 'Alice' }
    saveRoomSession(roomSession, storage)
    const request = vi.fn(async (
      name: string,
      options: LockOptions,
      callback: (lock: Lock | null) => Promise<unknown>,
    ) => callback(null))
    vi.stubGlobal('navigator', { locks: { request } })

    try {
      await expect(changeRoomSeat({
        changeSeat: vi.fn(),
        prepareStart: async () => {},
      }, roomSession, '4', storage)).rejects.toMatchObject({
        name: 'SeatTransitionPendingError',
      })
      expect(request).toHaveBeenCalledWith(
        'avalon:seat-transition:room%20123',
        { ifAvailable: true, mode: 'exclusive' },
        expect.any(Function),
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('releases the current seat without exposing its credential in the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await expect(leaveRoom('http://localhost:8001', session, fetcher)).resolves.toEqual({
      status: 204,
    })

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8001/rooms/avalon/room%20123/players/2',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer secret-credential' },
      },
    )
    expect(fetcher.mock.calls[0][0]).not.toContain('secret-credential')
  })

  it.each([403, 404])('treats HTTP %s as an already completed exit', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }))

    await expect(
      leaveRoom('http://localhost:8001', session, fetcher),
    ).resolves.toEqual({ status })
  })

  it('uses the host credential to dissolve the whole room', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await expect(dissolveRoom('http://localhost:8001', session, fetcher)).resolves.toEqual({
      status: 204,
    })

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8001/rooms/avalon/room%20123',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer secret-credential' },
      },
    )
  })

  it.each([409, 500])('keeps a failed HTTP %s exit distinguishable', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }))

    await expect(
      leaveRoom('http://localhost:8001', session, fetcher),
    ).rejects.toEqual(new RoomParticipationHttpError(status))
  })

  it('explains state conflicts and retryable failures without clearing the session', () => {
    expect(getRoomExitErrorMessage(new RoomParticipationHttpError(409), false))
      .toBe('对局已经开始，无法退出房间。')
    expect(getRoomExitErrorMessage(new RoomParticipationHttpError(409), true))
      .toBe('对局已经开始，无法解散房间。')
    expect(getRoomExitErrorMessage(new Error('network unavailable'), false))
      .toBe('退出房间失败，请重试。')
    expect(getRoomExitErrorMessage(new Error('network unavailable'), true))
      .toBe('解散房间失败，请重试。')
  })

  it('uses the stable seat conflict code instead of exit copy', () => {
    expect(getSeatChangeErrorMessage(new RoomParticipationHttpError(409, 'seat_unavailable')))
      .toBe('该空座刚刚被其他玩家占用。')
  })

  it('uses dedicated start failure copy', () => {
    expect(getStartErrorMessage(new RoomParticipationHttpError(403, 'not_room_owner')))
      .toBe('只有房间拥有者可以执行此操作。')
    expect(getStartErrorMessage(new Error('network unavailable')))
      .toBe('开始游戏失败，请重试。')
  })
})

describe('room exit reconciliation', () => {
  const roomSession: RoomSession = {
    ...session,
    playerName: 'Alice',
  }

  it('does not count a stale-source 403 as exit while a cross-tab move is requesting', async () => {
    const storage = createStorage()
    saveRoomSession(roomSession, storage)
    const transition = beginSeatTransition(roomSession, '4', storage, Date.now(), () => 'move-1')
    const validate = vi.fn(async () => true)

    await expect(reconcileRoomExit(
      roomSession,
      { status: 403 },
      true,
      validate,
      storage,
    )).resolves.toEqual({ status: 'transition-pending' })
    expect(validate).not.toHaveBeenCalled()
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual(roomSession)
    expect(loadSeatTransition(roomSession.matchID, storage)).toEqual(transition)
  })

  it('recovers and adopts a committed target before handling a stale-source 403', async () => {
    const storage = createStorage()
    saveRoomSession(roomSession, storage)
    const transition = beginSeatTransition(roomSession, '4', storage, 42, () => 'move-2')
    markSeatTransitionUncertain(transition, storage)

    await expect(reconcileRoomExit(
      roomSession,
      { status: 403 },
      true,
      async (_matchID, playerID) => playerID === '4',
      storage,
    )).resolves.toEqual({
      status: 'rebind',
      session: { ...roomSession, playerID: '4' },
    })
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual({
      ...roomSession,
      playerID: '4',
    })
  })

  it('adopts a target already saved by another tab instead of clearing it', async () => {
    const storage = createStorage()
    saveRoomSession({ ...roomSession, playerID: '4' }, storage)

    await expect(reconcileRoomExit(
      roomSession,
      { status: 403 },
      true,
      async () => false,
      storage,
    )).resolves.toEqual({
      status: 'rebind',
      session: { ...roomSession, playerID: '4' },
    })
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual({
      ...roomSession,
      playerID: '4',
    })
  })

  it('retains a valid source when a transition changed during a 403 request', async () => {
    const storage = createStorage()
    saveRoomSession(roomSession, storage)

    await expect(reconcileRoomExit(
      roomSession,
      { status: 403 },
      true,
      async (_matchID, playerID) => playerID === roomSession.playerID,
      storage,
    )).resolves.toEqual({ status: 'session-retained' })
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual(roomSession)
  })

  it('clears only the exact intended session after an ordinary completed exit', async () => {
    const storage = createStorage()
    saveRoomSession(roomSession, storage)

    await expect(reconcileRoomExit(
      roomSession,
      { status: 204 },
      false,
      async () => false,
      storage,
    )).resolves.toEqual({ status: 'completed' })
    expect(loadRoomSession(roomSession.matchID, storage)).toBeNull()
  })

  it('preserves a target saved between the exit request and exact cleanup', async () => {
    const storage = createStorage()
    const target = { ...roomSession, playerID: '4' }
    saveRoomSession(target, storage)

    await expect(reconcileRoomExit(
      roomSession,
      { status: 204 },
      false,
      async () => false,
      storage,
    )).resolves.toEqual({ status: 'rebind', session: target })
    expect(loadRoomSession(roomSession.matchID, storage)).toEqual(target)
  })
})
