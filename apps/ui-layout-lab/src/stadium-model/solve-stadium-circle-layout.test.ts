import { describe, expect, it } from 'vitest'

import {
  circleBoundaryGap,
  closestCircleBoundarySegment,
  containsCircle,
  pointDistance,
} from './geometry'
import { solveStadiumPlayerLayout } from './solve-stadium-player-layout'
import type { Circle, Point, Rect } from './types'

function centers(result: { playerCircles: readonly Circle[] }): readonly Point[] {
  return result.playerCircles.map(({ center }) => center)
}

function centerlineDistance(point: Point, bounds: Rect): number {
  const radius = bounds.width / 2
  const axisX = bounds.x + radius
  const topCenterY = bounds.y + radius
  const bottomCenterY = bounds.y + bounds.height - radius
  if (point.y <= topCenterY) {
    return Math.abs(Math.hypot(point.x - axisX, point.y - topCenterY) - radius)
  }
  if (point.y >= bottomCenterY) {
    return Math.abs(Math.hypot(point.x - axisX, point.y - bottomCenterY) - radius)
  }
  return Math.min(
    Math.abs(point.x - bounds.x),
    Math.abs(point.x - (bounds.x + bounds.width)),
  )
}

describe('stadium circle geometry', () => {
  it('measures center distance, circle-boundary gap, and closest boundary segment', () => {
    const first = { center: { x: 0, y: 0 }, radius: 10 }
    const second = { center: { x: 30, y: 40 }, radius: 15 }

    expect(pointDistance(first.center, second.center)).toBe(50)
    expect(circleBoundaryGap(first, second)).toBe(25)
    expect(closestCircleBoundarySegment(first, second)).toEqual({
      start: { x: 6, y: 8 },
      end: { x: 21, y: 28 },
      distance: 25,
    })
  })

  it('treats overlapping circles as zero boundary gap and contains tangent circles', () => {
    expect(circleBoundaryGap(
      { center: { x: 0, y: 0 }, radius: 10 },
      { center: { x: 6, y: 8 }, radius: 4 },
    )).toBe(0)
    expect(containsCircle(
      { x: 0, y: 0, width: 100, height: 80 },
      { center: { x: 10, y: 10 }, radius: 10 },
    )).toBe(true)
    expect(containsCircle(
      { x: 0, y: 0, width: 100, height: 80 },
      { center: { x: 9.99, y: 10 }, radius: 10 },
    )).toBe(false)
  })
})

describe('solveStadiumPlayerLayout circular contract', () => {
  const defaultInput = {
    maxStageWidth: 386,
    maxStageHeight: 482,
    playerCount: 5,
    avatarSize: 56,
    minimumGap: 4,
  } as const

  it('defaults center protection to disabled', () => {
    expect(solveStadiumPlayerLayout(defaultInput)).toEqual(solveStadiumPlayerLayout({
      ...defaultInput,
      centerProtectionRadius: 0,
    }))
  })

  it.each([
    -0.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects invalid center protection radius %#', (centerProtectionRadius) => {
    expect(solveStadiumPlayerLayout({
      ...defaultInput,
      centerProtectionRadius,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
  })

  it.each([
    { maxStageWidth: Number.NaN },
    { maxStageHeight: 0 },
    { maxStageWidth: 4_096.01 },
    { maxStageHeight: 800.01 },
    { playerCount: 4 },
    { playerCount: 5.5 },
    { avatarSize: 0 },
    { minimumGap: -0.01 },
  ])('rejects invalid base input %#', (override) => {
    expect(solveStadiumPlayerLayout({
      ...defaultInput,
      ...override,
    })).toEqual({ status: 'unavailable', reason: 'invalid-input' })
  })

  it('returns a clean circle result without rectangle or duplicate-center output', () => {
    const result = solveStadiumPlayerLayout(defaultInput)

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.playerCircles).toHaveLength(defaultInput.playerCount)
    expect(result.playerCircles.every(({ radius }) => radius === defaultInput.avatarSize)).toBe(true)
    expect('playerRects' in result).toBe(false)
    expect('playerCenters' in result).toBe(false)
  })

  it.each([5, 6])('fits %i 56px avatars around an 88px protection circle in 386x482', (playerCount) => {
    const result = solveStadiumPlayerLayout({
      ...defaultInput,
      playerCount,
      centerProtectionRadius: 88,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    const stageCenter = { x: defaultInput.maxStageWidth / 2, y: defaultInput.maxStageHeight / 2 }
    for (const player of result.playerCircles) {
      expect(pointDistance(stageCenter, player.center) - player.radius)
        .toBeGreaterThanOrEqual(88 - 0.001)
    }
  })

  it('reports a huge finite protection circle as non-fitting', () => {
    expect(solveStadiumPlayerLayout({
      ...defaultInput,
      centerProtectionRadius: 10_000,
    })).toEqual({ status: 'unavailable', reason: 'no-fitting-layout' })
  })

  it('rounds player and protection radii upward to the public grid', () => {
    const result = solveStadiumPlayerLayout({
      ...defaultInput,
      avatarSize: 48.001,
      centerProtectionRadius: 80.001,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.playerCircles.every(({ radius }) => radius === 48.01)).toBe(true)
    const protectionCenter = {
      x: result.centerlineBounds.x + result.centerlineBounds.width / 2,
      y: result.centerlineBounds.y + result.centerlineBounds.height / 2,
    }
    for (const player of result.playerCircles) {
      expect(pointDistance(protectionCenter, player.center) - player.radius)
        .toBeGreaterThanOrEqual(80.01 - 0.001)
    }
  })

  it.each([
    [5, 56],
    [6, 56],
    [7, 56],
    [8, 56],
    [9, 48],
    [10, 48],
  ])('fits %i players with %ipx avatars in the reference 386x482 stage', (playerCount, avatarSize) => {
    const result = solveStadiumPlayerLayout({
      ...defaultInput,
      playerCount,
      avatarSize,
    })

    expect(result.status).toBe('ready')
  })

  it('centers the vertical circle layout in a wider stage', () => {
    const result = solveStadiumPlayerLayout({
      maxStageWidth: 482,
      maxStageHeight: 386,
      playerCount: 5,
      avatarSize: 40,
      minimumGap: 4,
      centerProtectionRadius: 0,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.shape).toBe('circle')
    expect(result.occupiedBounds).toEqual({ x: 48, y: 0, width: 386, height: 386 })
    expect(result.centerlineBounds).toEqual({ x: 88, y: 40, width: 306, height: 306 })
    expect(result.playerCircles[0]).toEqual({ center: { x: 241, y: 346 }, radius: 40 })
  })

  it('uses the maximum-width circle immediately when it is feasible', () => {
    const result = solveStadiumPlayerLayout(defaultInput)

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.shape).toBe('circle')
    expect(result.stadiumStraightLength).toBe(0)
    expect(result.centerlineBounds.width).toBe(274)
  })

  it('selects a stadium that cannot be shortened by one public unit', () => {
    const input = {
      ...defaultInput,
      maxStageHeight: 800,
      playerCount: 8,
      centerProtectionRadius: 88,
    }
    const result = solveStadiumPlayerLayout(input)

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    expect(result.shape).toBe('stadium')
    expect(solveStadiumPlayerLayout({
      ...input,
      maxStageHeight: result.occupiedBounds.height - 0.01,
    })).toEqual({ status: 'unavailable', reason: 'no-fitting-layout' })
  })

  it('returns deterministic geometry quantized to the public grid', () => {
    const input = {
      ...defaultInput,
      playerCount: 10,
      avatarSize: 48,
    }
    const first = solveStadiumPlayerLayout(input)

    expect(solveStadiumPlayerLayout(input)).toEqual(first)
    expect(first.status).toBe('ready')
    if (first.status !== 'ready') throw new Error(first.reason)
    const numbers = JSON.stringify(first).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    expect(numbers.every((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)).toBe(true)
    expect(Math.min(...first.adjacentBoundaryGaps)).toBeGreaterThanOrEqual(input.minimumGap - 0.001)
  })

  it('reports the largest conservatively quantized centered protection circle', () => {
    const result = solveStadiumPlayerLayout({
      ...defaultInput,
      playerCount: 8,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    const tableCenter = {
      x: result.centerlineBounds.x + result.centerlineBounds.width / 2,
      y: result.centerlineBounds.y + result.centerlineBounds.height / 2,
    }
    const exactMaximum = Math.min(...result.playerCircles.map((player) => (
      pointDistance(tableCenter, player.center) - player.radius
    )))
    expect(result.maximumCenterProtectionRadius).toBeLessThanOrEqual(exactMaximum)
    expect(exactMaximum - result.maximumCenterProtectionRadius).toBeLessThan(0.01 + 1e-9)
    expect(result.maximumCenterProtectionRadius * 100)
      .toBeCloseTo(Math.round(result.maximumCenterProtectionRadius * 100), 8)
  })

  it.each([5, 6, 7, 8, 9, 10])('keeps %i player circles ordered, mirrored, and pairwise separated', (playerCount) => {
    const input = {
      maxStageWidth: 386,
      maxStageHeight: 800,
      playerCount,
      avatarSize: 56,
      minimumGap: 4,
      centerProtectionRadius: 88,
    }
    const result = solveStadiumPlayerLayout(input)

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error(result.reason)
    const playerCenters = centers(result)
    const axisX = input.maxStageWidth / 2
    const leftCount = playerCount % 2 === 0 ? (playerCount - 2) / 2 : (playerCount - 1) / 2
    expect(playerCenters[0].x).toBeCloseTo(axisX, 2)
    expect(playerCenters[0].y).toBe(Math.max(...playerCenters.map(({ y }) => y)))
    if (playerCount % 2 === 0) {
      expect(playerCenters[leftCount + 1].x).toBeCloseTo(axisX, 2)
      expect(playerCenters[leftCount + 1].y).toBe(Math.min(...playerCenters.map(({ y }) => y)))
    }
    for (let index = 1; index <= leftCount; index += 1) {
      const left = playerCenters[index]
      const right = playerCenters[playerCount - index]
      expect(left.x).toBeLessThan(axisX)
      expect(left.y).toBeLessThan(playerCenters[index - 1].y)
      expect(left.x + right.x).toBeCloseTo(2 * axisX, 2)
      expect(left.y).toBeCloseTo(right.y, 2)
    }
    for (let first = 0; first < playerCount; first += 1) {
      expect(centerlineDistance(playerCenters[first], result.centerlineBounds)).toBeLessThanOrEqual(0.001)
      for (let second = first + 1; second < playerCount; second += 1) {
        expect(circleBoundaryGap(result.playerCircles[first], result.playerCircles[second]))
          .toBeGreaterThanOrEqual(input.minimumGap - 0.001)
      }
    }
  })
})
