import { describe, expect, it, vi } from 'vitest'

import {
  dissolveRoom,
  getRoomExitErrorMessage,
  leaveRoom,
  RoomParticipationHttpError,
} from '../src/room-participation'

const session = {
  matchID: 'room 123',
  playerID: '2',
  credentials: 'secret-credential',
}

describe('room participation client', () => {
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
      .toBe('游戏已经开始，无法退出房间。')
    expect(getRoomExitErrorMessage(new RoomParticipationHttpError(409), true))
      .toBe('游戏已经开始，无法解散房间。')
    expect(getRoomExitErrorMessage(new Error('network unavailable'), false))
      .toBe('退出失败，请重试。')
  })
})
