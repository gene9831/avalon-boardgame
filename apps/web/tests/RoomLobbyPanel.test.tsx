import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomLobbyPanel, type RoomLobbyPanelProps } from '../src/RoomLobbyPanel'

function renderPanel(overrides: Partial<RoomLobbyPanelProps> = {}) {
  const props: RoomLobbyPanelProps = {
    canStart: false,
    connected: true,
    currentPlayerID: '1',
    manualReconnectAvailable: false,
    matchID: 'room-123',
    numPlayers: 5,
    occupiedPlayerIDs: ['0', '1'],
    onBackHome: vi.fn(),
    onReconnect: vi.fn(),
    onRequestRoomExit: vi.fn(),
    onStart: vi.fn(),
    players: [
      { id: 0, name: 'Alice', isConnected: true },
      { id: 1, name: 'Bob', isConnected: true },
    ],
    roomExitBusy: false,
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

  it('offers the host room dissolution instead of releasing seat zero', () => {
    const html = renderPanel({ currentPlayerID: '0' })

    expect(html).toContain('>解散房间<')
    expect(html).not.toContain('>退出房间<')
  })

  it('prevents another lobby action while room exit is being submitted', () => {
    const html = renderPanel({ roomExitBusy: true })

    expect(html).toContain('>正在退出…<')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>正在退出…<\/button>/)
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
      currentPlayerID: '0',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    })

    expect(waitingHtml).toContain('还差 3 人')
    expect(waitingHtml).not.toContain('>开始游戏<')
    expect(hostHtml).toContain('>开始游戏<')
    expect(hostHtml).not.toContain('lobby-action-copy')
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
    expect(html).toContain('aria-label="3. 空座位"')
  })
})

describe('RoomLobbyPanel connection recovery', () => {
  it('hides healthy connection chrome and delays manual reconnect', () => {
    const connectedHtml = renderPanel()
    const recoveringHtml = renderPanel({ connected: false })
    const retryHtml = renderPanel({ connected: false, manualReconnectAvailable: true })

    expect(connectedHtml).not.toContain('已连接')
    expect(recoveringHtml).toContain('正在重连')
    expect(recoveringHtml).not.toContain('>重连<')
    expect(retryHtml).toContain('>重连<')
  })
})
