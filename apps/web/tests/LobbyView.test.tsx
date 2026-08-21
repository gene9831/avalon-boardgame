import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { LobbyView, type LobbyViewProps } from '../src/LobbyView'
import type { RoomSession } from '../src/room-session'

const currentSession: RoomSession = {
  credentials: 'credential-current',
  matchID: 'room-current',
  playerID: '1',
  playerName: 'Guinevere',
  sessionID: 'join-session-current',
}

const currentRoom = {
  matchID: 'room-current',
  status: 'playing' as const,
  createdAt: 1,
  updatedAt: 3,
  players: [
    { id: 0, name: 'Arthur', isConnected: true },
    { id: 1, name: 'Guinevere', isConnected: true },
    { id: 2, name: 'Merlin', isConnected: true },
    { id: 3, name: 'Gawain', isConnected: true },
    { id: 4, name: 'Percival', isConnected: true },
  ],
}

const openRoom = {
  matchID: 'room-open',
  status: 'lobby' as const,
  createdAt: 2,
  updatedAt: 2,
  players: [
    { id: 0, name: 'Morgana', isConnected: true },
    { id: 1, isConnected: false },
    { id: 2, isConnected: false },
    { id: 3, isConnected: false },
    { id: 4, isConnected: false },
  ],
}

function renderLobby(overrides: Partial<LobbyViewProps> = {}) {
  const props: LobbyViewProps = {
    activeRoomSessions: [],
    busy: false,
    devToken: '',
    devToolsEnabled: false,
    error: null,
    matches: [],
    numPlayers: 5,
    onCreate: vi.fn(),
    onDeleteRoom: vi.fn(async () => undefined),
    onDevTokenChange: vi.fn(),
    onEnterRoom: vi.fn(),
    onJoin: vi.fn(),
    onRefresh: vi.fn(),
    roomAccessLocked: false,
    roomAccessPending: false,
    roomAccessUnavailable: false,
    selectedSeats: {},
    setNumPlayers: vi.fn(),
    setSelectedSeats: vi.fn(),
    ...overrides,
  }

  return renderToStaticMarkup(<LobbyView {...props} />)
}

describe('LobbyView room access', () => {
  it('offers entering a joined active room without offering another join', () => {
    const html = renderLobby({
      activeRoomSessions: [currentSession],
      matches: [currentRoom],
      roomAccessLocked: true,
    })

    expect(html).toContain('>进入<')
    expect(html).not.toContain('>加入<')
    expect(html).not.toContain('最近的房间')
  })

  it('blocks creating or joining another room while an active session exists', () => {
    const html = renderLobby({
      activeRoomSessions: [currentSession],
      matches: [openRoom, currentRoom],
      roomAccessLocked: true,
    })

    expect(html).toContain('请先完成当前房间')
    expect(html).not.toContain('>加入<')
    expect(html).not.toContain('aria-label="选择 room-open 的座位"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>创建房间<\/button>/)
    expect(html.indexOf('房间 room-current')).toBeLessThan(html.indexOf('房间 room-open'))
  })

  it('keeps room entry points closed while saved sessions are being checked', () => {
    const html = renderLobby({
      matches: [openRoom],
      roomAccessLocked: true,
      roomAccessPending: true,
    })

    expect(html).toContain('正在确认房间状态')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>创建房间<\/button>/)
    expect(html).not.toContain('>加入<')
    expect(html).not.toContain('aria-label="选择 room-open 的座位"')
  })

  it('explains when room access cannot be confirmed', () => {
    const html = renderLobby({
      matches: [openRoom],
      roomAccessLocked: true,
      roomAccessUnavailable: true,
    })

    expect(html).toContain('暂时无法确认房间状态')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>创建房间<\/button>/)
    expect(html).not.toContain('>加入<')
  })
})
