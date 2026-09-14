// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const layoutHarness = vi.hoisted(() => ({
  canvasRef: () => {},
  snapshot: {
    canvasSize: { height: 435, width: 359 },
    diagnostics: {
      adjacentBoundaryGaps: [],
      centerProtectionCircle: { center: { x: 179.5, y: 217.5 }, radius: 80 },
      placementGuide: { bounds: { height: 319, width: 319, x: 20, y: 20 }, stadiumStraightLength: 0 },
      roundTableFootprint: { height: 319, width: 319, x: 20, y: 20 },
      roundTableFrame: { height: 435, width: 359, x: 0, y: 0 },
      seatGap: 8,
      tabletopCenterOffsetY: 0,
    },
    stageLayout: {
      centerPanel: { height: 152, width: 152, x: 103.5, y: 141.5 },
      playerSeats: [], shape: 'circle', status: 'ready', tabletop: { height: 319, width: 319, x: 20, y: 20 },
    },
    stageSize: { height: 435, width: 359 },
    viewportSize: { height: 667, width: 375 },
  },
  stageRef: () => {},
}))

vi.mock('../src/useRoomLayout', () => ({
  useRoomLayout: () => ({
    canvasRef: layoutHarness.canvasRef,
    snapshot: layoutHarness.snapshot,
    stageRef: layoutHarness.stageRef,
  }),
}))

import { ObservedRoomScreen } from '../src/ObservedRoomScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('ObservedRoomScreen diagnostics', () => {
  it('mounts ready geometry diagnostics inside the measured stage host', async () => {
    await act(async () => {
      root.render(
        <ObservedRoomScreen
          actions={null}
          diagnosticsMode="geometry"
          scene={{
            kind: 'gameResult', matchID: 'ABC123456', playerCount: 5, players: [], questProgress: [],
            winner: 'good', reason: '三次任务成功', questScore: '3 : 0',
          }}
          slots={{ back: null, toolbar: null }}
        />,
      )
    })

    const hosts = container.querySelectorAll<HTMLElement>('[data-room-layout-diagnostics-host="true"]')
    const geometrySVGs = container.querySelectorAll<SVGElement>('svg.room-layout-geometry')

    expect(hosts).toHaveLength(1)
    expect(geometrySVGs).toHaveLength(1)
    const host = hosts[0]
    const geometrySVG = geometrySVGs[0]
    expect(host).toBeDefined()
    expect(geometrySVG).toBeDefined()
    expect(host?.contains(geometrySVG ?? null)).toBe(true)
    expect(Array.from(geometrySVGs).filter((svg) => !host?.contains(svg))).toHaveLength(0)
  })
})
