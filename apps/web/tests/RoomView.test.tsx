import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { canRequestRoomExit, getUpdatedRoomRouteSession, recoverRoomRouteSession, resolveRecoverySeatValidation, resolveRoomRouteSnapshotSession, RoomAccessView, RoomView, type RoomViewProps } from '../src/App'
import { beginSeatTransition, loadRoomSession, loadSeatTransition, saveRoomSession, type RoomSessionStorage } from '../src/room-session'

vi.mock('../src/config', () => ({
  webConfig: {
    gameURL: 'http://localhost:8000',
    lobbyURL: 'http://localhost:8001',
  },
}))

function renderRoomView(overrides: Partial<RoomViewProps> = {}) {
  const props: RoomViewProps = {
    gameState: null,
    onAssassinate: vi.fn(),
    onBackHome: vi.fn(),
    onCastTeamVote: vi.fn(),
    onConfirmIdentityRecognition: vi.fn(),
    onClearLocalSession: vi.fn(),
    onDeleteRoom: vi.fn(),
    onKickPlayer: vi.fn(),
    onPlayQuestCard: vi.fn(),
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

function playingGameState(): RoomViewProps['gameState'] {
  return {
    G: {
      status: 'playing',
      players: {
        '0': { name: 'Alice' },
        '1': { name: 'Bob' },
        '2': { name: 'Claire' },
        '3': { name: 'Dylan' },
        '4': { name: 'Eve' },
      },
      identityRecognition: null,
      leaderID: '0',
      questIndex: 0,
      proposedTeam: null,
      submittedTeamVotePlayerIDs: [],
      voteHistory: [],
      questHistory: [],
      consecutiveRejectedTeams: 0,
      goodSuccesses: 0,
      evilFailures: 0,
      rules: { timeouts: { enabled: false } },
      viewer: {
        role: 'merlin',
        loyalty: 'good',
        knownEvilPlayerIDs: ['3', '4'],
      },
    },
    ctx: {
      numPlayers: 5,
      turn: 1,
      currentPlayer: '0',
      playOrder: ['0', '1', '2', '3', '4'],
      playOrderPos: 0,
      phase: 'teamProposal',
      activePlayers: { '0': 'leader' },
    },
    isActive: true,
    isConnected: true,
  } as RoomViewProps['gameState']
}

describe('RoomView connection state', () => {
  it('uses player-facing access and loading copy', () => {
    const accessHtml = renderToStaticMarkup(
      <RoomAccessView matchID="room-123" onBackHome={vi.fn()} />,
    )
    const loadingHtml = renderRoomView()

    expect(accessHtml).toContain('房间 room-123')
    expect(accessHtml).toContain('你尚未加入这个房间')
    expect(accessHtml).toContain('>返回房间列表<')
    expect(accessHtml).toContain('选择一个房间后加入')

    expect(loadingHtml).toContain('正在进入房间')
    expect(loadingHtml).not.toContain('座位凭据')
    expect(loadingHtml).not.toContain('实时连接')
  })

  it.each([
    ['room metadata', { room: null }],
    ['the first authoritative game state', {}],
  ])('keeps one connecting room view until %s arrives', (_label, overrides) => {
    const html = renderRoomView(overrides)

    expect(html).toContain('正在进入房间')
    expect(html.match(/<main\b/g)).toHaveLength(1)
    expect(html).not.toContain('玩家座位')
  })

  it('recovers a committed target seat after a dropped change response and reload', async () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const source = {
      credentials: 'credential',
      matchID: 'room-123',
      playerID: '0',
      playerName: 'Alice',
      sessionID: 'session-123',
    }
    saveRoomSession(source, storage)
    beginSeatTransition(source, '3', storage, 42)

    await expect(recoverRoomRouteSession(
      source,
      async (_matchID, playerID, credentials) => playerID === '3' && credentials === 'credential',
      storage,
    )).resolves.toEqual({ ...source, playerID: '3' })
    expect(loadRoomSession(source.matchID, storage)).toEqual({ ...source, playerID: '3' })
  })

  it('retains the source session or clears an invalid source during route recovery', async () => {
    const createStorage = (): RoomSessionStorage => {
      const values = new Map<string, string>()
      return {
        getItem: (key) => values.get(key) ?? null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, value),
      }
    }
    const source = {
      credentials: 'credential',
      matchID: 'room-123',
      playerID: '0',
      playerName: 'Alice',
      sessionID: 'session-123',
    }
    const sourceStorage = createStorage()
    saveRoomSession(source, sourceStorage)
    beginSeatTransition(source, '3', sourceStorage, 42)
    await expect(recoverRoomRouteSession(source, async (_matchID, playerID) => playerID === '0', sourceStorage))
      .resolves.toEqual(source)

    const invalidStorage = createStorage()
    saveRoomSession(source, invalidStorage)
    beginSeatTransition(source, '3', invalidStorage, 42)
    await expect(recoverRoomRouteSession(source, async () => false, invalidStorage)).resolves.toBeNull()
    expect(loadRoomSession(source.matchID, invalidStorage)).toBeNull()
  })

  it('preserves a pending transition when recovery validation is transiently unavailable', async () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const source = {
      credentials: 'credential',
      matchID: 'room-123',
      playerID: '0',
      playerName: 'Alice',
      sessionID: 'session-123',
    }
    saveRoomSession(source, storage)
    beginSeatTransition(source, '3', storage, 42)

    await expect(recoverRoomRouteSession(source, async () => {
      throw new TypeError('Failed to fetch')
    }, storage)).rejects.toThrow('Failed to fetch')
    expect(loadRoomSession(source.matchID, storage)).toEqual(source)
    expect(loadSeatTransition(source.matchID, storage)).toMatchObject({
      sourcePlayerID: '0',
      targetPlayerID: '3',
    })
  })

  it('retries transition recovery before the timer can validate a stale source seat', async () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const source = {
      credentials: 'credential',
      matchID: 'room-123',
      playerID: '0',
      playerName: 'Alice',
      sessionID: 'session-123',
    }
    saveRoomSession(source, storage)
    beginSeatTransition(source, '3', storage, 42)

    await expect(recoverRoomRouteSession(source, async () => {
      throw new TypeError('temporary outage')
    }, storage)).rejects.toThrow('temporary outage')

    await expect(recoverRoomRouteSession(source, async (_matchID, playerID) => playerID === '3', storage))
      .resolves.toEqual({ ...source, playerID: '3' })
    expect(loadRoomSession(source.matchID, storage)).toEqual({ ...source, playerID: '3' })
    expect(loadSeatTransition(source.matchID, storage)).toBeNull()
  })

  it('refreshes an unchanged source session after a stale subscription snapshot omits its seat', async () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const source = {
      credentials: 'credential',
      matchID: 'room-123',
      playerID: '0',
      playerName: 'Alice',
      sessionID: 'session-123',
    }
    saveRoomSession(source, storage)
    beginSeatTransition(source, '3', storage, 42)

    const resolution = await resolveRoomRouteSnapshotSession(
      source,
      async (_matchID, playerID, credentials) => (
        playerID === source.playerID && credentials === source.credentials
      ),
      storage,
    )

    expect(resolution).toEqual({ status: 'refresh', session: source })
    expect(loadRoomSession(source.matchID, storage)).toEqual(source)
    expect(loadSeatTransition(source.matchID, storage)).toBeNull()
  })

  it('treats only definitive session errors as an invalid recovery seat', async () => {
    await expect(resolveRecoverySeatValidation(async () => {
      throw new TypeError('Failed to fetch')
    })).rejects.toThrow('Failed to fetch')
  })

  it('adopts the current target session saved by another tab without accepting stale storage data', () => {
    const source = { credentials: 'source', matchID: 'room-123', playerID: '0', playerName: 'Alice' }
    const target = { ...source, credentials: 'target', playerID: '3' }

    expect(getUpdatedRoomRouteSession(source, target)).toEqual(target)
    expect(getUpdatedRoomRouteSession(target, target)).toBeNull()
    expect(getUpdatedRoomRouteSession(source, { ...target, matchID: 'other-room' })).toBeNull()
  })

  it('rejects an attempted room exit while seat migration is pending', () => {
    expect(canRequestRoomExit('lobby', false, true)).toBe(false)
    expect(canRequestRoomExit('lobby', false, false)).toBe(true)
  })
})

describe('RoomView viewport sizing', () => {
  it('uses only the dynamic viewport height and suppresses room overscroll', () => {
    const html = renderRoomView()
    const mainClasses = /<main class="([^"]+)"/.exec(html)?.[1]?.split(' ') ?? []

    expect(mainClasses).toContain('h-dvh')
    expect(mainClasses).toContain('overscroll-none')
    expect(mainClasses).not.toContain('h-screen')
  })
})

describe('RoomView playing layout', () => {
  it('keeps the players around a round table with the quest board in its center', () => {
    const html = renderRoomView({
      gameState: playingGameState(),
      room: {
        gameName: 'avalon',
        matchID: 'room-123',
        players: [
          { id: 0, name: 'Alice', isConnected: true },
          { id: 1, name: 'Bob', isConnected: true },
          { id: 2, name: 'Claire', isConnected: true },
          { id: 3, name: 'Dylan', isConnected: true },
          { id: 4, name: 'Eve', isConnected: true },
        ],
        setupData: { numPlayers: 5 },
      },
    })

    expect(html).toContain('aria-label="阿瓦隆游戏圆桌"')
    expect(html).toContain('aria-label="任务计分板"')
    expect(html).not.toContain('>玩家座位<')
  })
})
