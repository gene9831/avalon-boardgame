import type {
  BoundaryGapSegment,
  Point,
  Rect,
} from './types'

export const PUBLIC_UNIT = 0.01
export const VALIDATION_TOLERANCE = 0.001

export function rectangleBoundaryGap(first: Rect, second: Rect): number {
  const firstCenterX = first.x + first.width / 2
  const firstCenterY = first.y + first.height / 2
  const secondCenterX = second.x + second.width / 2
  const secondCenterY = second.y + second.height / 2

  const horizontalClearance = Math.max(
    Math.abs(firstCenterX - secondCenterX) - (first.width + second.width) / 2,
    0,
  )
  const verticalClearance = Math.max(
    Math.abs(firstCenterY - secondCenterY) - (first.height + second.height) / 2,
    0,
  )

  return Math.hypot(horizontalClearance, verticalClearance)
}

function closestEdgeCoordinate(
  firstStart: number,
  firstLength: number,
  secondStart: number,
  secondLength: number,
): readonly [number, number] {
  const firstEnd = firstStart + firstLength
  const secondEnd = secondStart + secondLength

  if (firstEnd < secondStart) {
    return [firstEnd, secondStart]
  }
  if (secondEnd < firstStart) {
    return [firstStart, secondEnd]
  }

  const overlapStart = Math.max(firstStart, secondStart)
  const overlapEnd = Math.min(firstEnd, secondEnd)
  const midpoint = (overlapStart + overlapEnd) / 2
  return [midpoint, midpoint]
}

export function closestRectangleBoundarySegment(
  first: Rect,
  second: Rect,
): BoundaryGapSegment {
  const [startX, endX] = closestEdgeCoordinate(
    first.x,
    first.width,
    second.x,
    second.width,
  )
  const [startY, endY] = closestEdgeCoordinate(
    first.y,
    first.height,
    second.y,
    second.height,
  )

  const start: Point = { x: startX, y: startY }
  const end: Point = { x: endX, y: endY }

  return {
    start,
    end,
    distance: rectangleBoundaryGap(first, second),
  }
}

export function pointOnLeftHalfStadium(
  pathPosition: number,
  centerlineWidth: number,
  straightLength: number,
): Point {
  const radius = centerlineWidth / 2
  const leftHalfLength = Math.PI * radius + straightLength
  const clampedPathPosition = Math.min(Math.max(pathPosition, 0), leftHalfLength)
  if (radius === 0) {
    return {
      x: 0,
      y: straightLength / 2 - clampedPathPosition,
    }
  }

  const quarterArcLength = Math.PI * radius / 2

  if (clampedPathPosition <= quarterArcLength) {
    const angle = Math.PI / 2 + clampedPathPosition / radius
    const x = radius * Math.cos(angle)
    const y = straightLength / 2 + radius * Math.sin(angle)
    return {
      x: Math.abs(x) < 1e-12 ? 0 : x,
      y: Math.abs(y) < 1e-12 ? 0 : y,
    }
  }

  if (clampedPathPosition <= quarterArcLength + straightLength) {
    return {
      x: -radius,
      y: straightLength / 2 - (clampedPathPosition - quarterArcLength),
    }
  }

  const angle = Math.PI + (
    (clampedPathPosition - quarterArcLength - straightLength) / radius
  )
  const x = radius * Math.cos(angle)
  const y = -straightLength / 2 + radius * Math.sin(angle)
  return {
    x: Math.abs(x) < 1e-12 ? 0 : x,
    y: Math.abs(y) < 1e-12 ? 0 : y,
  }
}

export function quantize(value: number): number {
  return Math.round(value / PUBLIC_UNIT) * PUBLIC_UNIT
}

export function quantizeUp(value: number): number {
  const ticks = value / PUBLIC_UNIT
  const roundedTicks = Math.round(ticks)

  const roundedScale = Math.abs(roundedTicks)
  const ulpScale = Math.max(1, roundedScale)
  const gridTolerance = Number.EPSILON * ulpScale * 4

  if (Math.abs(ticks - roundedTicks) <= gridTolerance) {
    return roundedTicks * PUBLIC_UNIT
  }

  return Math.ceil(ticks) * PUBLIC_UNIT
}

export function rectFromCenter(center: Point, size: number): Rect {
  return {
    x: center.x - size / 2,
    y: center.y - size / 2,
    width: size,
    height: size,
  }
}

export function containsRect(container: Rect, item: Rect, tolerance = 0): boolean {
  return item.x >= container.x - tolerance
    && item.x + item.width <= container.x + container.width + tolerance
    && item.y >= container.y - tolerance
    && item.y + item.height <= container.y + container.height + tolerance
}
