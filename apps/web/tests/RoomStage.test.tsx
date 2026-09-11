import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RoundTableStageLayout } from '@avalon/ui-layout'

import { RoomStage } from '../src/RoomStage'
import type { RoomPlayerModel } from '../src/room-screen-model'

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

function player(playerID: string, relativeSeatIndex: number): RoomPlayerModel {
  return {
    playerID,
    relativeSeatIndex,
    seatNumber: Number(playerID) + 1,
    name: `Player ${playerID}`,
    avatarID: 'merlin',
    occupied: true,
    connected: true,
    isCurrentPlayer: playerID === '0',
    isOwner: false,
    isLeader: false,
    isQuestMember: false,
    isSelected: false,
    isSelectedTarget: false,
    knownEvil: false,
    knownMerlinCandidate: false,
    visibleRole: null,
    voteStatus: null,
  }
}

const players = [player('1', 1), player('0', 0)]

describe('RoomStage', () => {
  it('binds the tabletop, center, and viewer-relative players to solver pixels', () => {
    const html = renderToStaticMarkup(
      <RoomStage
        ariaLabel="2 人测试圆桌"
        center={<span>桌心</span>}
        layout={layout}
        players={players}
        renderPlayer={(roomPlayer, seatLayout) => (
          <span
            data-avatar-left={seatLayout.avatarRect.x}
            data-name-top={seatLayout.nameRect.y}
            data-rendered-player={roomPlayer.playerID}
          >
            {roomPlayer.playerID}
          </span>
        )}
      />,
    )

    expect(html).toContain('data-round-table-shape="stadium"')
    expect(html).toContain('left:50px;top:30px;width:220px;height:300px')
    expect(html).toContain('left:84px;top:104px;width:152px;height:152px')
    expect(html).toMatch(/data-relative-seat-index="0"[^>]*style="left:120px;top:270px;width:80px;height:80px"[\s\S]*data-rendered-player="0"/)
    expect(html).toMatch(/data-relative-seat-index="1"[^>]*style="left:230px;top:120px;width:80px;height:80px"[\s\S]*data-rendered-player="1"/)
    expect(html.match(/data-room-player-layer="true"/g)).toHaveLength(1)
  })

  it('keeps unavailable layout inside the stage without rendering another shell', () => {
    const html = renderToStaticMarkup(
      <RoomStage
        ariaLabel="圆桌"
        center={<span>桌心</span>}
        layout={{ status: 'unavailable', reason: 'no-fitting-stage-layout' }}
        players={players}
        renderPlayer={() => <span>玩家</span>}
      />,
    )

    expect(html).toContain('data-stage-layout-status="unavailable"')
    expect(html).toContain('当前空间不足，无法安排圆桌，请调整窗口或旋转设备。')
    expect(html).not.toContain('桌心')
    expect(html).not.toContain('玩家')
    expect(html).not.toContain('data-room-screen="true"')
  })
})
