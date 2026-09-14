import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RoomLayoutSnapshot } from '../src/useRoomLayout'
import { RoomLayoutDiagnostics } from '../src/RoomLayoutDiagnostics'

const snapshot: RoomLayoutSnapshot = {
  viewportSize: { width: 375, height: 667 }, canvasSize: { width: 375, height: 667 },
  stageSize: { width: 359, height: 435 },
  stageLayout: {
    status: 'ready', shape: 'circle', tabletop: { x: 20, y: 40, width: 319, height: 319 },
    centerPanel: { x: 103.5, y: 123.5, width: 152, height: 152 },
    playerSeats: [{ relativeSeatIndex: 0, playerSeatBounds: { x: 130, y: 340, width: 90, height: 90 }, playerBoundaryCircle: { center: { x: 175, y: 375 }, radius: 45 }, avatarRect: { x: 151, y: 351, width: 48, height: 48 }, nameRect: { x: 130, y: 405, width: 90, height: 22 }, avatarTopClearance: 11 }],
  },
  diagnostics: {
    roundTableFrame: { x: 0, y: 0, width: 359, height: 435 }, roundTableFootprint: { x: 20, y: 40, width: 319, height: 319 },
    placementGuide: { bounds: { x: 20, y: 40, width: 319, height: 319 }, stadiumStraightLength: 0 },
    centerProtectionCircle: { center: { x: 179.5, y: 199.5 }, radius: 80 }, seatGap: 8, adjacentBoundaryGaps: [8], tabletopCenterOffsetY: 0,
  },
}

describe('RoomLayoutDiagnostics', () => {
  it('reports only geometry metrics and draws non-interactive supplied boundaries', () => {
    const html = renderToStaticMarkup(<RoomLayoutDiagnostics mode="geometry" playerCount={5} safeArea={{ top: 0, right: 1, bottom: 12, left: 1 }} snapshot={snapshot} />)
    expect(html).toContain('viewport 375×667')
    expect(html).toContain('canvas 375×667')
    expect(html).toContain('stage 359×435')
    expect(html).toContain('avatar 48px')
    expect(html).toContain('circle')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('pointer-events-none')
    expect(html).toContain('data-layout-boundary="center-protection"')
    expect(html).not.toMatch(/merlin|credential|Alice|pending/i)
  })
})
