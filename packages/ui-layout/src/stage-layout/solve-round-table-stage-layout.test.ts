import { describe, expect, it } from 'vitest'

import { solveRoundTableStageLayout } from '../index'
import type { Rect, RoundTableStageLayout } from '../index'
import { circleBoundaryGap } from '../stadium-model/geometry'
import { solveRoundTableStageLayoutWithDiagnostics } from './solve-round-table-stage-layout'

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

function expectCentipixel(value: number): void {
  expect(value * 100).toBeCloseTo(Math.round(value * 100), 8)
}

function expectRectOnCentipixelGrid(rectangle: Rect): void {
  expectCentipixel(rectangle.x)
  expectCentipixel(rectangle.y)
  expectCentipixel(rectangle.width)
  expectCentipixel(rectangle.height)
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

  it('centers the portrait algorithm inside a wide stage without rotating seats', () => {
    const square = expectReady(390, 390, 10)
    const wide = expectReady(844, 390, 10)
    const offsetX = (844 - 390) / 2
    const stageBounds = { x: 0, y: 0, width: 844, height: 390 }

    expect(wide.shape).toBe(square.shape)
    expect(wide.playerSeats[0].relativeSeatIndex).toBe(0)
    expect(wide.playerSeats[0].playerBoundaryCircle.center).toEqual({
      x: square.playerSeats[0].playerBoundaryCircle.center.x + offsetX,
      y: square.playerSeats[0].playerBoundaryCircle.center.y,
    })

    const visibleRects = [wide.tabletop, wide.centerPanel, ...wide.playerSeats.map((seat) => seat.playerSeatBounds)]
    for (const rectangle of visibleRects) expect(contains(stageBounds, rectangle)).toBe(true)
    const left = Math.min(...visibleRects.map((rectangle) => rectangle.x))
    const right = Math.max(...visibleRects.map((rectangle) => rectangle.x + rectangle.width))
    expect((left + right) / 2).toBeCloseTo(844 / 2, 2)
  })

  it('keeps every wide-stage geometry value on the public grid and aligns translated centers', () => {
    const result = solveRoundTableStageLayoutWithDiagnostics({
      maxStageWidth: 844.01,
      maxStageHeight: 390,
      playerCount: 10,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${result.reason}`)
    }

    expectRectOnCentipixelGrid(result.tabletop)
    expectRectOnCentipixelGrid(result.centerPanel)
    expectRectOnCentipixelGrid(result.diagnostics.roundTableFrame)
    expectRectOnCentipixelGrid(result.diagnostics.roundTableFootprint)
    expectRectOnCentipixelGrid(result.diagnostics.placementGuide.bounds)
    expectCentipixel(result.diagnostics.placementGuide.stadiumStraightLength)
    expectCentipixel(result.diagnostics.centerProtectionCircle.center.x)
    expectCentipixel(result.diagnostics.centerProtectionCircle.center.y)
    expectCentipixel(result.diagnostics.centerProtectionCircle.radius)
    expectCentipixel(result.diagnostics.seatGap)
    expectCentipixel(result.diagnostics.tabletopCenterOffsetY)
    for (const gap of result.diagnostics.adjacentBoundaryGaps) expectCentipixel(gap)

    const placementCenter = {
      x: result.diagnostics.placementGuide.bounds.x + result.diagnostics.placementGuide.bounds.width / 2,
      y: result.diagnostics.placementGuide.bounds.y + result.diagnostics.placementGuide.bounds.height / 2,
    }
    expect(result.diagnostics.centerProtectionCircle.center).toEqual(placementCenter)
    for (const seat of result.playerSeats) {
      expectRectOnCentipixelGrid(seat.playerSeatBounds)
      expectRectOnCentipixelGrid(seat.avatarRect)
      expectRectOnCentipixelGrid(seat.nameRect)
      expectCentipixel(seat.avatarTopClearance)
      expectCentipixel(seat.playerBoundaryCircle.center.x)
      expectCentipixel(seat.playerBoundaryCircle.center.y)
      expectCentipixel(seat.playerBoundaryCircle.radius)
      expect(seat.playerBoundaryCircle.center.x).toBe(
        seat.avatarRect.x + seat.avatarRect.width / 2,
      )
      expect(seat.playerBoundaryCircle.center.y).toBe(
        seat.avatarRect.y + seat.avatarRect.height / 2,
      )
    }
  })

  it('returns no fitting result instead of applying a viewport minimum', () => {
    expect(solveRoundTableStageLayout({
      maxStageWidth: 40,
      maxStageHeight: 50,
      playerCount: 10,
    })).toEqual({ status: 'unavailable', reason: 'no-fitting-stage-layout' })
  })

  it('defaults the player-circle boundary gap to 8 and accepts a smaller caller gap', () => {
    const defaultGapLayout = expectReady(386, 482, 10)
    const sixPixelGapResult = solveRoundTableStageLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 10,
      gap: 6,
    })

    expect(defaultGapLayout.playerSeats[0].avatarRect.width).toBe(48)
    expect(sixPixelGapResult.status).toBe('ready')
    if (sixPixelGapResult.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${sixPixelGapResult.reason}`)
    }
    expect(sixPixelGapResult.playerSeats[0].avatarRect.width).toBe(48)
  })

  it('keeps 56px avatars for eight players on the 386×482 stage', () => {
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
    expect(result.playerSeats[0].avatarRect.width).toBe(56)
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
    expect(result.playerSeats[0].avatarRect.width).toBe(56)
  })

  it.each([
    [5, 56],
    [6, 56],
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

  it('uses circular player boundaries and the approved avatar sequence on the 386×482 stage', () => {
    const avatarSizes = [5, 6, 7, 8, 9, 10].map((playerCount) => {
      const result = solveRoundTableStageLayout({
        maxStageWidth: 386,
        maxStageHeight: 482,
        playerCount,
        gap: 4,
        maxAvatarSize: 56,
      })
      expect(result.status).toBe('ready')
      if (result.status !== 'ready') {
        throw new Error(`Expected a ready layout, received ${result.reason}`)
      }
      return result.playerSeats[0].avatarRect.width
    })

    expect(avatarSizes).toEqual([56, 56, 56, 56, 48, 48])
    const layout = expectReady(386, 482, 10)
    for (const seat of layout.playerSeats) {
      expect(seat.playerSeatBounds.width).toBe(seat.playerSeatBounds.height)
      expect(contains(seat.playerSeatBounds, seat.avatarRect)).toBe(true)
      expect(contains({ x: 0, y: 0, width: 386, height: 482 }, seat.nameRect)).toBe(true)
    }
    for (let first = 0; first < layout.playerSeats.length; first += 1) {
      for (let second = first + 1; second < layout.playerSeats.length; second += 1) {
        expect(circleBoundaryGap(
          layout.playerSeats[first].playerBoundaryCircle,
          layout.playerSeats[second].playerBoundaryCircle,
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

  it('does not exceed a decimal caller avatar ceiling', () => {
    const result = solveRoundTableStageLayout({
      maxStageWidth: 744,
      maxStageHeight: 776,
      playerCount: 10,
      maxAvatarSize: 55.996,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') {
      throw new Error(`Expected a ready layout, received ${result.reason}`)
    }
    expect(result.playerSeats[0].avatarRect.width).toBeLessThanOrEqual(55.99)
  })

  it('rejects invalid avatar tier controls', () => {
    for (const parameters of [
      { maxAvatarSize: 35 },
      { maxAvatarSize: 57 },
      { avatarSizeStep: 0 },
      { avatarSizeStep: 3 },
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
    expect(layout.playerSeats[0].avatarRect.width).toBe(56)
    expect(contains(stageBounds, layout.tabletop)).toBe(true)
    expect(contains(stageBounds, layout.centerPanel)).toBe(true)
    for (const seat of layout.playerSeats) {
      expect(contains(stageBounds, seat.playerSeatBounds)).toBe(true)
    }
  })
})
