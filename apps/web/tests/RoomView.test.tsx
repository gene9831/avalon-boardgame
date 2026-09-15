import { renderToStaticMarkup } from 'react-dom/server'
import type { PlayerID } from '@avalon/game'
import { describe, expect, it, vi } from 'vitest'

import { canRequestRoomExit, executeRoomSeatChangeOperation, executeRoomStartOperation, getSeatChangeTargetAfterTransitionStorageChange, getUpdatedRoomRouteSession, recoverRoomRouteSession, resolveRecoverySeatValidation, resolveRoomRouteSnapshotSession, shouldWakeRoomRouteForSeatTransitionChange, RoomAccessView, RoomView, type RoomViewProps } from '../src/App'
import type { AvalonMatch } from '../src/lobby'
import { RoomParticipationHttpError, type SeatTransitionReplayClient } from '../src/room-participation'
import { beginSeatTransition, loadRoomSession, loadSeatTransition, markSeatTransitionUncertain, saveRoomSession, type RoomSession, type RoomSessionStorage } from '../src/room-session'
import { ToastProvider } from '../src/toast'

const roomLayoutHarness = vi.hoisted(() => ({ measured: false }))

vi.mock('../src/useRoomLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/useRoomLayout')>()
  return {
    ...actual,
    useRoomLayout(playerCount: number | null, diagnosticsMode: 'off' | 'metrics' | 'geometry') {
      const result = actual.useRoomLayout(playerCount, diagnosticsMode)
      if (!roomLayoutHarness.measured || playerCount === null) return result

      return {
        ...result,
        snapshot: actual.resolveRoomLayoutSnapshot({
          canvasSize: { height: 600, width: 800 },
          playerCount,
          stageSize: { height: 600, width: 800 },
          viewportSize: { height: 600, width: 800 },
        }),
      }
    },
  }
})

vi.mock('../src/config', () => ({
  webConfig: {
    gameURL: 'http://localhost:8000',
    lobbyURL: 'http://localhost:8001',
  },
}))

function renderRoomView(
  overrides: Partial<RoomViewProps> = {},
  measuredStage = false,
) {
  const props: RoomViewProps = {
    gameState: null,
    onAssassinate: vi.fn(),
    onBackHome: vi.fn(),
    onCastTeamVote: vi.fn(),
    onConfirmIdentityRecognition: vi.fn(),
    onChangeSeat: vi.fn(),
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
    roomExitBlocked: false,
    roomExitBusy: false,
    seatChangeTargetID: null,
    startPending: false,
    session: {
      credentials: 'credential',
      matchID: 'room-123',
      playerID: '0',
      playerName: 'Alice',
    },
    ...overrides,
  }

  roomLayoutHarness.measured = measuredStage
  try {
    return renderToStaticMarkup(
      <ToastProvider>
        <RoomView {...props} />
      </ToastProvider>,
    )
  } finally {
    roomLayoutHarness.measured = false
  }
}

function incompleteRoomWithEmptySeat(emptyPlayerID: PlayerID): AvalonMatch {
  return {
    gameName: 'avalon',
    matchID: 'room-123',
    ownerPlayerID: '0',
    occupiedPlayerIDs: ['0', '1', '2', '4'],
    players: [
      { id: 0, name: 'Alice', isConnected: true },
      { id: 1, name: 'Bob', isConnected: true },
      { id: 2, name: 'Claire', isConnected: true },
      { id: Number(emptyPlayerID), name: null, isConnected: false },
      { id: 4, name: 'Eve', isConnected: true },
    ],
    roleConfiguration: { percivalMorgana: true },
    setupData: { numPlayers: 5 },
  }
}

function fullRoom(): AvalonMatch {
  return {
    ...incompleteRoomWithEmptySeat('3'),
    occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    players: [
      { id: 0, name: 'Alice', isConnected: true },
      { id: 1, name: 'Bob', isConnected: true },
      { id: 2, name: 'Claire', isConnected: true },
      { id: 3, name: 'Dylan', isConnected: true },
      { id: 4, name: 'Eve', isConnected: true },
    ],
  }
}

const replayTarget: SeatTransitionReplayClient = {
  changeSeat: async (matchID, _sourcePlayerID, credentials, targetPlayerID) => ({
    matchID,
    playerID: targetPlayerID,
    playerCredentials: credentials,
  }),
}

const rejectOccupiedTarget: SeatTransitionReplayClient = {
  changeSeat: async () => {
    throw new RoomParticipationHttpError(409, 'seat_unavailable')
  },
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
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

function lobbyGameState(): RoomViewProps['gameState'] {
  const state = playingGameState()!
  state.G.status = 'lobby'
  state.G.lobby = {
    occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    ownerPlayerID: '0',
  }
  state.ctx.phase = 'lobby'
  state.ctx.activePlayers = null
  return state
}

describe('RoomRoute async operation isolation', () => {
  it.each(['generation', 'match', 'session', 'client'] as const)(
    'requires the deferred start operation %s identity to remain current',
    async (changedIdentity) => {
      const sourceSession = {
        credentials: 'credential-a', matchID: 'room-a', playerID: '0', playerName: 'Alice',
      }
      const sourceStart = vi.fn()
      const sourceClient = { moves: { startGame: sourceStart } }
      const operation = {
        client: sourceClient, generation: 1, matchID: sourceSession.matchID,
        session: sourceSession, startGame: sourceStart, token: Symbol('start-a'),
      }
      const operationRef = { current: operation }
      let currentRoute = {
        client: sourceClient,
        generation: operation.generation,
        matchID: operation.matchID,
        session: sourceSession,
      }
      const pending = deferred<void>()
      const onError = vi.fn()
      const onSettled = vi.fn()
      const request = executeRoomStartOperation({
        getCurrentRoute: () => currentRoute,
        onError,
        onSettled,
        operation,
        operationRef,
        prepareStart: () => pending.promise,
      })

      if (changedIdentity === 'generation') {
        currentRoute = { ...currentRoute, generation: 2 }
      } else if (changedIdentity === 'match') {
        currentRoute = { ...currentRoute, matchID: 'room-b' }
      } else if (changedIdentity === 'session') {
        currentRoute = {
          ...currentRoute,
          session: { ...sourceSession, credentials: 'credential-rebound' },
        }
      } else {
        currentRoute = {
          ...currentRoute,
          client: { moves: { startGame: vi.fn() } },
        }
      }
      pending.resolve()
      await request

      expect(sourceStart).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(onSettled).not.toHaveBeenCalled()
      expect(operationRef.current).toBeNull()
    },
  )

  it('does not let a deferred start completion act on or clear a newer room operation', async () => {
    const sourceSession = {
      credentials: 'credential-a', matchID: 'room-a', playerID: '0', playerName: 'Alice',
    }
    const nextSession = {
      credentials: 'credential-b', matchID: 'room-b', playerID: '1', playerName: 'Bob',
    }
    const sourceStart = vi.fn()
    const nextStart = vi.fn()
    const sourceClient = { moves: { startGame: sourceStart } }
    const nextClient = { moves: { startGame: nextStart } }
    const sourceOperation = {
      client: sourceClient, generation: 1, matchID: sourceSession.matchID,
      session: sourceSession, startGame: sourceStart, token: Symbol('start-a'),
    }
    const nextOperation = {
      client: nextClient, generation: 2, matchID: nextSession.matchID,
      session: nextSession, startGame: nextStart, token: Symbol('start-b'),
    }
    const operationRef = { current: sourceOperation }
    let currentRoute = {
      client: sourceClient, generation: 1, matchID: sourceSession.matchID, session: sourceSession,
    }
    const pending = deferred<void>()
    const sourceSettled = vi.fn()

    const sourceRequest = executeRoomStartOperation({
      getCurrentRoute: () => currentRoute,
      onError: vi.fn(),
      onSettled: sourceSettled,
      operation: sourceOperation,
      operationRef,
      prepareStart: () => pending.promise,
    })
    currentRoute = {
      client: nextClient, generation: 2, matchID: nextSession.matchID, session: nextSession,
    }
    operationRef.current = nextOperation
    pending.resolve()
    await sourceRequest

    expect(sourceStart).not.toHaveBeenCalled()
    expect(nextStart).not.toHaveBeenCalled()
    expect(operationRef.current).toBe(nextOperation)
    expect(sourceSettled).not.toHaveBeenCalled()

    const nextSettled = vi.fn()
    await executeRoomStartOperation({
      getCurrentRoute: () => currentRoute,
      onError: vi.fn(),
      onSettled: nextSettled,
      operation: nextOperation,
      operationRef,
      prepareStart: async () => undefined,
    })
    expect(nextStart).toHaveBeenCalledTimes(1)
    expect(nextSettled).toHaveBeenCalledTimes(1)
    expect(operationRef.current).toBeNull()
  })

  it('does not let a deferred seat completion update or clear a newer room operation', async () => {
    const sourceSession = {
      credentials: 'credential-a', matchID: 'room-a', playerID: '0', playerName: 'Alice',
    }
    const nextSession = {
      credentials: 'credential-b', matchID: 'room-b', playerID: '1', playerName: 'Bob',
    }
    const sourceClient = { moves: { startGame: vi.fn() } }
    const nextClient = { moves: { startGame: vi.fn() } }
    const sourceOperation = {
      client: sourceClient, generation: 1, matchID: sourceSession.matchID,
      session: sourceSession, targetPlayerID: '3', token: Symbol('seat-a'),
    }
    const nextOperation = {
      client: nextClient, generation: 2, matchID: nextSession.matchID,
      session: nextSession, targetPlayerID: '4', token: Symbol('seat-b'),
    }
    const operationRef = { current: sourceOperation }
    let currentRoute = {
      client: sourceClient, generation: 1, matchID: sourceSession.matchID, session: sourceSession,
    }
    const pending = deferred<RoomSession>()
    const setSession = vi.fn()
    const sourceSettled = vi.fn()

    const sourceRequest = executeRoomSeatChangeOperation({
      changeSeat: () => pending.promise,
      getCurrentRoute: () => currentRoute,
      onError: vi.fn(),
      onSession: setSession,
      onSettled: sourceSettled,
      operation: sourceOperation,
      operationRef,
    })
    currentRoute = {
      client: nextClient, generation: 2, matchID: nextSession.matchID, session: nextSession,
    }
    operationRef.current = nextOperation
    pending.resolve({ ...sourceSession, playerID: '3' })
    await sourceRequest

    expect(setSession).not.toHaveBeenCalled()
    expect(operationRef.current).toBe(nextOperation)
    expect(sourceSettled).not.toHaveBeenCalled()

    const nextSettled = vi.fn()
    await executeRoomSeatChangeOperation({
      changeSeat: async () => ({ ...nextSession, playerID: '4' }),
      getCurrentRoute: () => currentRoute,
      onError: vi.fn(),
      onSession: setSession,
      onSettled: nextSettled,
      operation: nextOperation,
      operationRef,
    })
    expect(setSession).toHaveBeenLastCalledWith({ ...nextSession, playerID: '4' })
    expect(nextSettled).toHaveBeenCalledTimes(1)
    expect(operationRef.current).toBeNull()
  })

  it('does not apply a deferred seat result after the exact route identity changes', async () => {
    const sourceSession = {
      credentials: 'credential-a', matchID: 'room-a', playerID: '0', playerName: 'Alice',
    }
    const nextSession = {
      credentials: 'credential-b', matchID: 'room-b', playerID: '1', playerName: 'Bob',
    }
    const sourceClient = { moves: { startGame: vi.fn() } }
    const nextClient = { moves: { startGame: vi.fn() } }
    const operation = {
      client: sourceClient, generation: 1, matchID: sourceSession.matchID,
      session: sourceSession, targetPlayerID: '3', token: Symbol('seat-a'),
    }
    const operationRef = { current: operation }
    let currentRoute = {
      client: sourceClient, generation: 1, matchID: sourceSession.matchID, session: sourceSession,
    }
    const pending = deferred<RoomSession>()
    const setSession = vi.fn()
    const onSettled = vi.fn()
    const request = executeRoomSeatChangeOperation({
      changeSeat: () => pending.promise,
      getCurrentRoute: () => currentRoute,
      onError: vi.fn(),
      onSession: setSession,
      onSettled,
      operation,
      operationRef,
    })

    currentRoute = {
      client: nextClient, generation: 2, matchID: nextSession.matchID, session: nextSession,
    }
    pending.resolve({ ...sourceSession, playerID: '3' })
    await request

    expect(setSession).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
    expect(operationRef.current).toBeNull()
  })
})

describe('RoomView connection state', () => {
  it('uses player-facing access and loading copy', () => {
    const accessHtml = renderToStaticMarkup(
      <RoomAccessView matchID="room-123" onBackHome={vi.fn()} />,
    )
    const loadingHtml = renderRoomView()

    expect(accessHtml).toContain('房间 room-12')
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
    markSeatTransitionUncertain(beginSeatTransition(source, '3', storage, 42), storage)

    await expect(recoverRoomRouteSession(
      source,
      replayTarget,
      async () => true,
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
    markSeatTransitionUncertain(beginSeatTransition(source, '3', sourceStorage, 42), sourceStorage)
    await expect(recoverRoomRouteSession(
      source,
      rejectOccupiedTarget,
      async (_matchID, playerID) => playerID === '0',
      sourceStorage,
    ))
      .resolves.toEqual(source)

    const invalidStorage = createStorage()
    saveRoomSession(source, invalidStorage)
    markSeatTransitionUncertain(beginSeatTransition(source, '3', invalidStorage, 42), invalidStorage)
    await expect(recoverRoomRouteSession(
      source,
      {
        changeSeat: async () => {
          throw new RoomParticipationHttpError(403, 'invalid_seat_session')
        },
      },
      async () => false,
      invalidStorage,
    )).resolves.toBeNull()
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
    markSeatTransitionUncertain(beginSeatTransition(source, '3', storage, 42), storage)

    await expect(recoverRoomRouteSession(source, {
      changeSeat: async () => { throw new TypeError('Failed to fetch') },
    }, async () => true, storage)).rejects.toThrow('Failed to fetch')
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
    markSeatTransitionUncertain(beginSeatTransition(source, '3', storage, 42), storage)

    await expect(recoverRoomRouteSession(source, {
      changeSeat: async () => { throw new TypeError('temporary outage') },
    }, async () => true, storage)).rejects.toThrow('temporary outage')

    await expect(recoverRoomRouteSession(source, replayTarget, async () => true, storage))
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
    markSeatTransitionUncertain(beginSeatTransition(source, '3', storage, 42), storage)

    const resolution = await resolveRoomRouteSnapshotSession(
      source,
      rejectOccupiedTarget,
      async (_matchID, playerID, credentials) => (
        playerID === source.playerID && credentials === source.credentials
      ),
      storage,
    )

    expect(resolution).toEqual({ status: 'refresh', session: source })
    expect(loadRoomSession(source.matchID, storage)).toEqual(source)
    expect(loadSeatTransition(source.matchID, storage)).toBeNull()
  })

  it('pauses stale subscription recovery while another tab is requesting a seat change', async () => {
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
    }
    saveRoomSession(source, storage)
    const transition = beginSeatTransition(source, '3', storage)
    const validate = vi.fn(async () => true)

    await expect(resolveRoomRouteSnapshotSession(
      source,
      { changeSeat: vi.fn() },
      validate,
      storage,
    )).resolves.toEqual({
      status: 'requesting',
      session: source,
    })
    expect(validate).not.toHaveBeenCalled()
    expect(loadSeatTransition(source.matchID, storage)).toEqual(transition)
    expect(loadRoomSession(source.matchID, storage)).toEqual(source)
  })

  it('wakes a waiting route when the owner clears or makes its transition recoverable', async () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const source = { credentials: 'credential', matchID: 'room-123', playerID: '0', playerName: 'Alice' }
    saveRoomSession(source, storage)
    const transition = beginSeatTransition(source, '3', storage, 42, () => 'request-1')
    const markerKey = 'avalon:seat-transition:room-123'

    expect(shouldWakeRoomRouteForSeatTransitionChange(markerKey, source, storage, 43)).toBe(false)
    markSeatTransitionUncertain(transition, storage)
    expect(shouldWakeRoomRouteForSeatTransitionChange(markerKey, source, storage, 43)).toBe(true)
    await expect(recoverRoomRouteSession(
      source,
      replayTarget,
      async () => true,
      storage,
    )).resolves.toEqual({ ...source, playerID: '3' })

    saveRoomSession(source, storage)
    beginSeatTransition(source, '3', storage, 42, () => 'request-2')
    storage.removeItem(markerKey)
    expect(shouldWakeRoomRouteForSeatTransitionChange(markerKey, source, storage, 43)).toBe(true)
  })

  it('wakes a reloaded route after an orphaned requesting lease expires', () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const source = { credentials: 'credential', matchID: 'room-123', playerID: '0', playerName: 'Alice' }
    const transition = beginSeatTransition(source, '3', storage, 42, () => 'orphan')

    expect(shouldWakeRoomRouteForSeatTransitionChange(
      'avalon:seat-transition:room-123',
      source,
      storage,
      transition.leaseExpiresAt + 1,
    )).toBe(true)
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

  it('clears a cross-tab pending target only when transition removal retains the source seat', () => {
    const source = { credentials: 'source', matchID: 'room-123', playerID: '0', playerName: 'Alice' }
    const target = { ...source, credentials: 'target', playerID: '3' }

    expect(getSeatChangeTargetAfterTransitionStorageChange('3', null, source)).toBeNull()
    expect(getSeatChangeTargetAfterTransitionStorageChange('3', null, target)).toBe('3')
    expect(getSeatChangeTargetAfterTransitionStorageChange(
      '3',
      { targetPlayerID: '3' },
      source,
    )).toBe('3')
  })

  it('rejects an attempted room exit while seat migration is pending', () => {
    expect(canRequestRoomExit('lobby', false, true, false)).toBe(false)
    expect(canRequestRoomExit('lobby', false, false, true)).toBe(false)
    expect(canRequestRoomExit('lobby', false, false, false)).toBe(true)
  })
})

describe('RoomView viewport sizing', () => {
  it('uses only the dynamic viewport height and suppresses room overscroll', () => {
    const html = renderRoomView()
    const mainClasses = /<div class="([^"]+)" data-room-shell-variant="game"/.exec(html)?.[1]?.split(' ') ?? []

    expect(mainClasses).toContain('h-dvh')
    expect(mainClasses).toContain('overscroll-none')
    expect(mainClasses).not.toContain('h-screen')
  })
})

describe('RoomView playing layout', () => {
  it('keeps one room screen while its round-table stage is being measured', () => {
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

    expect(html).toContain('aria-label="5 人游戏圆桌"')
    expect(html).toContain('data-stage-layout-status="measuring"')
    expect(html).toContain('aria-label="五次任务进度"')
    expect(html).toContain('data-room-shell-variant="game"')
    expect(html.match(/data-room-scene="teamProposal"/g)).toHaveLength(1)
    expect(html.match(/data-room-stage="true"/g)).toHaveLength(1)
    expect(html).not.toContain('data-room-mode=')
    expect(html).toContain('请选择 <strong class="text-amber-200">2 名玩家</strong>')
    expect(html).toContain('已选 <strong class="text-cyan-200">0 / 2</strong>')
    expect(html).toContain('aria-label="确认队伍"')
    expect(html).not.toContain('>玩家座位<')
  })

  it('uses the same room screen for the waiting lobby', () => {
    const state = lobbyGameState()!
    const html = renderRoomView({
      gameState: state,
      room: {
        gameName: 'avalon', matchID: 'room-123', ownerPlayerID: '0',
        occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
        players: [
          { id: 0, name: 'Alice', isConnected: true }, { id: 1, name: 'Bob', isConnected: true },
          { id: 2, name: 'Claire', isConnected: true }, { id: 3, name: 'Dylan', isConnected: true },
          { id: 4, name: 'Eve', isConnected: true },
        ],
        roleConfiguration: { percivalMorgana: true }, setupData: { numPlayers: 5 },
      },
    })

    expect(html.match(/data-room-scene="lobby"/g)).toHaveLength(1)
    expect(html).not.toContain('data-room-mode=')
    expect(html).toContain('>开始游戏<')
    expect(html).toContain('aria-label="打开帮助说明"')
  })

  it('keeps lobby room actions in the complete toolbar during connection recovery', () => {
    const state = lobbyGameState()!
    state.isConnected = false
    const html = renderRoomView({ gameState: state, room: fullRoom() })

    expect(html).toContain('data-room-scene="connectionRecovery"')
    expect(html).toContain('data-room-toolbar-item="room"')
  })

  it('composes exactly one back control and one complete toolbar outside the observed scene', () => {
    const html = renderRoomView({ gameState: playingGameState(), room: fullRoom() })

    expect(html.match(/aria-label="返回主页"/g)).toHaveLength(1)
    expect(html.match(/aria-label="房间工具"/g)).toHaveLength(1)
    expect(html).toContain('font-sans')
  })

  it('starts live role confirmation concealed and keeps unauthorized viewers behind the curtain', () => {
    const state = playingGameState()!
    state.ctx.phase = 'identityRecognition'
    state.ctx.activePlayers = { '0': 'identityRecognition' }
    state.G.identityRecognition = {
      step: 'roleReveal', deadlineAt: 1000, confirmedCount: 0, participantCount: 5,
    }
    state.G.viewer.identityRecognition = {
      isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0,
    }
    const participant = renderRoomView({ gameState: state, room: fullRoom() }, true)

    state.G.viewer = {
      role: null, loyalty: null, knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
      identityRecognition: {
        isParticipant: false, confirmed: false, deadlineRefreshRequired: false, serverNow: 0,
      },
    }
    const nonparticipant = renderRoomView({ gameState: state, room: fullRoom() }, true)

    expect(participant).toContain('data-room-scene="identityConfirmation"')
    expect(participant).toContain('data-identity-confirmation-state="concealed"')
    expect(participant).toContain('aria-label="揭示身份"')
    expect(participant).not.toContain('data-identity-role-artwork')
    expect(participant).not.toContain('aria-label="查看我的身份与已知信息"')
    expect(nonparticipant).toContain('data-room-scene="identityRecognition"')
    expect(nonparticipant).toContain('data-curtain-state="closed"')
    expect(nonparticipant).toContain('等待参与玩家完成辨认')
    expect(nonparticipant).not.toContain('data-role-card=')
    expect(nonparticipant).not.toContain('data-role-avatar=')
    expect(nonparticipant).not.toContain('你的线索已确认')
  })

  it('marks only the requested empty seat as pending during a seat change', () => {
    const html = renderRoomView(
      {
        gameState: lobbyGameState(),
        room: incompleteRoomWithEmptySeat('3'),
        seatChangeTargetID: '3',
        startPending: false,
      },
      true,
    )

    expect(html).toContain('data-player-id="3"')
    expect(html).toContain('data-seat-state="pending"')
    expect(html).toContain('换座中')
    expect(html.match(/data-seat-state="pending"/g)).toHaveLength(1)
  })

  it('keeps the requested empty seat pending while its socket reconnects', () => {
    const reconnectingState = lobbyGameState()!
    reconnectingState.isConnected = false
    const html = renderRoomView(
      {
        gameState: reconnectingState,
        room: incompleteRoomWithEmptySeat('3'),
        seatChangeTargetID: '3',
      },
      true,
    )

    expect(html).toContain('data-room-scene="connectionRecovery"')
    expect(html).toContain('data-player-id="3"')
    expect(html).toContain('data-seat-state="pending"')
    expect(html).toContain('换座中')
  })

  it('keeps the original start label while the pending request disables it', () => {
    const html = renderRoomView({
      gameState: lobbyGameState(),
      room: fullRoom(),
      seatChangeTargetID: null,
      startPending: true,
    })

    expect(html).toContain('>开始游戏<')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>开始游戏<\/button>/)
  })
})
