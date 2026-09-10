import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RoundTableStageLayout } from '@avalon/ui-layout'

import type { RoundTableSeat } from '../src/RoundTable'
import { SolvedRoundTableStage } from '../src/SolvedRoundTableStage'

const layout: RoundTableStageLayout = {
  status: 'ready',
  shape: 'stadium',
  tabletop: { x: 50, y: 30, width: 220, height: 300 },
  centerPanel: { x: 84, y: 104, width: 152, height: 152 },
  playerSeats: [
    {
      relativeSeatIndex: 0,
      playerSeatBounds: { x: 120, y: 270, width: 80, height: 80 },
      playerBoundaryCircle: { center: { x: 160, y: 302 }, radius: 40 },
      avatarRect: { x: 140, y: 282, width: 40, height: 40 },
      nameRect: { x: 120, y: 326, width: 80, height: 22 },
      avatarTopClearance: 12,
    },
    {
      relativeSeatIndex: 1,
      playerSeatBounds: { x: 230, y: 120, width: 80, height: 80 },
      playerBoundaryCircle: { center: { x: 270, y: 152 }, radius: 40 },
      avatarRect: { x: 250, y: 132, width: 40, height: 40 },
      nameRect: { x: 230, y: 176, width: 80, height: 22 },
      avatarTopClearance: 12,
    },
  ],
}

const seats = [
  { playerID: '1', relativeSeatIndex: 1 },
  { playerID: '0', relativeSeatIndex: 0 },
] as RoundTableSeat[]

describe('SolvedRoundTableStage', () => {
  it('binds tabletop, center, and viewer-relative seats to solver pixels', () => {
    const html = renderToStaticMarkup(
      <SolvedRoundTableStage
        ariaLabel="2 人测试圆桌"
        center={<span>桌心</span>}
        layout={layout}
        renderSeat={(seat) => <span data-rendered-player={seat.playerID}>{seat.playerID}</span>}
        seats={seats}
      />,
    )

    expect(html).toContain('data-round-table-shape="stadium"')
    expect(html).toContain('left:50px;top:30px;width:220px;height:300px')
    expect(html).toContain('left:84px;top:104px;width:152px;height:152px')
    expect(html).toMatch(/data-relative-seat-index="0"[^>]*style="left:120px;top:270px;width:80px;height:80px"[\s\S]*data-rendered-player="0"/)
    expect(html).toMatch(/data-relative-seat-index="1"[^>]*style="left:230px;top:120px;width:80px;height:80px"[\s\S]*data-rendered-player="1"/)
  })

  it('keeps an unavailable result inside the stage instead of changing shells', () => {
    const html = renderToStaticMarkup(
      <SolvedRoundTableStage
        ariaLabel="圆桌"
        center={<span>桌心</span>}
        layout={{ status: 'unavailable', reason: 'no-fitting-stage-layout' }}
        renderSeat={() => <span>玩家</span>}
        seats={seats}
      />,
    )

    expect(html).toContain('data-stage-layout-status="unavailable"')
    expect(html).toContain('当前空间不足，无法安排圆桌，请调整窗口或旋转设备。')
    expect(html).not.toContain('桌心')
    expect(html).not.toContain('玩家')
  })
})
