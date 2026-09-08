import { describe, expect, it } from 'vitest'

import { solveRoomLayout } from './index'
import type { Rect, VerticalRoomLayout } from './index'

function expectReady(width: number, height: number, playerCount: number): VerticalRoomLayout {
  const result = solveRoomLayout({ width, height, playerCount })
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

describe('vertical room layout', () => {
  it.each([
    { width: 375, height: 667, avatarDiameter: 40, shape: 'stadium' },
    { width: 390, height: 844, avatarDiameter: 48, shape: 'stadium' },
    { width: 430, height: 932, avatarDiameter: 56, shape: 'stadium' },
  ] as const)(
    'keeps the largest fitting ten-player tier at $width×$height',
    ({ width, height, avatarDiameter, shape }) => {
      const layout = expectReady(width, height, 10)
      expect(layout.roundTable).toMatchObject({ avatarDiameter, shape })
    },
  )

  it.each([5, 6, 7, 8, 9, 10])(
    'keeps every component and seat boundary safe for %i players',
    (playerCount) => {
      for (const [width, height] of [[375, 667], [390, 844], [430, 932]]) {
        const layout = expectReady(width, height, playerCount)
        const { playerSeats, roundTable } = layout

        expect(playerSeats).toHaveLength(playerCount)
        for (const seat of playerSeats) {
          expect(contains(layout.regions.safeStage, seat.playerSeatBounds)).toBe(true)
          expect(contains(seat.playerSeatBounds, seat.avatarRect)).toBe(true)
          expect(contains(seat.playerSeatBounds, seat.nameRect)).toBe(true)
          expect(seat.avatarTopClearance).toBeGreaterThan(0)
          expect(seat).not.toHaveProperty('crownRect')
          expect(seat).not.toHaveProperty('statusMarkerRect')
        }

        for (let firstIndex = 0; firstIndex < playerSeats.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < playerSeats.length; secondIndex += 1) {
            expect(boundaryGap(
              playerSeats[firstIndex].playerSeatBounds,
              playerSeats[secondIndex].playerSeatBounds,
            )).toBeGreaterThanOrEqual(roundTable.seatGap - 0.01)
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

  it('returns deterministic render-safe geometry with at most two decimal places', () => {
    const first = expectReady(390, 844, 10)
    const second = expectReady(390, 844, 10)

    expect(first).toEqual(second)
    for (const value of numericValues(first)) {
      expect(Math.abs(value * 100 - Math.round(value * 100))).toBeLessThan(0.000_001)
    }
  })
})
