import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSeatLayout } from '@avalon/ui-layout'

import { RoomPlayerSeat } from '../src/RoomPlayerSeat'
import type { RoomPlayerPresentation } from '../src/room-screen-props'

const layout: PlayerSeatLayout = {
  relativeSeatIndex: 0,
  playerSeatBounds: { x: 100, y: 200, width: 92, height: 88 },
  playerBoundaryCircle: { center: { x: 146, y: 234 }, radius: 46 },
  avatarRect: { x: 122, y: 210, width: 48, height: 48 },
  nameRect: { x: 100, y: 264, width: 92, height: 22 },
  avatarTopClearance: 10,
}

const player: RoomPlayerPresentation = {
  playerID: '0', relativeSeatIndex: 0, seatNumber: 1, name: 'Alice', occupied: true,
  isCurrentPlayer: false,
  portrait: { kind: 'playerAvatar', avatarID: 'merlin', connected: true },
  markers: [{ kind: 'leader' }],
  caption: { kind: 'none' },
  emphasis: 'default',
  interaction: { kind: 'none' },
}

describe('RoomPlayerSeat', () => {
  it('labels a normalized recognition target without replacing the player avatar', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, markers: [],
        caption: { kind: 'recognition', label: '同伴', tone: 'ally' },
      }} />,
    )

    expect(html).toContain('data-recognition-seat-state="target"')
    expect(html).toContain('data-recognition-tone="ally"')
    expect(html).toContain('data-identity-recognition-label="true"')
    expect(html).toContain('>同伴</span>')
    expect(html).toContain('aria-label="1. Alice，同伴"')
    expect(html).not.toContain('data-room-role-revealed="true"')
  })

  it('uses the explicit team interaction for one semantic control', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player,
        interaction: { kind: 'selectTeam', disabled: false, selected: false },
      }} />,
    )

    expect(html).toContain('<button')
    expect(html).toContain('aria-label="选择 Alice 加入任务队伍，队长"')
    expect(html.match(/data-seat-pointer-target=/g)).toHaveLength(2)
    expect(html).toContain('data-seat-pointer-target="avatar"')
    expect(html).toContain('data-seat-pointer-target="name"')
    expect(html).toContain('data-seat-decoration="leader"')
  })

  it('marks an explicitly selected player and announces that activation cancels selection', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, emphasis: 'selected',
        interaction: { kind: 'selectTeam', disabled: false, selected: true },
      }} />,
    )

    expect(html).toContain('aria-label="取消选择 Alice，队长"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('data-seat-decoration="selected"')
    expect(html).toMatch(/<svg[^>]*fill="#0f172a"[^>]*class="lucide lucide-circle-check"/)
    expect(html).toMatch(/data-seat-decoration="leader"[^>]*>.*lucide-crown/s)
    expect(html).toContain('data-nameplate-emphasis="cyan"')
  })

  it('gives submitted quest members the same cyan nameplate emphasis', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, emphasis: 'questMember', markers: [{ kind: 'questMember' }],
      }} />,
    )

    expect(html).toContain('data-avatar-state="quest-member"')
    expect(html).toContain('data-nameplate-emphasis="cyan"')
    expect(html).toContain('aria-label="1. Alice，任务队员"')
    expect(html).not.toContain('data-seat-decoration="quest-member"')
  })

  it('renders a non-button group when the seat has no interaction', () => {
    const html = renderToStaticMarkup(<RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={player} />)
    expect(html).toContain('role="group"')
    expect(html).not.toContain('<button')
  })

  it('keeps the shared seat-number badge when terminal role artwork replaces the avatar', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player,
        portrait: { kind: 'roleArtwork', role: 'merlin' },
        caption: { kind: 'role', role: 'merlin' },
      }} />,
    )

    expect(html).toContain('data-room-seat-number-badge="true">1</span>')
    expect(html).toMatch(/data-round-table-nameplate="true"[^>]*>.*Alice.*<\/span>/s)
    expect(html).not.toContain('data-seat-number="true"')
  })

  it('keeps a disabled occupied lobby seat grouped while an enabled empty destination is actionable', () => {
    const occupiedHtml = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, interaction: { kind: 'changeSeat', disabled: true, pending: false },
      }} />,
    )
    const emptyHtml = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, playerID: '1', seatNumber: 2, name: '', occupied: false, markers: [],
        portrait: { kind: 'playerAvatar', avatarID: 'assassin', connected: false },
        interaction: { kind: 'changeSeat', disabled: false, pending: false },
      }} />,
    )

    expect(occupiedHtml).toContain('role="group"')
    expect(occupiedHtml).not.toContain('<button')
    expect(emptyHtml).toContain('<button')
    expect(emptyHtml).toContain('aria-label="移至 2 号空座位"')
    expect(emptyHtml).toContain('data-seat-state="empty"')
    expect(emptyHtml).toContain('data-room-seat-number-badge="true">2</span>')
    expect(emptyHtml).toContain('data-empty-seat-symbol="true">+</span>')
    expect(emptyHtml).toContain('>空位</span>')
  })

  it('shows only an explicit pending empty destination as migrating', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, playerID: '1', seatNumber: 2, name: '', occupied: false, markers: [],
        portrait: { kind: 'playerAvatar', avatarID: 'assassin', connected: false },
        interaction: { kind: 'changeSeat', disabled: true, pending: true },
      }} />,
    )
    expect(html).toContain('data-seat-state="pending"')
    expect(html).toContain('aria-label="正在移至 2 号空座位"')
    expect(html).toContain('换座中')
  })

  it('keeps long player names in the title and accessible name', () => {
    const name = '暮鸦贤者不会被截断于辅助文本'
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player,
        name,
        interaction: {
          kind: 'selectAssassinationTarget', disabled: false, selected: false,
        },
      }} />,
    )

    expect(html).toContain(`aria-label="选择 ${name} 作为刺杀目标，队长"`)
    expect(html).toContain(`title="${name}"`)
  })

  it('keeps a disconnected badge outside the grayscale player portrait', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, portrait: { kind: 'playerAvatar', avatarID: 'merlin', connected: false },
      }} />,
    )
    expect(html).toContain('data-seat-portrait-connected="false"')
    expect(html).toContain('data-seat-disconnected-badge="true"')
    expect(html).toContain('>掉线<')
  })

  it('marks the viewer only in the accessible description', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{ ...player, isCurrentPlayer: true }} />,
    )
    expect(html).toContain('当前玩家')
    expect(html).not.toContain('data-avatar-state="current-player"')
  })

  it('places the room owner marker before the player name', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, markers: [{ kind: 'owner' }],
      }} />,
    )
    expect(html).toMatch(/class="room-seat__name absolute"[^>]*>.*data-seat-decoration="owner".*Alice.*<\/span>/s)
  })

  it('lets the player name inherit the default sans-serif font', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={player} />,
    )

    expect(html).toContain('class="room-seat__name absolute"')
    expect(html).not.toMatch(/class="room-seat__name[^"]*font-avalon-serif/)
  })

  it('keeps a two-digit seat number in the avatar badge and out of the nameplate', () => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, seatNumber: 10, name: '银月', markers: [{ kind: 'owner' }],
      }} />,
    )

    expect(html).toContain('data-room-seat-number-badge="true">10</span>')
    expect(html).toContain('data-nameplate-size="short"')
    expect(html).toMatch(/data-round-table-nameplate="true"[^>]*>.*data-seat-decoration="owner".*银月.*<\/span>/s)
    expect(html).not.toContain('data-seat-number="true"')
  })

  it('assigns short, medium, and maximum nameplate width tiers', () => {
    const renderNameplate = (name: string, owner = false) => renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player, name, markers: owner ? [{ kind: 'owner' }] : [],
      }} />,
    )

    expect(renderNameplate('林 1')).toContain('data-nameplate-size="short" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:14px;top:64px;width:64px')
    expect(renderNameplate('暮色森林 7')).toContain('data-nameplate-size="medium" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:2px;top:64px;width:88px')
    expect(renderNameplate('阿瓦隆远征骑士 10')).toContain('data-nameplate-size="max" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:0;top:64px;width:92px')
    expect(renderNameplate('银月 3', true)).toContain('data-nameplate-size="short" data-round-table-nameplate="true" data-seat-pointer-target="name" style="left:14px;top:64px;width:64px')
  })

  it.each([
    ['merlin', '梅林', 'good', 'revealed-good'],
    ['assassin', '刺客', 'evil', 'revealed-evil'],
  ] as const)('renders an explicit compact %s role presentation after the game', (role, shortLabel, loyalty, avatarState) => {
    const html = renderToStaticMarkup(
      <RoomPlayerSeat layout={layout} onActivate={vi.fn()} player={{
        ...player,
        portrait: { kind: 'roleArtwork', role },
        markers: [],
        caption: { kind: 'role', role },
        interaction: { kind: 'none' },
      }} />,
    )

    expect(html).toContain(`data-avatar-state="${avatarState}"`)
    expect(html).toContain('data-room-role-revealed="true"')
    expect(html).toContain(`data-role-loyalty="${loyalty}"`)
    expect(html).toContain(`>${shortLabel}</span>`)
    expect(html.indexOf('data-role-loyalty')).toBeGreaterThan(html.indexOf('data-round-table-nameplate'))
  })
})
