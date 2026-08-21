import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomLobbyPanel, type RoomLobbyPanelProps } from '../src/RoomLobbyPanel'

function renderPanel(overrides: Partial<RoomLobbyPanelProps> = {}) {
  const props: RoomLobbyPanelProps = {
    canStart: false,
    connected: true,
    currentPlayerID: '1',
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
