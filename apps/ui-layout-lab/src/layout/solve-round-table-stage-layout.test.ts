import { describe, expect, it } from 'vitest'

import { solveRoundTableStageLayout } from './index'
import type { Rect, RoundTableStageLayout } from './index'
import { rectangleBoundaryGap } from '../stadium-model/geometry'

function expectReady(
  maxStageWidth: number,
  maxStageHeight: number,
  playerCount: number,
): RoundTableStageLayout {
  const result = solveRoundTableStageLayout({
    maxStageWidth,
    maxStageHeight,
    playerCount,
  })
  expect(result.status).toBe('ready')
  if (result.status !== 'ready') {
    throw new Error(`Expected a ready layout, received ${result.reason}`)
  }
  return result
}

function contains(container: Rect, item: Rect, tolerance = 0.01): boolean {
  return item.x >= container.x - tolerance
    && item.y >= container.y - tolerance
    && item.x + item.width <= container.x + container.width + tolerance
    && item.y + item.height <= container.y + container.height + tolerance
}

describe('solveRoundTableStageLayout', () => {
  it('rejects invalid stage inputs and unsupported player counts', () => {
    expect(solveRoundTableStageLayout({
      maxStageWidth: 366,
      maxStageHeight: 596,
      playerCount: 4,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
    expect(solveRoundTableStageLayout({
      maxStageWidth: Number.NaN,
      maxStageHeight: 596,
      playerCount: 10,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
    expect(solveRoundTableStageLayout({
      maxStageWidth: 4_096.01,
      maxStageHeight: 596,
      playerCount: 10,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
    expect(solveRoundTableStageLayout({
      maxStageWidth: 386,
      maxStageHeight: 800.01,
      playerCount: 10,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
  })

  it('reports the pending wide-stage strategy without an orientation input', () => {
    expect(solveRoundTableStageLayout({
      maxStageWidth: 844,
      maxStageHeight: 390,
      playerCount: 10,
    })).toEqual({ status: 'unavailable', reason: 'wide-stage-strategy-pending' })
  })

  it('returns no fitting result instead of applying a viewport minimum', () => {
    expect(solveRoundTableStageLayout({
      maxStageWidth: 40,
      maxStageHeight: 50,
      playerCount: 10,
    })).toEqual({ status: 'unavailable', reason: 'no-fitting-stage-layout' })
  })

  it('defaults the player-seat boundary gap to 8 and accepts a smaller caller gap', () => {
    const defaultGapLayout = expectReady(386, 482, 10)
    const sixPixelGapResult = solveRoundTableStageLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 10,
      gap: 6,
    })

    expect(defaultGapLayout.playerSeats[0].avatarRect.width).toBe(40)
    expect(sixPixelGapResult.status).toBe('ready')
    if (sixPixelGapResult.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${sixPixelGapResult.reason}`)
    }
    expect(sixPixelGapResult.playerSeats[0].avatarRect.width).toBe(40)
  })

  it('keeps 40px stadium avatars for eight players on the 402×714 device stage', () => {
    const result = solveRoundTableStageLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 8,
      gap: 4,
      maxAvatarSize: 56,
      avatarSizeStep: 4,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${result.reason}`)
    }
    expect(result.playerSeats[0].avatarRect.width).toBe(40)
  })

  it('applies the same centered-seat rule to seven players', () => {
    const result = solveRoundTableStageLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 7,
      gap: 4,
      maxAvatarSize: 56,
      avatarSizeStep: 4,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${result.reason}`)
    }
    expect(result.playerSeats[0].avatarRect.width).toBe(40)
  })

  it.each([
    [5, 44],
    [6, 40],
  ])(
    'keeps a tier feasible for all lower player counts through %i players',
    (playerCount, expectedAvatarSize) => {
      const result = solveRoundTableStageLayout({
        maxStageWidth: 386,
        maxStageHeight: 482,
        playerCount,
        gap: 4,
        maxAvatarSize: 56,
        avatarSizeStep: 4,
      })

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') {
        throw new Error(`Expected a ready layout, received ${result.reason}`)
      }
      expect(result.playerSeats[0].avatarRect.width).toBe(expectedAvatarSize)
    },
  )

  it('uses the approved monotone avatar sequence and square collision envelopes', () => {
    const avatarSizes = [5, 6, 7, 8, 9, 10].map((playerCount) => {
      const result = solveRoundTableStageLayout({
        maxStageWidth: 386,
        maxStageHeight: 482,
        playerCount,
        gap: 4,
        maxAvatarSize: 56,
        avatarSizeStep: 4,
      })
      expect(result.status).toBe('ready')
      if (result.status !== 'ready') {
        throw new Error(`Expected a ready layout, received ${result.reason}`)
      }
      return result.playerSeats[0].avatarRect.width
    })

    expect(avatarSizes).toEqual([44, 40, 40, 40, 40, 40])
    const layout = expectReady(386, 482, 10)
    for (const seat of layout.playerSeats) {
      expect(seat.playerSeatBounds.width).toBe(seat.playerSeatBounds.height)
      expect(contains(seat.playerSeatBounds, seat.avatarRect)).toBe(true)
      expect(contains(seat.playerSeatBounds, seat.nameRect)).toBe(true)
    }
    for (let first = 0; first < layout.playerSeats.length; first += 1) {
      for (let second = first + 1; second < layout.playerSeats.length; second += 1) {
        expect(rectangleBoundaryGap(
          layout.playerSeats[first].playerSeatBounds,
          layout.playerSeats[second].playerSeatBounds,
        )).toBeGreaterThanOrEqual(7.989)
      }
    }
  }, 10_000)

  it('rejects an invalid player-seat boundary gap', () => {
    expect(solveRoundTableStageLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 10,
      gap: -1,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
  })

  it('uses the caller avatar ceiling and always tries 36 as the final tier', () => {
    const customMaximumResult = solveRoundTableStageLayout({
      maxStageWidth: 744,
      maxStageHeight: 776,
      playerCount: 10,
      maxAvatarSize: 52,
    })
    const clampedFinalTierResult = solveRoundTableStageLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 10,
      maxAvatarSize: 56,
      avatarSizeStep: 20,
    })

    expect(customMaximumResult.status).toBe('ready')
    if (customMaximumResult.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${customMaximumResult.reason}`)
    }
    expect(customMaximumResult.playerSeats[0].avatarRect.width).toBe(52)

    expect(clampedFinalTierResult.status).toBe('ready')
    if (clampedFinalTierResult.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${clampedFinalTierResult.reason}`)
    }
    expect(clampedFinalTierResult.playerSeats[0].avatarRect.width).toBe(36)
  })

  it('rejects invalid avatar tier controls', () => {
    for (const parameters of [
      { maxAvatarSize: 35 },
      { maxAvatarSize: 57 },
      { avatarSizeStep: 0 },
      { avatarSizeStep: Number.NaN },
    ]) {
      expect(solveRoundTableStageLayout({
        maxStageWidth: 386,
        maxStageHeight: 482,
        playerCount: 10,
        ...parameters,
      })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
    }
  })

  it('returns only renderable geometry in stage-local coordinates', () => {
    const layout = expectReady(366, 596, 10)
    const stageBounds = { x: 0, y: 0, width: 366, height: 596 }

    expect(Object.keys(layout).sort()).toEqual([
      'centerPanel',
      'playerSeats',
      'shape',
      'status',
      'tabletop',
    ])
    expect(layout.shape).toBe('stadium')
    expect(layout.playerSeats[0].avatarRect.width).toBe(36)
    expect(contains(stageBounds, layout.tabletop)).toBe(true)
    expect(contains(stageBounds, layout.centerPanel)).toBe(true)
    for (const seat of layout.playerSeats) {
      expect(contains(stageBounds, seat.playerSeatBounds)).toBe(true)
    }
  })
})
