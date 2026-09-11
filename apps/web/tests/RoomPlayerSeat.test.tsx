import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSeatLayout } from '@avalon/ui-layout'

import { RoomPlayerSeat } from '../src/RoomPlayerSeat'
import type { RoomPlayerModel } from '../src/room-screen-model'

const layout: PlayerSeatLayout = {
  relativeSeatIndex: 0,
  playerSeatBounds: { x: 100, y: 200, width: 92, height: 88 },
  playerBoundaryCircle: { center: { x: 146, y: 234 }, radius: 46 },
  avatarRect: { x: 122, y: 210, width: 48, height: 48 },
  nameRect: { x: 100, y: 264, width: 92, height: 22 },
  avatarTopClearance: 10,
}

const player: RoomPlayerModel = {
  playerID: '0',
  relativeSeatIndex: 0,
  seatNumber: 1,
  name: 'Alice',
  avatarID: 'merlin',
  occupied: true,
  connected: true,
  isCurrentPlayer: false,
  isOwner: false,
  isLeader: true,
  isQuestMember: false,
  isSelected: false,
  isSelectedTarget: false,
  knownEvil: false,
  knownMerlinCandidate: false,
  visibleRole: null,
  voteStatus: null,
}

describe('RoomPlayerSeat', () => {
  it('uses one semantic control whose pointer targets are only avatar and name', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled={false}
        interactionMode="selectTeam"
        layout={layout}
        onActivate={vi.fn()}
        player={player}
      />,
    )

    expect(html).toContain('aria-label="选择 Alice 加入任务队伍，队长"')
    expect(html.match(/data-seat-pointer-target=/g)).toHaveLength(2)
    expect(html).toContain('data-seat-pointer-target="avatar"')
    expect(html).toContain('data-seat-pointer-target="name"')
    expect(html).toContain('data-seat-decoration="leader"')
  })

  it('renders a non-button group when the seat has no interaction', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled
        interactionMode="none"
        layout={layout}
        onActivate={vi.fn()}
        player={player}
      />,
    )

    expect(html).toContain('role="group"')
    expect(html).not.toContain('<button')
  })

  it('announces an empty lobby destination and preserves its full visual label', () => {
    const emptyPlayer = {
      ...player,
      playerID: '1',
      seatNumber: 2,
      name: '',
      occupied: false,
      connected: false,
      isLeader: false,
    }
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled={false}
        interactionMode="changeSeat"
        layout={layout}
        onActivate={vi.fn()}
        player={emptyPlayer}
      />,
    )

    expect(html).toContain('aria-label="移至 2 号空座位"')
    expect(html).toContain('title="2. 空座位"')
    expect(html).toContain('>2. 空座位</span>')
    expect(html).toContain('data-connected="false"')
  })

  it('keeps long player names in the title and accessible name', () => {
    const longNamePlayer = { ...player, name: '暮鸦贤者不会被截断于辅助文本' }
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled={false}
        interactionMode="selectAssassinationTarget"
        layout={layout}
        onActivate={vi.fn()}
        player={longNamePlayer}
      />,
    )

    expect(html).toContain('aria-label="选择 暮鸦贤者不会被截断于辅助文本 作为刺杀目标，队长"')
    expect(html).toContain('title="1. 暮鸦贤者不会被截断于辅助文本"')
  })
})
