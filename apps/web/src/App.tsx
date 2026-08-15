import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { AvalonGame, type AvalonG } from '@avalon/game'

import { webConfig } from './config'
import {
  AVALON_GAME_NAME,
  createAvalonLobbyClient,
  getMatchPlayerCount,
  getOccupiedPlayerIDs,
  isMatchFull,
  type AvalonMatch,
  type LobbyPlayer,
} from './lobby'
import {
  clearRoomSession,
  getAvailableSeatIDs,
  loadLastRoomSession,
  loadRoomSession,
  saveRoomSession,
  type RoomSession,
} from './room-session'

type AvalonClient = ReturnType<typeof Client<AvalonG>>
type AvalonClientState = ReturnType<AvalonClient['getState']>

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。'
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
  const lobby = useMemo(() => createAvalonLobbyClient(), [])
  const navigate = useNavigate()
  const lastRoomSession = useMemo(() => loadLastRoomSession(), [])
  const [playerName, setPlayerName] = useState(
    () => lastRoomSession?.playerName ?? '',
  )
  const [numPlayers, setNumPlayers] = useState(5)
  const [matches, setMatches] = useState<AvalonMatch[]>([])
  const [selectedSeats, setSelectedSeats] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshMatches = useCallback(async () => {
    try {
      const result = await lobby.listMatches(AVALON_GAME_NAME, {
        isGameover: false,
      })
      setMatches(result.matches as AvalonMatch[])
    } catch (requestError) {
      setError(`无法加载房间列表：${errorMessage(requestError)}`)
    }
  }, [lobby])

  useEffect(() => {
    void refreshMatches()
    const timer = window.setInterval(() => void refreshMatches(), 3000)
    return () => window.clearInterval(timer)
  }, [refreshMatches])

  const joinRoom = useCallback(async (matchID: string, playerID: string) => {
    const trimmedName = playerName.trim()
    if (trimmedName.length === 0) {
      throw new Error('请先填写玩家名称。')
    }

    const joined = await lobby.joinMatch(AVALON_GAME_NAME, matchID, {
      playerID,
      playerName: trimmedName,
    })
    const nextSession: RoomSession = {
      matchID,
      playerID: joined.playerID,
      credentials: joined.playerCredentials,
      playerName: trimmedName,
    }
    saveRoomSession(nextSession)
    return nextSession
  }, [lobby, playerName])

  const handleJoin = async (matchID: string, playerID: string) => {
    setBusy(true)
    setError(null)
    try {
      const nextSession = await joinRoom(matchID, playerID)
      navigate(`/rooms/${encodeURIComponent(nextSession.matchID)}`)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      const created = await lobby.createMatch(AVALON_GAME_NAME, {
        numPlayers,
      })
      const nextSession = await joinRoom(created.matchID, '0')
      navigate(`/rooms/${encodeURIComponent(nextSession.matchID)}`)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const handleResumeRoom = () => {
    if (lastRoomSession === null) return
    navigate(`/rooms/${encodeURIComponent(lastRoomSession.matchID)}`)
  }

  return (
    <LobbyView
      busy={busy}
      error={error}
      lastRoomSession={lastRoomSession}
      matches={matches}
      numPlayers={numPlayers}
      onCreate={handleCreate}
      onJoin={handleJoin}
      onRefresh={() => void refreshMatches()}
      onResumeRoom={handleResumeRoom}
      playerName={playerName}
      selectedSeats={selectedSeats}
      setNumPlayers={setNumPlayers}
      setPlayerName={setPlayerName}
      setSelectedSeats={setSelectedSeats}
    />
  )
}

function RoomRoute() {
  const { matchID = '' } = useParams()
  const navigate = useNavigate()
  const lobby = useMemo(() => createAvalonLobbyClient(), [])
  const clientRef = useRef<AvalonClient | null>(null)
  const [session, setSession] = useState<RoomSession | null>(() =>
    loadRoomSession(matchID),
  )
  const [room, setRoom] = useState<AvalonMatch | null>(null)
  const [gameState, setGameState] = useState<AvalonClientState>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshRoom = useCallback(async (roomID: string, silent = false) => {
    try {
      const nextRoom = await lobby.getMatch(AVALON_GAME_NAME, roomID)
      setRoom(nextRoom as AvalonMatch)
    } catch (requestError) {
      if (!silent) {
        setError(`无法加载房间：${errorMessage(requestError)}`)
      }
    }
  }, [lobby])

  useEffect(() => {
    setSession((currentSession) => {
      if (currentSession?.matchID === matchID) return currentSession
      return loadRoomSession(matchID)
    })
    setRoom(null)
    setGameState(null)
    setError(null)
  }, [matchID])

  const routeSession = session?.matchID === matchID ? session : null

  useEffect(() => {
    if (routeSession === null) {
      setRoom(null)
      setGameState(null)
      return
    }

    let active = true
    let unsubscribe: () => void = () => undefined
    let client: AvalonClient | null = null
    setRoom(null)
    setGameState(null)

    const connect = async () => {
      try {
        const initialRoom = await lobby.getMatch(AVALON_GAME_NAME, matchID)
        if (!active) return

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
          if (!active) return
          setGameState(nextState)
          if (client?.matchData !== undefined) {
            setRoom((previousRoom) =>
              previousRoom === null
                ? previousRoom
                : {
                    ...previousRoom,
                    players: client?.matchData as unknown as LobbyPlayer[],
                  },
            )
          }
        })
        client.start()
      } catch (requestError) {
        if (active) {
          setError(`无法连接房间：${errorMessage(requestError)}`)
        }
      }
    }

    void connect()
    const timer = window.setInterval(
      () => void refreshRoom(matchID, true),
      2500,
    )

    return () => {
      active = false
      window.clearInterval(timer)
      unsubscribe()
      client?.stop()
      if (clientRef.current === client) clientRef.current = null
    }
  }, [lobby, matchID, refreshRoom, routeSession])

  const handleStart = () => {
    if (gameState?.isActive && routeSession?.playerID === '0') {
      clientRef.current?.moves.startGame()
    }
  }

  const handleReconnect = () => {
    const client = clientRef.current
    if (client === null) return
    client.stop()
    client.start()
  }

  const handleForgetSession = () => {
    const confirmed = window.confirm(
      '这只会清除本机凭据，不会释放服务器上的座位。确定继续吗？',
    )
    if (!confirmed) return

    clientRef.current?.stop()
    clearRoomSession(matchID)
    setSession(null)
    setError(null)
    navigate('/')
  }

  if (routeSession === null) {
    return <RoomAccessView matchID={matchID} onBackHome={() => navigate('/')} />
  }

  if (room === null) {
    return <RoomLoadingView matchID={matchID} onBackHome={() => navigate('/')} error={error} />
  }

  return (
    <RoomView
      gameState={gameState}
      onBackHome={() => navigate('/')}
      onForgetSession={handleForgetSession}
      onReconnect={handleReconnect}
      onStart={handleStart}
      room={room}
      session={routeSession}
    />
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

function RoomLoadingView({
  error,
  matchID,
  onBackHome,
}: {
  error: string | null
  matchID: string
  onBackHome: () => void
}) {
  return (
    <PageShell eyebrow={`Room ${matchID}`} title="正在连接房间">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
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
      </section>
    </PageShell>
  )
}

interface LobbyViewProps {
  busy: boolean
  error: string | null
  lastRoomSession: RoomSession | null
  matches: AvalonMatch[]
  numPlayers: number
  onCreate: () => void
  onJoin: (matchID: string, playerID: string) => void
  onRefresh: () => void
  onResumeRoom: () => void
  playerName: string
  selectedSeats: Record<string, string>
  setNumPlayers: (value: number) => void
  setPlayerName: (value: string) => void
  setSelectedSeats: Dispatch<SetStateAction<Record<string, string>>>
}

function LobbyView({
  busy,
  error,
  lastRoomSession,
  matches,
  numPlayers,
  onCreate,
  onJoin,
  onRefresh,
  onResumeRoom,
  playerName,
  selectedSeats,
  setNumPlayers,
  setPlayerName,
  setSelectedSeats,
}: LobbyViewProps) {
  return (
    <PageShell eyebrow="LAN MVP" title="Avalon">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
            Create a room
          </p>
          <h2 className="text-2xl font-semibold text-white">开一局新的阿瓦隆</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            创建者自动占用 0 号座位。其他设备打开同一个局域网地址即可加入。
          </p>

          <label className="mt-8 block text-sm font-medium text-slate-200" htmlFor="player-name">
            玩家名称
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20"
            id="player-name"
            maxLength={24}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="例如：亚瑟"
            value={playerName}
          />

          <label className="mt-5 block text-sm font-medium text-slate-200" htmlFor="player-count">
            玩家人数
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20"
            id="player-count"
            onChange={(event) => setNumPlayers(Number(event.target.value))}
            value={numPlayers}
          >
            {Array.from({ length: 6 }, (_, index) => index + 5).map((count) => (
              <option key={count} value={count}>
                {count} 人
              </option>
            ))}
          </select>

          <button
            className="mt-6 w-full rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || playerName.trim().length === 0}
            onClick={onCreate}
            type="button"
          >
            {busy ? '处理中…' : '创建并进入房间'}
          </button>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Open rooms
              </p>
              <h2 className="text-2xl font-semibold text-white">加入已有房间</h2>
            </div>
            <button
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
              onClick={onRefresh}
              type="button"
            >
              刷新
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              当前没有可加入的房间。你可以先创建一局。
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {matches.map((match) => {
                const availableSeats = getAvailableSeatIDs(
                  getMatchPlayerCount(match),
                  getOccupiedPlayerIDs(match),
                )
                const selectedSeat = selectedSeats[match.matchID] ?? availableSeats[0] ?? ''

                return (
                  <div
                    className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
                    key={match.matchID}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm text-slate-200">{match.matchID}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {getOccupiedPlayerIDs(match).length} / {getMatchPlayerCount(match)} 人已入座
                        </p>
                      </div>
                      {isMatchFull(match) ? (
                        <span className="rounded-full bg-slate-700/70 px-3 py-1 text-xs text-slate-300">
                          已满
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-sm text-white"
                            onChange={(event) =>
                              setSelectedSeats((previous) => ({
                                ...previous,
                                [match.matchID]: event.target.value,
                              }))
                            }
                            value={selectedSeat}
                          >
                            {availableSeats.map((seatID) => (
                              <option key={seatID} value={seatID}>
                                座位 {Number(seatID) + 1}
                              </option>
                            ))}
                          </select>
                          <button
                            className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={busy || playerName.trim().length === 0 || selectedSeat === ''}
                            onClick={() => onJoin(match.matchID, selectedSeat)}
                            type="button"
                          >
                            加入
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {lastRoomSession !== null && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Recent room
            </p>
            <p className="mt-1 text-sm text-amber-50">
              继续房间 <span className="font-mono">{lastRoomSession.matchID}</span> · 座位{' '}
              {Number(lastRoomSession.playerID) + 1}
            </p>
          </div>
          <button
            className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
            onClick={onResumeRoom}
            type="button"
          >
            继续进入
          </button>
        </section>
      )}

      <ErrorNotice error={error} />
    </PageShell>
  )
}

interface RoomViewProps {
  gameState: AvalonClientState
  onBackHome: () => void
  onForgetSession: () => void
  onReconnect: () => void
  onStart: () => void
  room: AvalonMatch
  session: RoomSession
}

function RoomView({
  gameState,
  onBackHome,
  onForgetSession,
  onReconnect,
  onStart,
  room,
  session,
}: RoomViewProps) {
  const numPlayers = getMatchPlayerCount(room)
  const occupiedPlayerIDs = getOccupiedPlayerIDs(room)
  const isFull = occupiedPlayerIDs.length === numPlayers
  const phase = gameState?.ctx.phase
  const connected = gameState?.isConnected === true
  const canStart =
    connected &&
    gameState?.isActive === true &&
    session.playerID === '0' &&
    phase === 'lobby' &&
    isFull

  return (
    <PageShell eyebrow={`Room ${room.matchID}`} title="房间等待中">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
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
                value={gameState?.G.leaderID === null ? '尚未产生' : `座位 ${Number(gameState?.G.leaderID) + 1}`}
              />
            </div>

            {phase === 'lobby' && (
              <button
                className="mt-6 w-full rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canStart}
                onClick={onStart}
                type="button"
              >
                {isFull ? '开始游戏' : `还差 ${numPlayers - occupiedPlayerIDs.length} 人`}
              </button>
            )}

            {phase !== undefined && phase !== 'lobby' && (
              <div className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">
                游戏核心已连接。完整的队伍、投票和任务操作界面将在下一模块接入。
              </div>
            )}
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
            <button
              className="ml-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200 transition hover:border-rose-300/50"
              onClick={onForgetSession}
              type="button"
            >
              清除本机凭据
            </button>
          </section>
        </aside>
      </div>
    </PageShell>
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
