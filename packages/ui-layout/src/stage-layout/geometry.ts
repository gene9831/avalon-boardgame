import type { Point, Rect } from './types'

const RENDER_PRECISION = 100

export function clamp(minimum: number, value: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum))
}

export function quantize(value: number): number {
  return Math.round(value * RENDER_PRECISION) / RENDER_PRECISION
}

export function quantizePoint(point: Point): Point {
  return { x: quantize(point.x), y: quantize(point.y) }
}

export function createRect(x: number, y: number, width: number, height: number): Rect {
  return {
    x: quantize(x),
    y: quantize(y),
    width: quantize(width),
    height: quantize(height),
  }
}

export function containsRect(container: Rect, item: Rect, tolerance = 0.011): boolean {
  return item.x >= container.x - tolerance
    && item.y >= container.y - tolerance
    && item.x + item.width <= container.x + container.width + tolerance
    && item.y + item.height <= container.y + container.height + tolerance
}

export function pointToRectDistance(point: Point, rectangle: Rect): number {
  const horizontalDistance = Math.max(
    rectangle.x - point.x,
    0,
    point.x - (rectangle.x + rectangle.width),
  )
  const verticalDistance = Math.max(
    rectangle.y - point.y,
    0,
    point.y - (rectangle.y + rectangle.height),
  )
  return Math.hypot(horizontalDistance, verticalDistance)
}

export function unionRects(rectangles: readonly Rect[]): Rect {
  const left = Math.min(...rectangles.map((rectangle) => rectangle.x))
  const top = Math.min(...rectangles.map((rectangle) => rectangle.y))
  const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width))
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height))
  return createRect(left, top, right - left, bottom - top)
}
