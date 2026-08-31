import { describe, expect, it } from 'vitest'

import { classifyJoinError } from '../src/join-error'

function structuredLobbyError(status: number, code: string) {
  return Object.assign(new Error(`HTTP status ${status}`), {
    details: { error: { code, message: 'Safe server message' } },
  })
}

describe('join error classification', () => {
  it.each([
    ['room_full', '房间已满。', true],
    ['room_not_joinable', '游戏已经开始。', true],
    ['room_not_found', '房间不存在或已解散。', true],
    ['client_already_joined', '本浏览器已经加入该房间。', true],
    ['seat_unavailable', '该空座刚刚被其他玩家占用。', true],
    ['invalid_seat_session', '当前座位会话已失效。', false],
    ['not_room_owner', '只有房间拥有者可以执行此操作。', false],
    ['owner_must_dissolve', '房间拥有者退出时需要解散房间。', false],
  ])('uses approved copy for %s', (code, message, refreshRooms) => {
    expect(classifyJoinError(structuredLobbyError(409, code))).toEqual({
      message,
      refreshRooms,
    })
  })

  it('keeps retryable network failures in a toast without refreshing rooms', () => {
    expect(classifyJoinError(new TypeError('Failed to fetch'))).toEqual({
      message: '网络连接异常，请稍后重试。',
      refreshRooms: false,
    })
  })

  it('does not parse English server messages', () => {
    expect(classifyJoinError(Object.assign(new Error('HTTP status 409'), {
      details: 'Player 2 not available',
    }))).toEqual({
      message: '暂时无法加入房间，请稍后重试。',
      refreshRooms: false,
    })
  })
})
