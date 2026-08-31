import { describe, expect, it, vi } from 'vitest'

import {
  changeRoomSeat,
  dissolveRoom,
  getRoomExitErrorMessage,
  getSeatChangeErrorMessage,
  getStartErrorMessage,
  leaveRoom,
  reconcileRoomExit,
  RoomParticipationHttpError,
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

describe('room participation client', () => {
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
