import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomView, type RoomViewProps } from '../src/App'

vi.mock('../src/config', () => ({
  webConfig: {
    gameURL: 'http://localhost:8000',
    lobbyURL: 'http://localhost:8001',
  },
}))

function renderRoomView(overrides: Partial<RoomViewProps> = {}) {
  const props: RoomViewProps = {
    error: null,
    gameState: null,
    onBackHome: vi.fn(),
    onCastTeamVote: vi.fn(),
    onClearLocalSession: vi.fn(),
    onDeleteRoom: vi.fn(),
    onKickPlayer: vi.fn(),
    onProposeTeam: vi.fn(),
    onReconnect: vi.fn(),
    onRequestRoomExit: vi.fn(),
    onStart: vi.fn(),
    room: {
      gameName: 'avalon',
      matchID: 'room-123',
      players: [{ id: 0, name: 'Alice', isConnected: true }],
      setupData: { numPlayers: 5 },
    },
    roomExitBusy: false,
    session: {
      credentials: 'credential',
      matchID: 'room-123',
      playerID: '0',
      playerName: 'Alice',
    },
    ...overrides,
  }

  return renderToStaticMarkup(<RoomView {...props} />)
}

describe('RoomView connection state', () => {
  it.each([
    ['room metadata', { room: null }],
    ['the first authoritative game state', {}],
  ])('keeps one connecting room view until %s arrives', (_label, overrides) => {
    const html = renderRoomView(overrides)

    expect(html).toContain('正在连接房间')
    expect(html.match(/<main\b/g)).toHaveLength(1)
    expect(html).not.toContain('玩家座位')
  })
})
