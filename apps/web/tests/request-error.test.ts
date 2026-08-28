import { describe, expect, it } from 'vitest'

import { getRequestErrorMessage } from '../src/request-error'

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
})
