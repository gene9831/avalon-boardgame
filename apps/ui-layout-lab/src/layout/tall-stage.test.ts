import { describe, expect, it } from 'vitest'

import { solveRoundTableStageLayoutWithDiagnostics } from './solve-round-table-stage-layout'
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

function boundaryGap(first: Rect, second: Rect): number {
  const horizontalSeparation = Math.max(
    second.x - (first.x + first.width),
    first.x - (second.x + second.width),
  )
  const verticalSeparation = Math.max(
    second.y - (first.y + first.height),
    first.y - (second.y + second.height),
  )
  return Math.round(Math.max(horizontalSeparation, verticalSeparation) * 100) / 100
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
      avatarDiameter: 48,
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
      expect(layout).toMatchObject({ shape })
      expect(layout.playerSeats[0].avatarRect.width).toBe(avatarDiameter)
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
        expect(contains(stageBounds, layout.tabletop)).toBe(true)
        expect(contains(stageBounds, layout.centerPanel)).toBe(true)
        for (const seat of playerSeats) {
          expect(contains(stageBounds, seat.playerSeatBounds)).toBe(true)
          expect(contains(seat.playerSeatBounds, seat.avatarRect)).toBe(true)
          expect(contains(seat.playerSeatBounds, seat.nameRect)).toBe(true)
          expect(seat.avatarTopClearance).toBeGreaterThan(0)
          expect(seat).not.toHaveProperty('crownRect')
          expect(seat).not.toHaveProperty('statusMarkerRect')
        }

        for (let firstIndex = 0; firstIndex < playerSeats.length; firstIndex += 1) {
          for (
            let secondIndex = firstIndex + 1;
            secondIndex < playerSeats.length;
            secondIndex += 1
          ) {
            expect(boundaryGap(
              playerSeats[firstIndex].playerSeatBounds,
              playerSeats[secondIndex].playerSeatBounds,
            )).toBeGreaterThanOrEqual(diagnostics.seatGap - 0.01)
          }
        }

        const bottomAvatarCenter = playerSeats[0].avatarRect.y
          + playerSeats[0].avatarRect.height / 2
        const lowestAvatarCenter = Math.max(...playerSeats.map((seat) => (
          seat.avatarRect.y + seat.avatarRect.height / 2
        )))
        expect(bottomAvatarCenter).toBeCloseTo(lowestAvatarCenter, 2)
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

  it('returns deterministic render-safe geometry with at most two decimal places', () => {
    const first = expectReady(366, 596, 10)
    const second = expectReady(366, 596, 10)

    expect(first).toEqual(second)
    for (const value of numericValues(first)) {
      expect(Math.abs(value * 100 - Math.round(value * 100))).toBeLessThan(0.000_001)
    }
  })
})
