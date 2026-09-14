import { describe, expect, it } from 'vitest'

import { solveRoundTableStageLayoutWithDiagnostics } from './solve-round-table-stage-layout'
import { circleBoundaryGap, pointDistance } from '../stadium-model/geometry'
import type {
  DetailedRoundTableStageLayout,
  Rect,
} from './types'

function expectReady(
  maxStageWidth: number,
  maxStageHeight: number,
  playerCount: number,
): DetailedRoundTableStageLayout {
  const result = solveRoundTableStageLayoutWithDiagnostics({
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

function seatCenter(seat: DetailedRoundTableStageLayout['playerSeats'][number]) {
  return {
    x: seat.playerSeatBounds.x + seat.playerSeatBounds.width / 2,
    y: seat.playerSeatBounds.y + seat.playerSeatBounds.height / 2,
  }
}

function numericValues(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (Array.isArray(value)) return value.flatMap(numericValues)
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(numericValues)
  }
  return []
}

describe('tall round-table stage layout', () => {
  it.each([
    {
      maxStageWidth: 359,
      maxStageHeight: 435,
      avatarDiameter: 40,
      shape: 'stadium',
    },
    {
      maxStageWidth: 366,
      maxStageHeight: 596,
      avatarDiameter: 56,
      shape: 'stadium',
    },
    {
      maxStageWidth: 406,
      maxStageHeight: 684,
      avatarDiameter: 56,
      shape: 'stadium',
    },
    {
      maxStageWidth: 744,
      maxStageHeight: 776,
      avatarDiameter: 56,
      shape: 'circle',
    },
  ] as const)(
    'keeps the largest fitting ten-player tier at $maxStageWidth×$maxStageHeight',
    ({ maxStageWidth, maxStageHeight, avatarDiameter, shape }) => {
      const layout = expectReady(maxStageWidth, maxStageHeight, 10)
      expect(layout.playerSeats[0].avatarRect.width).toBe(avatarDiameter)
      expect(layout).toMatchObject({ shape })
    },
  )

  it.each([5, 6, 7, 8, 9, 10])(
    'keeps every component and seat boundary inside the hard stage for %i players',
    (playerCount) => {
      for (const [maxStageWidth, maxStageHeight] of [
        [359, 435],
        [366, 596],
        [406, 684],
      ]) {
        const layout = expectReady(maxStageWidth, maxStageHeight, playerCount)
        const stageBounds = { x: 0, y: 0, width: maxStageWidth, height: maxStageHeight }
        const { diagnostics, playerSeats } = layout

        expect(playerSeats).toHaveLength(playerCount)
        expect(contains(stageBounds, diagnostics.roundTableFootprint)).toBe(true)
        expect(contains(stageBounds, diagnostics.roundTableFrame)).toBe(true)
        expect(contains(stageBounds, layout.tabletop)).toBe(true)
        expect(contains(stageBounds, layout.centerPanel)).toBe(true)
        expect(layout.centerPanel).toMatchObject({ width: 128, height: 128 })
        expect(diagnostics.centerProtectionCircle.radius).toBe(68)
        for (const seat of playerSeats) {
          expect(contains(stageBounds, seat.playerSeatBounds)).toBe(true)
          expect(contains(stageBounds, {
            x: seat.playerBoundaryCircle.center.x - seat.playerBoundaryCircle.radius,
            y: seat.playerBoundaryCircle.center.y - seat.playerBoundaryCircle.radius,
            width: 2 * seat.playerBoundaryCircle.radius,
            height: 2 * seat.playerBoundaryCircle.radius,
          })).toBe(true)
          expect(seat.playerSeatBounds.width).toBe(seat.playerSeatBounds.height)
          expect(contains(seat.playerSeatBounds, seat.avatarRect)).toBe(true)
          expect(contains(stageBounds, seat.nameRect)).toBe(true)
          expect(seat.avatarTopClearance).toBeCloseTo(
            seat.avatarRect.y - seat.playerSeatBounds.y,
            2,
          )
          expect(seat).not.toHaveProperty('crownRect')
          expect(seat).not.toHaveProperty('statusMarkerRect')
        }

        for (let firstIndex = 0; firstIndex < playerSeats.length; firstIndex += 1) {
          for (
            let secondIndex = firstIndex + 1;
            secondIndex < playerSeats.length;
            secondIndex += 1
          ) {
            expect(circleBoundaryGap(
              playerSeats[firstIndex].playerBoundaryCircle,
              playerSeats[secondIndex].playerBoundaryCircle,
            )).toBeGreaterThanOrEqual(diagnostics.seatGap - 0.01)
          }
        }

        for (const seat of playerSeats) {
          expect(
            pointDistance(
              diagnostics.centerProtectionCircle.center,
              seat.playerBoundaryCircle.center,
            ) - seat.playerBoundaryCircle.radius,
          ).toBeGreaterThanOrEqual(67.989)
        }

        const bottomAvatarCenter = playerSeats[0].avatarRect.y
          + playerSeats[0].avatarRect.height / 2
        const lowestAvatarCenter = Math.max(...playerSeats.map((seat) => (
          seat.avatarRect.y + seat.avatarRect.height / 2
        )))
        expect(bottomAvatarCenter).toBeCloseTo(lowestAvatarCenter, 2)
      }
    },
    10_000,
  )

  it.each([5, 6])(
    'keeps a circular table for %i players on a narrow portrait stage',
    (playerCount) => {
      expect(expectReady(366, 596, playerCount).shape).toBe('circle')
    },
  )

  it.each([5, 6, 7, 8, 9, 10])(
    'keeps the %i-player stadium vertically symmetric with the approved anchors',
    (playerCount) => {
      const result = solveRoundTableStageLayoutWithDiagnostics({
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
      const tableCenterX = result.centerPanel.x + result.centerPanel.width / 2
      const leftSeatCount = playerCount % 2 === 0
        ? (playerCount - 2) / 2
        : (playerCount - 1) / 2
      expect(seatCenter(result.playerSeats[0]).x).toBeCloseTo(tableCenterX, 1)

      if (playerCount % 2 === 0) {
        expect(seatCenter(result.playerSeats[leftSeatCount + 1]).x)
          .toBeCloseTo(tableCenterX, 1)
      }
      for (let leftSeatIndex = 1; leftSeatIndex <= leftSeatCount; leftSeatIndex += 1) {
        const leftCenter = seatCenter(result.playerSeats[leftSeatIndex])
        const rightCenter = seatCenter(result.playerSeats[playerCount - leftSeatIndex])
        expect(leftCenter.y).toBeCloseTo(rightCenter.y, 1)
        expect(leftCenter.x + rightCenter.x).toBeCloseTo(2 * tableCenterX, 1)
      }
    },
  )

  it('centers the complete visible footprint inside the maximum stage bounds', () => {
    const maxStageWidth = 366
    const maxStageHeight = 596
    const layout = expectReady(maxStageWidth, maxStageHeight, 10)
    const footprint = layout.diagnostics.roundTableFootprint

    expect(footprint.x + footprint.width / 2).toBeCloseTo(maxStageWidth / 2, 2)
    expect(footprint.y + footprint.height / 2).toBeCloseTo(maxStageHeight / 2, 2)
  })

  it('uses the approved monotone avatar sequence on the compact stage', () => {
    const avatarSizes = [5, 6, 7, 8, 9, 10].map((playerCount) => {
      const result = solveRoundTableStageLayoutWithDiagnostics({
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
    expect(avatarSizes).toEqual([56, 56, 56, 56, 52, 48])
  })

  it('returns deterministic render-safe geometry with at most two decimal places', () => {
    const first = expectReady(366, 596, 10)
    const second = expectReady(366, 596, 10)

    expect(first).toEqual(second)
    for (const value of numericValues(first)) {
      expect(Math.abs(value * 100 - Math.round(value * 100))).toBeLessThan(0.000_001)
    }
  })

})
