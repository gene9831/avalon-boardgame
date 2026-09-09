import { describe, expect, it } from 'vitest'

import {
  closestRectangleBoundarySegment,
  containsRect,
  pointOnLeftHalfStadium,
  quantize,
  quantizeUp,
  rectangleBoundaryGap,
  rectFromCenter,
} from './geometry'
import { solveStadiumPlayerLayout } from './solve-stadium-player-layout'
import { solveStadiumRectangleLayout } from './solve-stadium-rectangle-layout'

describe('stadium rectangle geometry', () => {
  it.each([
    ['horizontal', { x: 0, y: 0, width: 10, height: 10 }, { x: 14, y: 2, width: 10, height: 10 }, 4],
    ['vertical', { x: 0, y: 0, width: 10, height: 10 }, { x: 2, y: 16, width: 10, height: 10 }, 6],
    ['diagonal', { x: 0, y: 0, width: 10, height: 10 }, { x: 13, y: 14, width: 10, height: 10 }, 5],
    ['overlap', { x: 0, y: 0, width: 10, height: 10 }, { x: 4, y: 4, width: 10, height: 10 }, 0],
  ] as const)('measures the %s rectangle-boundary gap', (_name, first, second, expected) => {
    expect(rectangleBoundaryGap(first, second)).toBe(expected)
    expect(closestRectangleBoundarySegment(first, second).distance).toBe(expected)
  })

  it('traverses the left half from six o’clock to twelve o’clock', () => {
    const halfLength = Math.PI * 50 + 80
    expect(pointOnLeftHalfStadium(0, 100, 80)).toEqual({ x: 0, y: 90 })
    expect(pointOnLeftHalfStadium(halfLength, 100, 80).x).toBeCloseTo(0, 10)
    expect(pointOnLeftHalfStadium(halfLength, 100, 80).y).toBeCloseTo(-90, 10)
    expect(pointOnLeftHalfStadium(40, 0, 80)).toEqual({ x: 0, y: 0 })
  })

  it('returns the exact closest boundary segment with distance equal to rectangle gap', () => {
    const cases = [
      {
        first: { x: 0, y: 0, width: 10, height: 10 },
        second: { x: 14, y: 2, width: 10, height: 10 },
        expectedStart: { x: 10, y: 6 },
        expectedEnd: { x: 14, y: 6 },
        expectedDistance: 4,
      },
      {
        first: { x: 0, y: 0, width: 10, height: 10 },
        second: { x: 2, y: 16, width: 10, height: 10 },
        expectedStart: { x: 6, y: 10 },
        expectedEnd: { x: 6, y: 16 },
        expectedDistance: 6,
      },
      {
        first: { x: 0, y: 0, width: 10, height: 10 },
        second: { x: 13, y: 14, width: 10, height: 10 },
        expectedStart: { x: 10, y: 10 },
        expectedEnd: { x: 13, y: 14 },
        expectedDistance: 5,
      },
      {
        first: { x: 0, y: 0, width: 10, height: 10 },
        second: { x: 4, y: 4, width: 10, height: 10 },
        expectedStart: { x: 7, y: 7 },
        expectedEnd: { x: 7, y: 7 },
        expectedDistance: 0,
      },
    ] as const

    for (const {
      first,
      second,
      expectedStart,
      expectedEnd,
      expectedDistance,
    } of cases) {
      const segment = closestRectangleBoundarySegment(first, second)
      expect(segment.distance).toBe(expectedDistance)
      expect(segment.start).toEqual(expectedStart)
      expect(segment.end).toEqual(expectedEnd)
      expect(
        Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y),
      ).toBeCloseTo(expectedDistance, 12)
    }
  })

  it('clamps stadium path position to the left-half interval', () => {
    const halfLength = Math.PI * 50 + 80
    expect(pointOnLeftHalfStadium(-999, 100, 80)).toEqual({ x: 0, y: 90 })
    expect(pointOnLeftHalfStadium(halfLength + 12, 100, 80))
      .toEqual(pointOnLeftHalfStadium(halfLength, 100, 80))
  })

  it('supports public helpers for quantization and primitive shapes', () => {
    const halfLength = Math.PI * 50 + 80
    expect(pointOnLeftHalfStadium(halfLength + 12, 100, 80)).toEqual(pointOnLeftHalfStadium(halfLength, 100, 80))

    expect(quantize(1.234)).toBe(1.23)
    expect(quantize(1.236)).toBe(1.24)

    expect(quantizeUp(0.07)).toBe(0.07)
    expect(quantizeUp(0.28)).toBe(0.28)
    expect(quantizeUp(0.07000000000000001)).toBe(0.07)
    expect(quantizeUp(0.070000000001)).toBe(0.08)
    expect(quantizeUp(0.271)).toBe(0.28)

    expect(rectFromCenter({ x: 10, y: 20 }, 4)).toEqual({ x: 8, y: 18, width: 4, height: 4 })

    const container = { x: 0, y: 0, width: 100, height: 100 }
    expect(containsRect(container, { x: 0, y: 0, width: 100, height: 100 })).toBe(true)
    expect(containsRect(container, { x: -0.0005, y: 0, width: 10, height: 10 })).toBe(false)
    expect(containsRect(container, { x: -0.0005, y: 0, width: 10, height: 10 }, 0.001)).toBe(true)
  })
})

describe('solveStadiumPlayerLayout', () => {
  it('reuses rectangle core with equivalent 2x avatar size', () => {
    expect(solveStadiumRectangleLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 5,
      playerRectangleSize: 112,
      minimumGap: 4,
    })).toEqual(solveStadiumPlayerLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 5,
      avatarSize: 56,
      minimumGap: 4,
    }))
  })

  function rectanglesHaveNoInteriorOverlap(
    first: { x: number; y: number; width: number; height: number },
    second: { x: number; y: number; width: number; height: number },
  ): boolean {
    return first.x + first.width <= second.x
      || second.x + second.width <= first.x
      || first.y + first.height <= second.y
      || second.y + second.height <= first.y
  }

  function publicCenterlineDistance(
    point: { x: number; y: number },
    bounds: { x: number; y: number; width: number; height: number },
  ): number {
    const radius = bounds.width / 2
    const axisX = bounds.x + radius
    const topCenterY = bounds.y + radius
    const bottomCenterY = bounds.y + bounds.height - radius
    if (point.y <= topCenterY) return Math.abs(Math.hypot(point.x - axisX, point.y - topCenterY) - radius)
    if (point.y >= bottomCenterY) return Math.abs(Math.hypot(point.x - axisX, point.y - bottomCenterY) - radius)
    return Math.min(Math.abs(point.x - bounds.x), Math.abs(point.x - (bounds.x + bounds.width)))
  }

  it.each([
    { maxStageWidth: Number.NaN, maxStageHeight: 482, playerCount: 5, avatarSize: 56, minimumGap: 4 },
    { maxStageWidth: 386, maxStageHeight: 0, playerCount: 5, avatarSize: 56, minimumGap: 4 },
    { maxStageWidth: 4_096.01, maxStageHeight: 482, playerCount: 5, avatarSize: 56, minimumGap: 4 },
    { maxStageWidth: 240, maxStageHeight: 800.01, playerCount: 5, avatarSize: 56, minimumGap: 4 },
    { maxStageWidth: 386, maxStageHeight: 482, playerCount: 4, avatarSize: 56, minimumGap: 4 },
    { maxStageWidth: 386, maxStageHeight: 482, playerCount: 5.5, avatarSize: 56, minimumGap: 4 },
    { maxStageWidth: 386, maxStageHeight: 482, playerCount: 5, avatarSize: 0, minimumGap: 4 },
    { maxStageWidth: 386, maxStageHeight: 482, playerCount: 5, avatarSize: 56, minimumGap: -0.01 },
  ])('rejects invalid input %#', (input) => {
    expect(solveStadiumPlayerLayout(input)).toEqual({ status: 'unavailable', reason: 'invalid-input' })
  })

  it('treats a zero-width centerline as legal but non-fitting', () => {
    expect(solveStadiumPlayerLayout({
      maxStageWidth: 112, maxStageHeight: 800, playerCount: 5, avatarSize: 56, minimumGap: 4,
    })).toEqual({ status: 'unavailable', reason: 'no-fitting-layout' })
  })

  it('places zero-gap players at first non-overlapping separations', () => {
    const result = solveStadiumPlayerLayout({
      maxStageWidth: 386, maxStageHeight: 482, playerCount: 5, avatarSize: 56, minimumGap: 0,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    for (let first = 0; first < result.playerRects.length; first += 1) {
      for (let second = first + 1; second < result.playerRects.length; second += 1) {
        expect(rectanglesHaveNoInteriorOverlap(result.playerRects[first], result.playerRects[second])).toBe(true)
      }
    }
  })

  it.each([5, 6, 7, 8, 9, 10])('keeps %i players ordered, mirrored, and pairwise separated', (playerCount) => {
    const input = { maxStageWidth: 240, maxStageHeight: 800, playerCount, avatarSize: 56, minimumGap: 4 }
    const result = solveStadiumPlayerLayout(input)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)

    const axisX = input.maxStageWidth / 2
    const leftCount = playerCount % 2 === 0 ? (playerCount - 2) / 2 : (playerCount - 1) / 2
    expect(result.playerRects).toHaveLength(playerCount)
    expect(result.playerCenters).toHaveLength(playerCount)
    expect(result.playerCenters[0]).toMatchObject({ x: axisX })
    expect(result.playerCenters[0].y).toBe(Math.max(...result.playerCenters.map(({ y }) => y)))
    if (playerCount % 2 === 0) {
      expect(result.playerCenters[leftCount + 1]).toMatchObject({ x: axisX })
      expect(result.playerCenters[leftCount + 1].y).toBe(Math.min(...result.playerCenters.map(({ y }) => y)))
    }
    for (let index = 1; index <= leftCount; index += 1) {
      const left = result.playerCenters[index]
      const right = result.playerCenters[playerCount - index]
      expect(left.x).toBeLessThanOrEqual(axisX)
      expect(left.y).toBeLessThan(result.playerCenters[index - 1].y)
      expect(left.x + right.x).toBeCloseTo(2 * axisX, 2)
      expect(left.y).toBeCloseTo(right.y, 2)
    }
    for (let first = 0; first < playerCount; first += 1) {
      for (let second = first + 1; second < playerCount; second += 1) {
        expect(rectangleBoundaryGap(result.playerRects[first], result.playerRects[second]))
          .toBeGreaterThanOrEqual(input.minimumGap - 0.001)
      }
    }
  })

  it('returns the maximum-width circle immediately when it fits', () => {
    const result = solveStadiumPlayerLayout({
      maxStageWidth: 386, maxStageHeight: 482, playerCount: 5, avatarSize: 56, minimumGap: 4,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.shape).toBe('circle')
    expect(result.stadiumStraightLength).toBe(0)
    expect(result.centerlineBounds.width).toBe(274)
    expect(result.occupiedBounds.width).toBe(386)
    expect(result.playerCenters.every((center) => (
      publicCenterlineDistance(center, result.centerlineBounds) <= 0.001
    ))).toBe(true)
  })

  it.each([
    [5, 381.01],
    [6, 460],
    [7, 497.01],
    [8, 576],
    [9, 613.01],
    [10, 692],
  ])('cannot shorten the selected %i-player tight stadium envelope by one centipixel', (playerCount, maxStageHeight) => {
    const input = { maxStageWidth: 240, maxStageHeight, playerCount, avatarSize: 56, minimumGap: 4 }
    const result = solveStadiumPlayerLayout(input)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.shape).toBe('stadium')
    expect(solveStadiumPlayerLayout({
      ...input,
      maxStageHeight: result.occupiedBounds.height - 0.01,
    })).toEqual({ status: 'unavailable', reason: 'no-fitting-layout' })
  })

  it('returns quantized, uniformly closed, deterministic geometry', () => {
    const input = { maxStageWidth: 240, maxStageHeight: 800, playerCount: 10, avatarSize: 56, minimumGap: 4 }
    const first = solveStadiumPlayerLayout(input)
    expect(solveStadiumPlayerLayout(input)).toEqual(first)
    expect(first.status).toBe('ready')
    if (first.status !== 'ready') throw new Error(first.reason)
    const numbers = JSON.stringify(first).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    expect(numbers.every((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)).toBe(true)
    expect(Math.max(...first.adjacentBoundaryGaps) - Math.min(...first.adjacentBoundaryGaps)).toBeLessThanOrEqual(0.02)
    expect(Math.min(...first.adjacentBoundaryGaps)).toBeGreaterThanOrEqual(input.minimumGap - 0.001)
    expect(first.playerCenters.every((center) => (
      publicCenterlineDistance(center, first.centerlineBounds) <= 0.001
    ))).toBe(true)
  })

  it.each([
    { maxStageWidth: 111.99, maxStageHeight: 800, playerCount: 5, avatarSize: 56, minimumGap: 4 },
    { maxStageWidth: 386, maxStageHeight: 385.99, playerCount: 5, avatarSize: 56, minimumGap: 4 },
  ])('reports legal but impossible stage envelopes as non-fitting', (input) => {
    expect(solveStadiumPlayerLayout(input)).toEqual({ status: 'unavailable', reason: 'no-fitting-layout' })
  })
})

describe('solveStadiumRectangleLayout', () => {
  it.each([0, -1, Number.NaN])('rejects invalid rectangle size %#', (playerRectangleSize) => {
    expect(solveStadiumRectangleLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 5,
      playerRectangleSize,
      minimumGap: 4,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
  })

  it('returns no-fitting-layout when stage is too small for large rectangles', () => {
    expect(solveStadiumRectangleLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 5,
      playerRectangleSize: 1000,
      minimumGap: 4,
    })).toEqual({ status: 'unavailable', reason: 'no-fitting-layout' })
  })

  it('returns ready layouts with exact player rectangles and minimum boundary gaps', () => {
    const result = solveStadiumRectangleLayout({
      maxStageWidth: 386,
      maxStageHeight: 482,
      playerCount: 5,
      playerRectangleSize: 112,
      minimumGap: 4,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.playerRects).toHaveLength(5)
    expect(result.adjacentBoundaryGaps).toHaveLength(5)
    expect(Math.min(...result.adjacentBoundaryGaps)).toBeGreaterThanOrEqual(4 - 0.001)
  })
})
