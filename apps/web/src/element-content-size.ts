export type ContentSize = Readonly<{
  width: number
  height: number
}>

export function normalizeContentSize(width: number, height: number): ContentSize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  }
}

export function readResizeObserverContentSize(entry: ResizeObserverEntry): ContentSize | null {
  const contentBoxSize = entry.contentBoxSize
  const logicalSize = Array.isArray(contentBoxSize)
    ? contentBoxSize[0]
    : contentBoxSize

  return logicalSize === undefined
    ? normalizeContentSize(entry.contentRect.width, entry.contentRect.height)
    : normalizeContentSize(logicalSize.inlineSize, logicalSize.blockSize)
}

export function contentSizesEqual(
  left: ContentSize | null,
  right: ContentSize | null,
): boolean {
  return left?.width === right?.width && left?.height === right?.height
}
