import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  AvalonGame,
  type AvalonG,
  type AvalonPlayerView,
  type PlayerID,
  type TeamVote,
} from '@avalon/game'

import { webConfig } from './config'
import { getClientID } from './client-identity'
import { createDevToolsClient } from './dev-tools'
import { executePendingJoin, type PendingJoin } from './join-flow'
import { LobbyView } from './LobbyView'
import { RoomDevTools } from './RoomDevTools'
import { RoomExitDialog } from './RoomExitDialog'
import { RoomGamePanel } from './RoomGamePanel'
import { RoomLobbyPanel } from './RoomLobbyPanel'
import {
  dissolveRoom,
  getRoomExitErrorMessage,
  leaveRoom,
} from './room-participation'
import {
  consumeRoomNavigationNotice,
  getRoomNavigationNotice,
  isRoomRouteGenerationCurrent,
  stopCurrentClient,
} from './room-navigation'
import {
  AVALON_GAME_NAME,
  createAvalonLobbyClient,
  getMatchPlayerCount,
  getOccupiedPlayerIDs,
  type AvalonMatch,
  type LobbyPlayer,
} from './lobby'
import {
  getPreferredPlayerName,
  loadPlayerName,
  savePlayerName,
} from './player-name'
import {
  LAST_ROOM_SESSION_KEY,
  ROOM_SESSION_KEY,
  clearRoomSession,
  getRoomSessionKey,
  getRoomSessionInvalidationNotice,
  isRoomSessionStillValid,
  loadLastRoomSession,
  loadRoomSession,
  saveRoomSession,
  validateActiveRoomSessions,
  validateRoomSession,
  type RoomSession,
} from './room-session'
import {
  fetchRoomSummaries,
  type AvalonRoomSummary,
} from './room-directory'

type AvalonClient = ReturnType<typeof Client<AvalonG>>
type AvalonRawClientState = NonNullable<ReturnType<AvalonClient['getState']>>
type AvalonClientState = Omit<AvalonRawClientState, 'G'> & {
  G: AvalonPlayerView
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'HTTP status 409') {
    return '这个房间的座位已被占用，或当前浏览器已经在本局入座。'
  }

  return error instanceof Error ? error.message : '请求失败，请稍后重试。'
}

function roomInvalidationNotice(error: unknown) {
  return getRoomSessionInvalidationNotice(error) ?? (
    error instanceof Error && error.message === 'HTTP status 404'
      ? '房主已解散房间，已返回主页。'
      : null
  )
}

function phaseLabel(phase: string | undefined) {
  switch (phase) {
    case 'lobby':
      return '等待入座'
    case 'teamProposal':
      return '队伍提案'
    case 'teamVote':
      return '队伍投票'
    case 'quest':
      return '任务进行中'
    case 'assassination':
      return '刺杀阶段'
    default:
      return phase ?? '连接中'
  }
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LobbyRoute />} path="/" />
        <Route element={<RoomRoute />} path="/rooms/:matchID" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}

function LobbyRoute() {
  const location = useLocation()
  const lobby = useMemo(() => createAvalonLobbyClient(), [])
  const devTools = useMemo(() => createDevToolsClient(webConfig.lobbyURL), [])
  const clientID = useMemo(() => getClientID(), [])
  const navigate = useNavigate()
  const [lastRoomSession, setLastRoomSession] = useState<RoomSession | null>(() =>
    loadLastRoomSession(),
  )
  const [activeRoomSessions, setActiveRoomSessions] = useState<RoomSession[]>([])
  const [roomAccessStatus, setRoomAccessStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking')
  const [roomAccessError, setRoomAccessError] = useState<string | null>(null)
  const [pendingJoin, setPendingJoin] = useState<PendingJoin | null>(null)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameDialogValue, setNameDialogValue] = useState('')
  const [nameDialogError, setNameDialogError] = useState<string | null>(null)
  const [numPlayers, setNumPlayers] = useState(5)
  const [matches, setMatches] = useState<AvalonRoomSummary[]>([])
  const [selectedSeats, setSelectedSeats] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    getRoomNavigationNotice(location.state),
  )
  const roomNotice = getRoomNavigationNotice(location.state)
  useEffect(() => {
    if (roomNotice === null) return

    setError(roomNotice)
    navigate(location.pathname, {
      replace: true,
      state: consumeRoomNavigationNotice(location.state),
    })
  }, [location.pathname, location.state, navigate, roomNotice])
  const [devToolsEnabled, setDevToolsEnabled] = useState(false)
  const [devToken, setDevToken] = useState('')
  const requestInFlightRef = useRef(false)
  const refreshGenerationRef = useRef(0)
  const roomAccessPending = roomAccessStatus === 'checking'
  const roomAccessUnavailable = roomAccessStatus === 'unavailable'
  const roomAccessLocked = roomAccessStatus !== 'ready' || activeRoomSessions.length > 0

  const refreshMatches = useCallback(async () => {
    const generation = ++refreshGenerationRef.current
    try {
      const nextMatches = await fetchRoomSummaries(webConfig.lobbyURL)
      if (generation !== refreshGenerationRef.current) return
      setMatches(nextMatches)

      const validation = await validateActiveRoomSessions(
        nextMatches,
        webConfig.lobbyURL,
      )
      if (generation !== refreshGenerationRef.current) return

      setActiveRoomSessions(validation.sessions)
      setLastRoomSession(loadLastRoomSession())
      setRoomAccessStatus(validation.validationFailed ? 'unavailable' : 'ready')
      setRoomAccessError(
        validation.validationFailed
          ? '暂时无法确认部分房间状态；已保留当前房间限制。'
          : null,
      )
    } catch (requestError) {
      if (generation !== refreshGenerationRef.current) return
      setRoomAccessStatus('unavailable')
      setError(`无法加载房间列表：${errorMessage(requestError)}`)
    }
  }, [])

  useEffect(() => {
    void devTools
      .getStatus()
      .then((status) => setDevToolsEnabled(status.enabled))
      .catch(() => setDevToolsEnabled(false))
  }, [devTools])

  useEffect(() => {
    void refreshMatches()
    const timer = window.setInterval(() => void refreshMatches(), 3000)
    return () => window.clearInterval(timer)
  }, [refreshMatches])

  useEffect(() => {
    const handleRoomSessionStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return
      if (
        event.key !== null &&
        event.key !== ROOM_SESSION_KEY &&
        event.key !== LAST_ROOM_SESSION_KEY &&
        !event.key.startsWith(`${ROOM_SESSION_KEY}:`)
      ) return

      setPendingJoin(null)
      setNameDialogOpen(false)
      setNameDialogValue('')
      setNameDialogError(null)
      setRoomAccessStatus('checking')
      void refreshMatches()
    }

    window.addEventListener('storage', handleRoomSessionStorage)
    return () => window.removeEventListener('storage', handleRoomSessionStorage)
  }, [refreshMatches])

  const executePendingJoinRequest = useCallback(
    async (intent: PendingJoin, playerName: string) => {
      if (requestInFlightRef.current || roomAccessLocked) return

      requestInFlightRef.current = true
      setBusy(true)
      setError(null)
      setNameDialogError(null)

      try {
        const session = await executePendingJoin(lobby, intent, {
          clientID,
          gameName: AVALON_GAME_NAME,
          playerName,
        })
        savePlayerName(session.playerName)
        saveRoomSession(session)
        setPendingJoin(null)
        setNameDialogOpen(false)
        setNameDialogValue('')
        setNameDialogError(null)
        navigate(`/rooms/${encodeURIComponent(session.matchID)}`)
      } catch (requestError) {
        setNameDialogValue(playerName)
        setNameDialogError(errorMessage(requestError))
        setNameDialogOpen(true)
      } finally {
        requestInFlightRef.current = false
        setBusy(false)
      }
    },
    [clientID, lobby, navigate, roomAccessLocked],
  )

  const beginPendingJoin = useCallback(
    (intent: PendingJoin) => {
      if (requestInFlightRef.current || roomAccessLocked) return

      const preferredName = getPreferredPlayerName(
        loadPlayerName(),
        lastRoomSession?.playerName ?? null,
      )
      setPendingJoin(intent)
      setError(null)

      if (preferredName !== null) {
        void executePendingJoinRequest(intent, preferredName)
        return
      }

      setNameDialogValue('')
      setNameDialogError(null)
      setNameDialogOpen(true)
    },
    [executePendingJoinRequest, lastRoomSession, roomAccessLocked],
  )

  const handleJoin = (matchID: string, playerID: string) => {
    beginPendingJoin({ type: 'join', matchID, playerID })
  }

  const handleCreate = () => {
    beginPendingJoin({ type: 'create', numPlayers })
  }

  const handleNameDialogCancel = () => {
    if (requestInFlightRef.current) return

    setPendingJoin(null)
    setNameDialogOpen(false)
    setNameDialogValue('')
    setNameDialogError(null)
  }

  const handleNameDialogSubmit = () => {
    if (pendingJoin === null || requestInFlightRef.current || roomAccessLocked) return

    if (nameDialogValue.trim().length === 0) {
      setNameDialogError('玩家名称不能为空')
      return
    }

    void executePendingJoinRequest(pendingJoin, nameDialogValue)
  }

  const handleEnterRoom = (matchID: string) => {
    if (!activeRoomSessions.some((session) => session.matchID === matchID)) return
    navigate(`/rooms/${encodeURIComponent(matchID)}`)
  }

  const handleDeleteRoom = async (matchID: string) => {
    if (!devToolsEnabled || devToken.length === 0) return
    if (!window.confirm(`确定删除房间 ${matchID} 吗？`)) return

    try {
      await devTools.deleteRoom(matchID, devToken)
      clearRoomSession(matchID)
      setLastRoomSession(loadLastRoomSession())
      await refreshMatches()
    } catch (requestError) {
      setError(`无法删除房间：${errorMessage(requestError)}`)
    }
  }

  return (
    <>
      <LobbyView
        activeRoomSessions={activeRoomSessions}
        busy={busy}
        error={roomNotice ?? error ?? roomAccessError}
        devToken={devToken}
        devToolsEnabled={devToolsEnabled}
        matches={matches}
        numPlayers={numPlayers}
        onCreate={handleCreate}
        onEnterRoom={handleEnterRoom}
        onJoin={handleJoin}
        onRefresh={() => void refreshMatches()}
        onDeleteRoom={handleDeleteRoom}
        onDevTokenChange={setDevToken}
        roomAccessLocked={roomAccessLocked}
        roomAccessPending={roomAccessPending}
        roomAccessUnavailable={roomAccessUnavailable}
        selectedSeats={selectedSeats}
        setNumPlayers={setNumPlayers}
        setSelectedSeats={setSelectedSeats}
      />
      <PlayerNameDialog
        busy={busy}
        error={nameDialogError}
        onCancel={handleNameDialogCancel}
        onChange={setNameDialogValue}
        onSubmit={handleNameDialogSubmit}
        open={nameDialogOpen}
        value={nameDialogValue}
      />
    </>
  )
}

function RoomRoute() {
  const { matchID = '' } = useParams()
  const navigate = useNavigate()
  const lobby = useMemo(() => createAvalonLobbyClient(), [])
  const devTools = useMemo(() => createDevToolsClient(webConfig.lobbyURL), [])
  const clientRef = useRef<AvalonClient | null>(null)
  const routeGenerationRef = useRef(0)
  const [session, setSession] = useState<RoomSession | null>(() =>
    loadRoomSession(matchID),
  )
  const [room, setRoom] = useState<AvalonMatch | null>(null)
  const [gameState, setGameState] = useState<AvalonClientState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roomExitDialogOpen, setRoomExitDialogOpen] = useState(false)
  const [roomExitBusy, setRoomExitBusy] = useState(false)
  const [roomExitError, setRoomExitError] = useState<string | null>(null)

  const invalidateSession = useCallback(
    (reason: string, generation: number) => {
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

      stopCurrentClient(clientRef)
      clearRoomSession(matchID)
      setSession(null)
      setError(reason)
      navigate('/', { state: { roomNotice: reason } })
    },
    [matchID, navigate],
  )

  const refreshRoom = useCallback(
    async (
      roomID: string,
      currentSession: RoomSession,
      generation: number,
      silent = false,
    ) => {
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

      try {
        const [nextRoom] = await Promise.all([
          lobby.getMatch(AVALON_GAME_NAME, roomID),
          validateRoomSession(webConfig.lobbyURL, currentSession),
        ])
        if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

        const nextRoomValue = nextRoom as AvalonMatch
        if (!isRoomSessionStillValid(nextRoomValue, currentSession)) {
          invalidateSession('你的房间座位已被释放，已返回主页。', generation)
          return
        }
        setRoom(nextRoomValue)
      } catch (requestError) {
        if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
        const invalidationNotice = roomInvalidationNotice(requestError)
        if (invalidationNotice !== null) {
          invalidateSession(invalidationNotice, generation)
          return
        }
        if (!silent) {
          setError(`无法加载房间：${errorMessage(requestError)}`)
        }
      }
    },
    [invalidateSession, lobby],
  )

  useEffect(() => {
    setSession((currentSession) => {
      if (currentSession?.matchID === matchID) return currentSession
      return loadRoomSession(matchID)
    })
    setRoom(null)
    setGameState(null)
    setError(null)
    setRoomExitDialogOpen(false)
    setRoomExitBusy(false)
    setRoomExitError(null)
  }, [matchID])

  const routeSession = session?.matchID === matchID ? session : null

  useEffect(() => {
    const handleRoomSessionStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || routeSession === null) return
      if (
        event.key !== null &&
        event.key !== getRoomSessionKey(matchID) &&
        event.key !== ROOM_SESSION_KEY &&
        event.key !== LAST_ROOM_SESSION_KEY
      ) return
      if (loadRoomSession(matchID) !== null) return

      stopCurrentClient(clientRef)
      setSession(null)
      setRoomExitDialogOpen(false)
      setRoomExitBusy(false)
      setRoomExitError(null)
      navigate('/', {
        state: { roomNotice: '本机房间会话已结束，已返回主页。' },
      })
    }

    window.addEventListener('storage', handleRoomSessionStorage)
    return () => window.removeEventListener('storage', handleRoomSessionStorage)
  }, [matchID, navigate, routeSession])

  useEffect(() => {
    if (routeSession === null) {
      setRoom(null)
      setGameState(null)
      return
    }

    const generation = ++routeGenerationRef.current
    let active = true
    let unsubscribe: () => void = () => undefined
    let client: AvalonClient | null = null
    setRoom(null)
    setGameState(null)

    const connect = async () => {
      try {
        const [initialRoom] = await Promise.all([
          lobby.getMatch(AVALON_GAME_NAME, matchID),
          validateRoomSession(webConfig.lobbyURL, routeSession),
        ])
        if (!active || !isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

        if (!isRoomSessionStillValid(initialRoom as AvalonMatch, routeSession)) {
          invalidateSession('你的房间座位已被释放，已返回主页。', generation)
          return
        }

        setRoom(initialRoom as AvalonMatch)
        client = Client({
          debug: { collapseOnLoad: true },
          game: AvalonGame,
          numPlayers: getMatchPlayerCount(initialRoom as AvalonMatch),
          multiplayer: SocketIO({
            server: webConfig.gameURL,
          }),
          matchID,
          playerID: routeSession.playerID,
          credentials: routeSession.credentials,
        })
        clientRef.current = client
        unsubscribe = client.subscribe((nextState) => {
          if (!active || !isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
          setGameState(nextState as AvalonClientState | null)
          if (client?.matchData !== undefined) {
            const players = client.matchData as unknown as LobbyPlayer[]
            if (!isRoomSessionStillValid({ players }, routeSession)) {
              invalidateSession('你的房间座位已被释放，已返回主页。', generation)
              return
            }
            setRoom((previousRoom) =>
              previousRoom === null
                ? previousRoom
                : {
                    ...previousRoom,
                    players,
                  },
            )
          }
        })
        client.start()
      } catch (requestError) {
        if (active && isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) {
          const invalidationNotice = roomInvalidationNotice(requestError)
          if (invalidationNotice !== null) {
            invalidateSession(invalidationNotice, generation)
          } else {
            setError(`无法连接房间：${errorMessage(requestError)}`)
          }
        }
      }
    }

    void connect()
    const timer = window.setInterval(
      () => void refreshRoom(matchID, routeSession, generation, true),
      2500,
    )

    return () => {
      active = false
      if (isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) {
        routeGenerationRef.current += 1
      }
      window.clearInterval(timer)
      unsubscribe()
      if (client !== null) stopCurrentClient(clientRef, client)
    }
  }, [invalidateSession, lobby, matchID, refreshRoom, routeSession])

  const handleStart = () => {
    if (gameState?.isActive && routeSession?.playerID === '0') {
      clientRef.current?.moves.startGame()
    }
  }

  const handleProposeTeam = (team: PlayerID[]) => {
    if (gameState?.isActive) {
      clientRef.current?.moves.proposeTeam(team)
    }
  }

  const handleCastTeamVote = (vote: TeamVote) => {
    if (gameState?.isActive) {
      clientRef.current?.moves.castTeamVote(vote)
    }
  }

  const handleReconnect = () => {
    const client = clientRef.current
    if (client === null) return
    client.stop()
    client.start()
  }

  const handleClearLocalSessionForTesting = () => {
    const confirmed = window.confirm(
      '这只会清除本机凭据，不会释放服务器上的座位。确定继续吗？',
    )
    if (!confirmed) return

    stopCurrentClient(clientRef)
    clearRoomSession(matchID)
    setSession(null)
    setError(null)
    navigate('/')
  }

  const handleRequestRoomExit = () => {
    if (routeSession === null || gameState?.ctx.phase !== 'lobby' || roomExitBusy) return

    setRoomExitError(null)
    setRoomExitDialogOpen(true)
  }

  const handleCancelRoomExit = () => {
    if (roomExitBusy) return

    setRoomExitDialogOpen(false)
    setRoomExitError(null)
  }

  const handleConfirmRoomExit = async () => {
    if (routeSession === null || gameState?.ctx.phase !== 'lobby' || roomExitBusy) return

    const currentSession = routeSession
    const generation = routeGenerationRef.current
    const isHost = currentSession.playerID === '0'
    setRoomExitBusy(true)
    setRoomExitError(null)

    try {
      if (isHost) {
        await dissolveRoom(webConfig.lobbyURL, currentSession)
      } else {
        await leaveRoom(webConfig.lobbyURL, currentSession)
      }
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

      stopCurrentClient(clientRef)
      clearRoomSession(matchID)
      setSession(null)
      setRoomExitDialogOpen(false)
      navigate('/', {
        state: {
          roomNotice: isHost
            ? '房间已解散。'
            : '已退出房间并释放座位。',
        },
      })
    } catch (actionError) {
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
      setRoomExitError(getRoomExitErrorMessage(actionError, isHost))
    } finally {
      if (isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) {
        setRoomExitBusy(false)
      }
    }
  }

  const handleDeleteRoom = async (token: string) => {
    const generation = routeGenerationRef.current
    await devTools.deleteRoom(matchID, token)
    if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
    stopCurrentClient(clientRef)
    clearRoomSession(matchID)
    setSession(null)
    navigate('/', { state: { roomNotice: '房间已被删除，已返回主页。' } })
  }

  const handleKickPlayer = async (playerID: string, token: string) => {
    const generation = routeGenerationRef.current
    await devTools.kickPlayer(matchID, playerID, token)
    if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
    if (playerID === routeSession?.playerID) {
      stopCurrentClient(clientRef)
      clearRoomSession(matchID)
      setSession(null)
      navigate('/', { state: { roomNotice: '你的房间座位已被释放，已返回主页。' } })
      return
    }
    if (routeSession !== null) {
      await refreshRoom(matchID, routeSession, generation)
    }
  }

  if (routeSession === null) {
    return <RoomAccessView matchID={matchID} onBackHome={() => navigate('/')} />
  }

  return (
    <>
      <RoomView
        error={error}
        gameState={gameState}
        onBackHome={() => navigate('/')}
        onCastTeamVote={handleCastTeamVote}
        onClearLocalSession={handleClearLocalSessionForTesting}
        onProposeTeam={handleProposeTeam}
        onReconnect={handleReconnect}
        onRequestRoomExit={handleRequestRoomExit}
        onStart={handleStart}
        onDeleteRoom={handleDeleteRoom}
        onKickPlayer={handleKickPlayer}
        room={room}
        roomExitBusy={roomExitBusy}
        session={routeSession}
      />
      <RoomExitDialog
        busy={roomExitBusy}
        error={roomExitError}
        isHost={routeSession.playerID === '0'}
        onCancel={handleCancelRoomExit}
        onConfirm={() => void handleConfirmRoomExit()}
        open={roomExitDialogOpen}
      />
    </>
  )
}

function RoomAccessView({
  matchID,
  onBackHome,
}: {
  matchID: string
  onBackHome: () => void
}) {
  return (
    <PageShell eyebrow={`Room ${matchID}`} title="进入房间">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <p className="text-sm leading-6 text-slate-300">
          这台设备还没有该房间的座位凭据。请返回主页，从房间列表选择座位后加入。
        </p>
        <button
          className="mt-6 rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200"
          onClick={onBackHome}
          type="button"
        >
          返回主页
        </button>
      </section>
    </PageShell>
  )
}

function RoomLoadingContent({
  error,
  matchID,
  onBackHome,
}: {
  error: string | null
  matchID: string
  onBackHome: () => void
}) {
  return (
    <section className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/35 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          Room {matchID}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">正在连接房间</h1>
        <p className="text-sm leading-6 text-slate-300">
          正在读取房间状态并建立实时连接，请稍候。
        </p>
        <ErrorNotice error={error} />
        <button
          className="mt-6 rounded-xl border border-white/15 px-4 py-3 font-semibold text-slate-200 transition hover:border-amber-300/60 hover:text-white"
          onClick={onBackHome}
          type="button"
        >
          返回主页
        </button>
      </div>
    </section>
  )
}

function PlayerNameDialog({
  busy,
  error,
  onCancel,
  onChange,
  onSubmit,
  open,
  value,
}: {
  busy: boolean
  error: string | null
  onCancel: () => void
  onChange: (value: string) => void
  onSubmit: () => void
  open: boolean
  value: string
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      aria-labelledby="player-name-dialog-title"
      className="w-[calc(100%-2rem)] max-w-md rounded-3xl border border-white/15 bg-slate-900 p-0 text-slate-200 shadow-2xl shadow-black/40 backdrop:bg-slate-950/70"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      ref={dialogRef}
    >
      <form
        className="p-6 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <h2 className="text-2xl font-semibold text-white" id="player-name-dialog-title">
          输入玩家名称
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          进入房间前，请告诉大家你想使用的名字。
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-200" htmlFor="dialog-player-name">
          玩家名称
        </label>
        <input
          autoFocus
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20"
          id="dialog-player-name"
          maxLength={24}
          onChange={(event) => onChange(event.target.value)}
          placeholder="例如：亚瑟"
          value={value}
        />
        {error !== null && (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-white/15 px-4 py-3 font-semibold text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? '处理中…' : '确认并进入'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export interface RoomViewProps {
  error: string | null
  gameState: AvalonClientState | null
  onBackHome: () => void
  onCastTeamVote: (vote: TeamVote) => void
  onClearLocalSession: () => void
  onProposeTeam: (team: PlayerID[]) => void
  onReconnect: () => void
  onRequestRoomExit: () => void
  onStart: () => void
  onDeleteRoom: (token: string) => Promise<void>
  onKickPlayer: (playerID: string, token: string) => Promise<void>
  room: AvalonMatch | null
  roomExitBusy: boolean
  session: RoomSession
}

export function RoomView({
  error,
  gameState,
  onBackHome,
  onCastTeamVote,
  onClearLocalSession,
  onProposeTeam,
  onReconnect,
  onRequestRoomExit,
  onStart,
  onDeleteRoom,
  onKickPlayer,
  room,
  roomExitBusy,
  session,
}: RoomViewProps) {
  if (room === null || gameState === null) {
    return (
      <ImmersiveLobbyShell developmentControls={null}>
        <RoomLoadingContent
          error={error}
          matchID={session.matchID}
          onBackHome={onBackHome}
        />
      </ImmersiveLobbyShell>
    )
  }

  const numPlayers = getMatchPlayerCount(room)
  const occupiedPlayerIDs = getOccupiedPlayerIDs(room)
  const isFull = occupiedPlayerIDs.length === numPlayers
  const phase = gameState?.ctx.phase
  const activeStage = gameState?.ctx.activePlayers?.[session.playerID]
  const connected = gameState?.isConnected === true
  const canStart =
    connected &&
    gameState?.isActive === true &&
    session.playerID === '0' &&
    phase === 'lobby' &&
    isFull

  if (phase === 'lobby') {
    return (
      <ImmersiveLobbyShell
        developmentControls={(
          <RoomDevTools
            matchID={room.matchID}
            onClearLocalSession={onClearLocalSession}
            onDeleteRoom={onDeleteRoom}
            onKickPlayer={onKickPlayer}
            phase={phase}
            players={room.players}
          />
        )}
      >
        <RoomLobbyPanel
          canStart={canStart}
          connected={connected}
          currentPlayerID={session.playerID}
          matchID={room.matchID}
          numPlayers={numPlayers}
          occupiedPlayerIDs={occupiedPlayerIDs}
          onBackHome={onBackHome}
          onReconnect={onReconnect}
          onRequestRoomExit={onRequestRoomExit}
          onStart={onStart}
          players={room.players}
          roomExitBusy={roomExitBusy}
        />
      </ImmersiveLobbyShell>
    )
  }

  return (
    <PageShell eyebrow={`Room ${room.matchID}`} title="房间等待中">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-slate-400">{room.matchID}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">玩家座位</h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-300/60 hover:text-white"
                  onClick={onBackHome}
                  type="button"
                >
                  返回主页
                </button>
                <ConnectionBadge connected={connected} />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: numPlayers }, (_, index) => {
                const player = room.players.find(({ id }) => id === index)
                const occupied = player?.name !== undefined && player.name !== null
                const isCurrentPlayer = String(index) === session.playerID

                return (
                  <div
                    className={`rounded-2xl border p-4 ${
                      isCurrentPlayer
                        ? 'border-amber-300/70 bg-amber-300/10'
                        : 'border-white/10 bg-slate-950/30'
                    }`}
                    key={index}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        座位 {index + 1}
                      </span>
                      {isCurrentPlayer && (
                        <span className="text-xs font-semibold text-amber-300">这是你</span>
                      )}
                    </div>
                    <p className="mt-3 font-medium text-white">
                      {occupied ? player?.name : '等待玩家加入'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {player?.isConnected ? '已连接' : occupied ? '等待连接' : '空座位'}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <RoomGamePanel
            activeStage={activeStage}
            game={gameState?.G ?? null}
            onCastTeamVote={onCastTeamVote}
            onProposeTeam={onProposeTeam}
            phase={phase}
            playerID={session.playerID}
          />
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
              Game status
            </p>
            <div className="mt-5 space-y-4 text-sm">
              <StatusRow label="当前阶段" value={phaseLabel(phase)} />
              <StatusRow label="你的座位" value={`座位 ${Number(session.playerID) + 1}`} />
              <StatusRow
                label="队长"
                value={
                  gameState?.G.leaderID === null || gameState?.G.leaderID === undefined
                    ? '尚未产生'
                    : `座位 ${Number(gameState.G.leaderID) + 1}`
                }
              />
            </div>

          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm leading-6 text-slate-400">
            <p>刷新页面会使用本机保存的座位凭据自动重连。</p>
            <button
              className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-white/30 hover:text-white"
              onClick={onReconnect}
              type="button"
            >
              重新连接
            </button>
          </section>

          <RoomDevTools
            matchID={room.matchID}
            onClearLocalSession={onClearLocalSession}
            onDeleteRoom={onDeleteRoom}
            onKickPlayer={onKickPlayer}
            phase={phase}
            players={room.players}
          />
        </aside>
      </div>
    </PageShell>
  )
}

function ImmersiveLobbyShell({
  children,
  developmentControls,
}: {
  children: ReactNode
  developmentControls: ReactNode
}) {
  return (
    <main className="relative h-screen h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_35%),#07111f] p-2 text-slate-200 sm:p-3 lg:p-4">
      <div className="mx-auto h-full min-h-0 max-w-7xl">{children}</div>
      <aside className="absolute bottom-2 right-2 z-50 max-h-[calc(100dvh-1rem)] w-[min(24rem,calc(100%-1rem))] overflow-auto">
        {developmentControls}
      </aside>
    </main>
  )
}

function PageShell({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_35%),#07111f] px-4 py-6 text-slate-200 sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-12">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300 text-xl font-black text-slate-950 shadow-lg shadow-amber-300/20">
                A
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                The Resistance
              </span>
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
          </div>
          <p className="max-w-xs text-right text-sm leading-6 text-slate-400">
            局域网在线阿瓦隆 · 5–10 人 · 服务端权威状态
          </p>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
          Secrets stay on the server. This browser only receives its filtered player view.
        </footer>
      </div>
    </main>
  )
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
        connected
          ? 'bg-emerald-300/15 text-emerald-200'
          : 'bg-rose-300/15 text-rose-200'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-300' : 'bg-rose-300'}`} />
      {connected ? '已连接' : '连接中断'}
    </span>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  )
}

function ErrorNotice({ error }: { error: string | null }) {
  if (error === null) return null

  return (
    <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
      {error}
    </div>
  )
}

export default App
