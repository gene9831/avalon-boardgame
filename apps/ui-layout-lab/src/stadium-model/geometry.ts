import type {
  BoundaryGapSegment,
  Circle,
  Point,
  Rect,
} from './types'

export const PUBLIC_UNIT = 0.01
export const VALIDATION_TOLERANCE = 0.001

export function pointDistance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

export function circleBoundaryGap(first: Circle, second: Circle): number {
  return Math.max(pointDistance(first.center, second.center) - first.radius - second.radius, 0)
}

export function closestCircleBoundarySegment(
  first: Circle,
  second: Circle,
): BoundaryGapSegment {
  const centerDistance = pointDistance(first.center, second.center)
  const unitX = centerDistance === 0 ? 1 : (second.center.x - first.center.x) / centerDistance
  const unitY = centerDistance === 0 ? 0 : (second.center.y - first.center.y) / centerDistance
  const firstBoundary = {
    x: first.center.x + unitX * first.radius,
    y: first.center.y + unitY * first.radius,
  }
  const secondBoundary = {
    x: second.center.x - unitX * second.radius,
    y: second.center.y - unitY * second.radius,
  }
  const distance = circleBoundaryGap(first, second)
  if (distance === 0) {
    const contact = {
      x: (firstBoundary.x + secondBoundary.x) / 2,
      y: (firstBoundary.y + secondBoundary.y) / 2,
    }
    return { start: contact, end: contact, distance }
  }
  return { start: firstBoundary, end: secondBoundary, distance }
}

export function containsCircle(container: Rect, circle: Circle, tolerance = 0): boolean {
  return circle.center.x - circle.radius >= container.x - tolerance
    && circle.center.x + circle.radius <= container.x + container.width + tolerance
    && circle.center.y - circle.radius >= container.y - tolerance
    && circle.center.y + circle.radius <= container.y + container.height + tolerance
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

export function containsRect(container: Rect, item: Rect, tolerance = 0): boolean {
  return item.x >= container.x - tolerance
    && item.x + item.width <= container.x + container.width + tolerance
    && item.y >= container.y - tolerance
    && item.y + item.height <= container.y + container.height + tolerance
}
