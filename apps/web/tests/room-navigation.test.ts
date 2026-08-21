import { describe, expect, it, vi } from 'vitest'

import {
  consumeRoomNavigationNotice,
  getRoomNavigationNotice,
  isRoomRouteGenerationCurrent,
  stopCurrentClient,
} from '../src/room-navigation'

describe('room navigation state', () => {
  it('reads a transient room notice from navigation state', () => {
    expect(getRoomNavigationNotice({ roomNotice: '房间已被删除，已返回主页。' })).toBe(
      '房间已被删除，已返回主页。',
    )
  })

  it('consumes only the transient notice while preserving other navigation state', () => {
    const nextState = consumeRoomNavigationNotice({
      roomNotice: '房间已被删除，已返回主页。',
      source: 'room',
    })

    expect(nextState).toEqual({ source: 'room' })
    expect(getRoomNavigationNotice(nextState)).toBeNull()
  })

  it('rejects stale route generations', () => {
    expect(isRoomRouteGenerationCurrent(4, 3)).toBe(false)
    expect(isRoomRouteGenerationCurrent(4, 4)).toBe(true)
  })

  it('stops the current room client at most once across action and cleanup', () => {
    const client = { stop: vi.fn() }
    const clientRef = { current: client as { stop(): void } | null }

    stopCurrentClient(clientRef)
    stopCurrentClient(clientRef, client)

    expect(client.stop).toHaveBeenCalledTimes(1)
    expect(clientRef.current).toBeNull()
  })
})
