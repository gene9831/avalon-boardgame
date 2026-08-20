import { describe, expect, it } from 'vitest'

import {
  consumeRoomNavigationNotice,
  getRoomNavigationNotice,
  isRoomRouteGenerationCurrent,
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
})
