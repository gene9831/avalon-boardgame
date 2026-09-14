import { describe, expect, it } from 'vitest'

import { solveRoundTableStageLayout } from './index'

describe('public round-table stage layout API', () => {
  it('fits the documented ten-player minimum portrait stage at the 40px tier', () => {
    const result = solveRoundTableStageLayout({
      maxStageWidth: 359,
      maxStageHeight: 435,
      playerCount: 10,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.playerSeats).toHaveLength(10)
    expect(result.playerSeats[0]?.avatarRect.width).toBe(40)
  })
})
