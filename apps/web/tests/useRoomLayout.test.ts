import { describe, expect, it } from 'vitest'
import type { DetailedRoundTableStageLayoutResult } from '@avalon/ui-layout/diagnostics'

import { resolveRoomLayoutSnapshot } from '../src/useRoomLayout'

describe('resolveRoomLayoutSnapshot', () => {
  it('preserves measured boxes and uses one detailed result for rendering and diagnostics', () => {
    const detailedResult: DetailedRoundTableStageLayoutResult = {
      status: 'ready',
      shape: 'circle',
      tabletop: { x: 20, y: 20, width: 319, height: 319 },
      centerPanel: { x: 103.5, y: 141.5, width: 152, height: 152 },
      playerSeats: [],
      diagnostics: {
        roundTableFrame: { x: 0, y: 0, width: 359, height: 435 },
        roundTableFootprint: { x: 20, y: 20, width: 319, height: 319 },
        placementGuide: {
          bounds: { x: 20, y: 20, width: 319, height: 319 },
          stadiumStraightLength: 0,
        },
        centerProtectionCircle: { center: { x: 179.5, y: 217.5 }, radius: 80 },
        seatGap: 8,
        adjacentBoundaryGaps: [],
        tabletopCenterOffsetY: 0,
      },
    }

    const snapshot = resolveRoomLayoutSnapshot({
      viewportSize: { width: 375, height: 667 },
      canvasSize: { width: 375, height: 667 },
      stageSize: { width: 359, height: 435 },
      playerCount: 5,
      detailedResult,
    })

    expect(snapshot.viewportSize).toEqual({ width: 375, height: 667 })
    expect(snapshot.canvasSize).toEqual({ width: 375, height: 667 })
    expect(snapshot.stageSize).toEqual({ width: 359, height: 435 })
    expect(snapshot.stageLayout).toBe(detailedResult)
    expect(snapshot.diagnostics).toBe(detailedResult.diagnostics)
  })
})
