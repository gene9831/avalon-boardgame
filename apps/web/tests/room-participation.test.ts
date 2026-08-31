import { describe, expect, it, vi } from 'vitest'

import {
  changeRoomSeat,
  dissolveRoom,
  getRoomExitErrorMessage,
  getSeatChangeErrorMessage,
  leaveRoom,
  RoomParticipationHttpError,
} from '../src/room-participation'
import {
  loadSeatTransition,
  loadRoomSession,
  saveRoomSession,
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

describe('room participation client', () => {
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
    }, roomSession, '4', storage)).rejects.toThrow('Failed to fetch')

    expect(loadSeatTransition(roomSession.matchID, storage)).toMatchObject({
      sourcePlayerID: '2',
      targetPlayerID: '4',
    })
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
    }, roomSession, '4', storage)

    expect(result).toEqual({ ...roomSession, playerID: '4', credentials: 'rebound-credential' })
    expect(loadSeatTransition(roomSession.matchID, storage)).toBeNull()
  })

  it('releases the current seat without exposing its credential in the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await leaveRoom('http://localhost:8001', session, fetcher)

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
    ).resolves.toBeUndefined()
  })

  it('uses the host credential to dissolve the whole room', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await dissolveRoom('http://localhost:8001', session, fetcher)

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
})
