import { describe, expect, it } from 'vitest'

import { solveRoomLayout } from './index'

describe('solveRoomLayout', () => {
  it('rejects player counts outside the supported five-to-ten range', () => {
    expect(solveRoomLayout({ width: 390, height: 844, playerCount: 4 })).toEqual({
      status: 'unavailable',
      reason: 'invalid-input',
    })
  })

  it('reports the pending horizontal strategy without requiring an orientation input', () => {
    expect(solveRoomLayout({ width: 844, height: 390, playerCount: 10 })).toEqual({
      status: 'unavailable',
      reason: 'horizontal-strategy-pending',
    })
  })

  it('selects a vertical layout directly from dimensions', () => {
    expect(solveRoomLayout({ width: 390, height: 844, playerCount: 10 })).toMatchObject({
      status: 'ready',
      mode: 'vertical',
      roundTable: {
        avatarDiameter: 48,
        shape: 'stadium',
      },
    })
  })
})
