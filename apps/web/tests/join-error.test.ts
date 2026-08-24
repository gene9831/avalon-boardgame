import { describe, expect, it } from 'vitest'

import { classifyJoinError } from '../src/join-error'

function lobbyError(status: number, details: string) {
  return Object.assign(new Error(`HTTP status ${status}`), { details })
}

describe('join error classification', () => {
  it('turns name conflicts and validation failures into retryable toast messages', () => {
    expect(classifyJoinError(lobbyError(409, 'Player name is already used in this match'))).toEqual({
      message: '这个名字已被本房间的其他玩家使用。',
      refreshRooms: false,
    })
    expect(classifyJoinError(lobbyError(400, 'Player name must contain 1 to 24 characters'))).toEqual({
      message: '玩家名称需要包含 1–24 个字符。',
      refreshRooms: false,
    })
  })

  it('closes the dialog for stale room or seat state', () => {
    expect(classifyJoinError(lobbyError(409, 'Player 2 not available'))).toEqual({
      message: '所选座位已被占用，请刷新房间列表后重新选择。',
      refreshRooms: true,
    })
    expect(classifyJoinError(lobbyError(404, 'Match room-1 not found'))).toEqual({
      message: '房间不存在或已被解散，请重新选择。',
      refreshRooms: true,
    })
  })

  it('keeps retryable network failures in a toast without refreshing rooms', () => {
    expect(classifyJoinError(new TypeError('Failed to fetch'))).toEqual({
      message: '网络请求失败，请检查连接后重试。',
      refreshRooms: false,
    })
  })
})
