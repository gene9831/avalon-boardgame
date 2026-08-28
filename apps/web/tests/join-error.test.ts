import { describe, expect, it } from 'vitest'

import { classifyJoinError } from '../src/join-error'

function lobbyError(status: number, details: string) {
  return Object.assign(new Error(`HTTP status ${status}`), { details })
}

function structuredLobbyError(status: number, code: string) {
  return Object.assign(new Error(`HTTP status ${status}`), {
    details: { error: { code, message: 'Safe server message' } },
  })
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

  it('refreshes the room list for stale room or seat state', () => {
    expect(classifyJoinError(lobbyError(409, 'Player 2 not available'))).toEqual({
      message: '所选座位已被占用，请重新选择。',
      refreshRooms: true,
    })
    expect(classifyJoinError(lobbyError(404, 'Match room-1 not found'))).toEqual({
      message: '房间不存在或已解散，请返回房间列表。',
      refreshRooms: true,
    })
  })

  it('classifies stable server error codes without parsing dependency text', () => {
    expect(classifyJoinError(structuredLobbyError(409, 'seat_unavailable'))).toEqual({
      message: '所选座位已被占用，请重新选择。',
      refreshRooms: true,
    })
    expect(classifyJoinError(structuredLobbyError(409, 'client_already_joined'))).toEqual({
      message: '你已经加入这个房间，请从房间列表继续游戏。',
      refreshRooms: true,
    })
    expect(classifyJoinError(structuredLobbyError(400, 'invalid_request'))).toEqual({
      message: '暂时无法加入房间，请重新选择后再试。',
      refreshRooms: false,
    })
  })

  it('keeps retryable network failures in a toast without refreshing rooms', () => {
    expect(classifyJoinError(new TypeError('Failed to fetch'))).toEqual({
      message: '网络连接异常，请稍后重试。',
      refreshRooms: false,
    })
  })

  it('does not expose unknown request details to players', () => {
    expect(classifyJoinError(new Error('postgres connection secret detail'))).toEqual({
      message: '暂时无法加入房间，请稍后重试。',
      refreshRooms: false,
    })
  })
})
