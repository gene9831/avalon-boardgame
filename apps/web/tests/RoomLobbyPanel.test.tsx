import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomLobbyPanel, type RoomLobbyPanelProps } from '../src/RoomLobbyPanel'

function renderPanel(overrides: Partial<RoomLobbyPanelProps> = {}) {
  const props: RoomLobbyPanelProps = {
    canStart: false,
    connected: true,
    currentPlayerID: '1',
    manualReconnectAvailable: false,
    logEntries: [{ group: '等待房间', id: 'presence-0', kind: 'presence', title: '当前房间共有 2 名玩家' }],
    matchID: 'room-123',
    numPlayers: 5,
    occupiedPlayerIDs: ['0', '1'],
    ownerPlayerID: '0',
    onBackHome: vi.fn(),
    onChangeSeat: vi.fn(),
    onReconnect: vi.fn(),
    onRequestRoomExit: vi.fn(),
    onStart: vi.fn(),
    onSaveProfile: vi.fn(),
    players: [
      { id: 0, name: 'Alice', isConnected: true },
      { id: 1, name: 'Bob', isConnected: true },
    ],
    profile: { avatarID: 'merlin', name: 'Bob' },
    roomExitBusy: false,
    seatChangePending: false,
    ...overrides,
  }

  return renderToStaticMarkup(<RoomLobbyPanel {...props} />)
}

describe('RoomLobbyPanel room exit action', () => {
  it('offers a guest a real room exit instead of credential clearing', () => {
    const html = renderPanel()

    expect(html).toContain('>退出房间<')
    expect(html).not.toContain('清除凭据')
    expect(html).not.toContain('>解散房间<')
  })

  it('offers the owner room dissolution instead of releasing a seat', () => {
    const html = renderPanel({ currentPlayerID: '3', ownerPlayerID: '3' })

    expect(html).toContain('>解散房间<')
    expect(html).not.toContain('>退出房间<')
  })

  it('prevents another lobby action while room exit is being submitted', () => {
    const html = renderPanel({ roomExitBusy: true })

    expect(html).toContain('>正在退出…<')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>正在退出…<\/button>/)
  })

  it.each([
    ['guest exit', {}],
    ['owner dissolution', { currentPlayerID: '3', ownerPlayerID: '3' }],
  ])('disables %s while a seat change is pending', (_label, overrides) => {
    const html = renderPanel({ ...overrides, seatChangePending: true })

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:退出房间|解散房间)<\/button>/)
  })
})

describe('RoomLobbyPanel round table layout', () => {
  it('renders every seat once in the shared responsive round table', () => {
    const html = renderPanel()

    expect(html).toContain('aria-label="5 人玩家圆桌"')
    expect(html.match(/data-round-table-seat="true"/g)).toHaveLength(5)
    expect(html).toContain('1. Alice')
    expect(html).toContain('2. Bob')
  })

  it('keeps the occupancy action in the table center without a footer', () => {
    const waitingHtml = renderPanel()
    const hostHtml = renderPanel({
      canStart: true,
      currentPlayerID: '3',
      ownerPlayerID: '3',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    })
    const fullGuestHtml = renderPanel({
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    })

    expect(waitingHtml).toContain('>等待玩家<')
    expect(waitingHtml).toContain('还差 3 人')
    expect(waitingHtml).not.toContain('>开始游戏<')
    expect(hostHtml).toContain('>开始游戏<')
    expect(hostHtml).not.toContain('lobby-action-copy')
    expect(fullGuestHtml).toContain('role="status"')
    expect(fullGuestHtml).toContain('aria-label="等待房间创建者开始游戏"')
    expect(fullGuestHtml).toContain('aria-hidden="true" class="lobby-center-full-label"')
    expect(fullGuestHtml).toContain('aria-hidden="true" class="lobby-center-compact-label"')
    expect(fullGuestHtml).toContain('等待房间创建者开始游戏')
    expect(fullGuestHtml).not.toContain('等待房主')
  })

  it('announces current, disconnected, and empty lobby seats', () => {
    const html = renderPanel({
      players: [
        { id: 0, name: 'Alice', isConnected: false },
        { id: 1, name: 'Bob', isConnected: true },
      ],
    })

    expect(html).toContain('aria-label="1. Alice，已断线"')
    expect(html).toContain('aria-label="2. Bob，这是你"')
    expect(html).toContain('aria-label="移至 3 号空座位"')
  })

  it('marks the owner at their current seat and exposes immediate empty-seat actions', () => {
    const html = renderPanel({
      currentPlayerID: '3',
      ownerPlayerID: '3',
      occupiedPlayerIDs: ['0', '1', '3'],
      players: [
        { id: 0, name: 'Alice', isConnected: true },
        { id: 1, name: 'Bob', isConnected: true },
        { id: 3, name: 'Dylan', isConnected: true },
      ],
    })

    expect(html).toContain('data-player-id="3"')
    expect(html).toMatch(/data-player-id="3"[^>]*[\s\S]*aria-label="房间拥有者"|aria-label="房间拥有者"[\s\S]*data-player-id="3"/)
    expect(html).toContain('aria-label="移至 3 号空座位"')
    expect(html).not.toContain('确认换座')
  })
})

describe('RoomLobbyPanel connection recovery', () => {
  it('hides healthy connection chrome and delays manual reconnect', () => {
    const connectedHtml = renderPanel()
    const recoveringHtml = renderPanel({ connected: false })
    const retryHtml = renderPanel({ connected: false, manualReconnectAvailable: true })

    expect(connectedHtml).not.toContain('已连接')
    expect(connectedHtml).toContain('aria-label="房间操作"')
    expect(recoveringHtml).toContain('正在重新连接')
    expect(recoveringHtml).not.toContain('>重连<')
    expect(recoveringHtml).not.toContain('aria-label="房间操作"')
    expect(retryHtml).toContain('>重连<')
    expect(retryHtml).toContain('aria-label="重新连接房间"')
    expect(retryHtml).not.toContain('aria-label="房间操作"')
  })
})

describe('RoomLobbyPanel operation log', () => {
  it('places the log control in the room header without an unread badge', () => {
    const html = renderPanel()

    expect(html).toContain('aria-label="查看对局记录"')
    expect(html).not.toContain('data-unread')
  })
})
