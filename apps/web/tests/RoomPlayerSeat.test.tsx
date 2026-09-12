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
  showRoleReveal: false,
  voteStatus: null,
}

describe('RoomPlayerSeat', () => {
  it('labels an identity recognition target without replacing the player avatar', () => {
    const props = {
      disabled: true,
      interactionMode: 'none' as const,
      layout,
      onActivate: vi.fn(),
      player: { ...player, isLeader: false },
      recognition: { label: '同伴' as const, state: 'target' as const, tone: 'ally' as const },
    }
    const html = renderToStaticMarkup(<RoomPlayerSeat {...props} />)

    expect(html).toContain('data-recognition-seat-state="target"')
    expect(html).toContain('data-recognition-tone="ally"')
    expect(html).toContain('data-identity-recognition-label="true"')
    expect(html).toContain('>同伴</span>')
    expect(html).toContain('aria-label="1. Alice，同伴"')
    expect(html).not.toContain('data-room-role-revealed="true"')
  })

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

  it('marks a locally selected quest member and announces that activating it cancels selection', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled={false}
        interactionMode="selectTeam"
        layout={layout}
        onActivate={vi.fn()}
        player={{ ...player, isSelected: true }}
      />,
    )

    expect(html).toContain('aria-label="取消选择 Alice，队长"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('data-seat-decoration="selected"')
    expect(html).toMatch(/<svg[^>]*fill="#0f172a"[^>]*class="lucide lucide-circle-check"/)
    expect(html).toMatch(/data-seat-decoration="leader"[^>]*>.*lucide-crown/s)
    expect(html).toMatch(/<svg[^>]*fill="currentColor"[^>]*class="lucide lucide-crown"/)
  })

  it('uses the shared people icon for a confirmed quest member', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled
        interactionMode="none"
        layout={layout}
        onActivate={vi.fn()}
        player={{ ...player, isQuestMember: true, isLeader: false }}
      />,
    )

    expect(html).toMatch(/data-seat-decoration="quest-member"[^>]*>.*lucide-user-round/s)
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

  it('keeps occupied lobby seats as noninteractive groups while an empty destination is actionable', () => {
    const occupiedHtml = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled
        interactionMode="changeSeat"
        layout={layout}
        onActivate={vi.fn()}
        player={player}
      />,
    )
    const emptyHtml = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled={false}
        interactionMode="changeSeat"
        layout={layout}
        onActivate={vi.fn()}
        player={{ ...player, playerID: '1', seatNumber: 2, name: '', occupied: false, connected: false, isLeader: false }}
      />,
    )

    expect(occupiedHtml).toContain('role="group"')
    expect(occupiedHtml).not.toContain('<button')
    expect(emptyHtml).toContain('<button')
    expect(emptyHtml).toContain('aria-label="移至 2 号空座位"')
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
    expect(html).toContain('data-seat-state="empty"')
    expect(html).toContain('>2</span>')
    expect(html).toContain('>空位</span>')
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
    expect(html).toContain('title="暮鸦贤者不会被截断于辅助文本"')
  })

  it('shows only the selected empty destination as pending', () => {
    const html = renderToStaticMarkup(<RoomPlayerSeat disabled={false} interactionMode="changeSeat" layout={layout} onActivate={vi.fn()} pending player={{ ...player, playerID: '1', seatNumber: 2, name: '', occupied: false, connected: false, isLeader: false }} />)
    expect(html).toContain('data-seat-state="pending"')
    expect(html).toContain('aria-label="正在移至 2 号空座位"')
    expect(html).toContain('换座中')
  })

  it('keeps the disconnected badge readable outside the grayscale portrait image', () => {
    const html = renderToStaticMarkup(<RoomPlayerSeat disabled={false} interactionMode="none" layout={layout} onActivate={vi.fn()} player={{ ...player, connected: false }} />)
    expect(html).toContain('data-seat-portrait-connected="false"')
    expect(html).toContain('data-seat-disconnected-badge="true"')
    expect(html).toContain('>掉线<')
  })

  it('marks the viewer only in the accessible description', () => {
    const html = renderToStaticMarkup(<RoomPlayerSeat disabled={false} interactionMode="none" layout={layout} onActivate={vi.fn()} player={{ ...player, isCurrentPlayer: true }} />)
    expect(html).toContain('当前玩家')
    expect(html).not.toContain('data-avatar-state="current-player"')
  })

  it('places the room owner icon before the player name', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled
        interactionMode="none"
        layout={layout}
        onActivate={vi.fn()}
        player={{ ...player, isOwner: true }}
      />,
    )

    expect(html).toMatch(
      /class="room-seat__name absolute"[^>]*>.*data-seat-decoration="owner".*Alice.*<\/span>/s,
    )
  })

  it('assigns short, medium, and maximum nameplate width tiers', () => {
    const renderNameplate = (name: string, isOwner = false) => renderToStaticMarkup(
      <RoomPlayerSeat
        disabled
        interactionMode="none"
        layout={layout}
        onActivate={vi.fn()}
        player={{ ...player, name, isOwner }}
      />,
    )

    expect(renderNameplate('林 1')).toContain('data-nameplate-size="short" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:14px;top:64px;width:64px')
    expect(renderNameplate('暮色森林 7')).toContain('data-nameplate-size="medium" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:2px;top:64px;width:88px')
    expect(renderNameplate('阿瓦隆远征骑士 10')).toContain('data-nameplate-size="max" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:0;top:64px;width:92px')
    expect(renderNameplate('银月 3', true)).toContain('data-nameplate-size="short" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:14px;top:64px;width:64px')
  })

  it.each([
    ['merlin', '梅林', 'good', 'revealed-good'],
    ['assassin', '刺客', 'evil', 'revealed-evil'],
  ] as const)('reveals the compact %s role label and allegiance styling after the game', (role, shortLabel, loyalty, avatarState) => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat
        disabled
        interactionMode="none"
        layout={layout}
        onActivate={vi.fn()}
        player={{ ...player, visibleRole: role, showRoleReveal: true, isLeader: false }}
      />,
    )

    expect(html).toContain(`data-avatar-state="${avatarState}"`)
    expect(html).toContain('data-room-role-revealed="true"')
    expect(html).toContain(`data-role-loyalty="${loyalty}"`)
    expect(html).toContain(`>${shortLabel}</span>`)
    expect(html.indexOf('data-role-loyalty')).toBeGreaterThan(
      html.indexOf('data-round-table-nameplate'),
    )
  })
})
