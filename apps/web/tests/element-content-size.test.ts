import { describe, expect, it } from 'vitest'

import {
  contentSizesEqual,
  normalizeContentSize,
  readResizeObserverContentSize,
} from '../src/element-content-size'

function resizeEntry({
  blockSize,
  contentRectHeight,
  contentRectWidth,
  inlineSize,
}: {
  blockSize?: number
  contentRectHeight: number
  contentRectWidth: number
  inlineSize?: number
}): ResizeObserverEntry {
  return {
    contentBoxSize: inlineSize === undefined || blockSize === undefined
      ? []
      : [{ inlineSize, blockSize }],
    contentRect: {
      height: contentRectHeight,
      width: contentRectWidth,
    },
  } as ResizeObserverEntry
}

describe('round-table content-box measurement', () => {
  it('uses logical contentBoxSize before the fallback rectangle', () => {
    expect(readResizeObserverContentSize(resizeEntry({
      blockSize: 358.6,
      contentRectHeight: 500,
      contentRectWidth: 600,
      inlineSize: 402.5,
    }))).toEqual({ width: 403, height: 359 })
  })

  it('falls back to contentRect when contentBoxSize is absent', () => {
    expect(readResizeObserverContentSize(resizeEntry({
      contentRectHeight: 434.6,
      contentRectWidth: 358.7,
    }))).toEqual({ width: 359, height: 435 })
  })

  it.each([
    [0, 435],
    [359, 0],
    [-1, 435],
    [Number.NaN, 435],
    [359, Number.POSITIVE_INFINITY],
  ])('rejects transient or invalid size %s × %s', (width, height) => {
    expect(normalizeContentSize(width, height)).toBeNull()
  })

  it('recognizes repeated normalized sizes', () => {
    expect(contentSizesEqual(
      { width: 359, height: 435 },
      { width: 359, height: 435 },
    )).toBe(true)
    expect(contentSizesEqual(
      { width: 359, height: 435 },
      { width: 403, height: 359 },
    )).toBe(false)
  })
})
