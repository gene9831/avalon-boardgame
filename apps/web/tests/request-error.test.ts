import { describe, expect, it } from 'vitest'

import {
  getRequestErrorMessage,
  getRoomAccessValidationError,
  getSeatTransitionRecoveryError,
} from '../src/request-error'

describe('request error copy', () => {
  it('returns fixed player copy for ordinary request failures', () => {
    expect(getRequestErrorMessage('room-directory')).toBe(
      '暂时无法加载房间列表，请稍后重试。',
    )
    expect(getRequestErrorMessage('room')).toBe(
      '暂时无法进入房间，请稍后重试。',
    )
    expect(getRequestErrorMessage('connection')).toBe(
      '暂时无法连接房间，请稍后重试。',
    )
  })

  it('gives players a next step when room access validation is unavailable', () => {
    expect(getRoomAccessValidationError(true)).toBe(
      '暂时无法确认部分房间状态，请刷新房间列表后重试。',
    )
    expect(getRoomAccessValidationError(false)).toBeNull()
  })

  it('explains an unrecoverable seat transition without exposing server details', () => {
    expect(getSeatTransitionRecoveryError('invalid')).toBe('当前座位会话已失效。')
    expect(getSeatTransitionRecoveryError('source')).toBeNull()
    expect(getSeatTransitionRecoveryError('target')).toBeNull()
  })
})
