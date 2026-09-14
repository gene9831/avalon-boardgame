export const MAX_STAGE_WIDTH = 4_096
export const MAX_STAGE_HEIGHT = 800

export function hasSupportedStageDimensions(width: number, height: number): boolean {
  return Number.isFinite(width)
    && width > 0
    && width <= MAX_STAGE_WIDTH
    && Number.isFinite(height)
    && height > 0
    && height <= MAX_STAGE_HEIGHT
}
