import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  type AvalonRoleConfiguration,
  type AvalonRoomSummary,
  type PlayerID,
  type QuestCard,
  type TeamVote,
} from '@avalon/game'

import { webConfig } from './config'
import { ConnectionRecoveryTimer } from './connection-recovery'
import { CreateGameDialog } from './CreateGameDialog'
import {
  loadPreferredPlayerCount,
  loadPreferredRoleConfiguration,
  savePreferredPlayerCount,
  savePreferredRoleConfiguration,
} from './create-game-preference'
import { getClientID } from './client-identity'
import { createDevToolsClient } from './dev-tools'
import { useHelp } from './help-context'
import { HelpProvider } from './HelpProvider'
import { useDevTools } from './use-dev-tools'
import { executePendingJoin, type PendingJoin } from './join-flow'
import { classifyJoinError } from './join-error'
import { LobbyView } from './LobbyView'
import { RoomDevTools } from './RoomDevTools'
import { RoomExitDialog } from './RoomExitDialog'
import { formatRoomID } from './room-id'
import { RoomLayoutBasePreview, RoomLayoutPreview } from './RoomLayoutPreview'
import { RoomIdentityConfirmationPreview } from './RoomIdentityConfirmationPreview'
import { RoomIdentityRecognitionPreview } from './RoomIdentityRecognitionPreview'
import { RoomAssassinationPreview } from './RoomAssassinationPreview'
import { RoomLobbyPreview } from './RoomLobbyPreview'
import { RoomQuestPreview } from './RoomQuestPreview'
import { RoomResultPreview } from './RoomResultPreview'
import { LegacyRoomScreen as RoomScreen } from './LegacyRoomScreen'
import { RoomTeamProposalPreview } from './RoomTeamProposalPreview'
import { RoomTeamVotePreview } from './RoomTeamVotePreview'
import { useRoomScreenController } from './room-screen-controller'
import {
  resolveRoomLayoutDiagnosticsMode,
  setRoomLayoutDiagnosticsMode,
} from './room-layout-diagnostics'
import {
  dissolveRoom,
  changeRoomSeat,
  createRoomParticipationClient,
  getRoomExitErrorMessage,
  getSeatChangeErrorMessage,
  getStartErrorMessage,
  leaveRoom,
  reconcileRoomExit,
  recoverRoomSeatTransition,
  type SeatTransitionReplayClient,
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
  loadOrCreatePlayerProfile,
  PLAYER_PROFILE_KEY,
  savePlayerProfile,
  type PlayerProfile,
} from './player-profile'
import {
  buildGameLogEntries,
  buildPresenceLogChanges,
  createPresenceBaselineEntry,
  type RoomLogEntry,
} from './room-log'
import {
  LAST_ROOM_SESSION_KEY,
  ROOM_SESSION_KEY,
  clearRoomSession,
  clearRoomSessionIfCurrent,
  getRoomSessionKey,
  getSeatTransitionKey,
  getRoomSessionInvalidationNotice,
  isRoomSessionStillValid,
  isSeatTransitionRequestActive,
  loadRoomSession,
  loadSeatTransition,
  saveRoomSession,
  validateActiveRoomSessions,
  validateRoomSession,
  type RoomSession,
  type RoomSessionStorage,
} from './room-session'
import {
  getRequestErrorMessage,
  getRoomAccessValidationError,
} from './request-error'
import {
  fetchRoomSummaries,
} from './room-directory'
import { ToastProvider } from './toast'
import { useToast } from './toast-context'

type AvalonClient = ReturnType<typeof Client<AvalonG>>

export const BOARDGAME_CLIENT_DEBUG = false as const
type AvalonRawClientState = NonNullable<ReturnType<AvalonClient['getState']>>
type AvalonClientState = Omit<AvalonRawClientState, 'G'> & {
  G: AvalonPlayerView
}

type CurrentRoomRouteSnapshot<Client> = Readonly<{
  client: Client | null
  generation: number
  matchID: string
  session: RoomSession | null
}>

type RoomRouteOperation<Client> = Omit<CurrentRoomRouteSnapshot<Client>, 'client' | 'session'> & Readonly<{
  client: Client
  session: RoomSession
  token: symbol
}>

type RoomStartOperation<Client> = RoomRouteOperation<Client> & Readonly<{
  startGame: () => unknown
}>

type RoomSeatChangeOperation<Client> = RoomRouteOperation<Client> & Readonly<{
  targetPlayerID: PlayerID
}>

type OperationRef<Operation> = { current: Operation | null }

function isSameRoomRouteSession(
  current: RoomSession | null,
  expected: RoomSession,
) {
  return current?.matchID === expected.matchID &&
    current.playerID === expected.playerID &&
    current.credentials === expected.credentials &&
    current.sessionID === expected.sessionID
}

function doesRoomRouteMatchOperation<Client, Operation extends RoomRouteOperation<Client>>(
  current: CurrentRoomRouteSnapshot<Client>,
  operation: Operation,
) {
  return current.generation === operation.generation &&
    current.matchID === operation.matchID &&
    current.client === operation.client &&
    isSameRoomRouteSession(current.session, operation.session)
}

function isRoomRouteOperationCurrent<Client, Operation extends RoomRouteOperation<Client>>(
  current: CurrentRoomRouteSnapshot<Client>,
  operation: Operation,
  operationRef: OperationRef<Operation>,
) {
  return operationRef.current?.token === operation.token &&
    doesRoomRouteMatchOperation(current, operation)
}

// oxlint-disable-next-line react/only-export-components
export async function executeRoomStartOperation<Client>({
  getCurrentRoute,
  onError,
  onSettled,
  operation,
  operationRef,
  prepareStart,
}: {
  getCurrentRoute: () => CurrentRoomRouteSnapshot<Client>
  onError: (error: unknown) => void
  onSettled: () => void
  operation: RoomStartOperation<Client>
  operationRef: OperationRef<RoomStartOperation<Client>>
  prepareStart: () => Promise<unknown>
}) {
  try {
    await prepareStart()
    if (!isRoomRouteOperationCurrent(getCurrentRoute(), operation, operationRef)) return
    operation.startGame()
  } catch (error) {
    if (isRoomRouteOperationCurrent(getCurrentRoute(), operation, operationRef)) {
      onError(error)
    }
  } finally {
    if (operationRef.current?.token === operation.token) {
      const routeStillCurrent = doesRoomRouteMatchOperation(
        getCurrentRoute(),
        operation,
      )
      operationRef.current = null
      if (routeStillCurrent) onSettled()
    }
  }
}

// oxlint-disable-next-line react/only-export-components
export async function executeRoomSeatChangeOperation<Client>({
  changeSeat: requestSeatChange,
  getCurrentRoute,
  onError,
  onSession,
  onSettled,
  operation,
  operationRef,
}: {
  changeSeat: () => Promise<RoomSession>
  getCurrentRoute: () => CurrentRoomRouteSnapshot<Client>
  onError: (error: unknown) => void
  onSession: (session: RoomSession) => void
  onSettled: () => void
  operation: RoomSeatChangeOperation<Client>
  operationRef: OperationRef<RoomSeatChangeOperation<Client>>
}) {
  try {
    const nextSession = await requestSeatChange()
    if (!isRoomRouteOperationCurrent(getCurrentRoute(), operation, operationRef)) return
    onSession(nextSession)
  } catch (error) {
    if (isRoomRouteOperationCurrent(getCurrentRoute(), operation, operationRef)) {
      onError(error)
    }
  } finally {
    if (
      operationRef.current?.token === operation.token &&
      operationRef.current.targetPlayerID === operation.targetPlayerID
    ) {
      const routeStillCurrent = doesRoomRouteMatchOperation(
        getCurrentRoute(),
        operation,
      )
      operationRef.current = null
      if (routeStillCurrent) onSettled()
    }
  }
}

function roomInvalidationNotice(error: unknown) {
  return getRoomSessionInvalidationNotice(error) ?? (
    error instanceof Error && error.message === 'HTTP status 404'
      ? '房间已解散。'
      : null
  )
}

function isSameRoomSession(current: RoomSession | null, expected: RoomSession) {
  return current?.playerID === expected.playerID && current.credentials === expected.credentials
}

// oxlint-disable-next-line react/only-export-components
export function getUpdatedRoomRouteSession(
  routeSession: RoomSession,
  storedSession: RoomSession | null,
) {
  if (storedSession?.matchID !== routeSession.matchID) return null
  return isSameRoomSession(storedSession, routeSession) ? null : storedSession
}

// oxlint-disable-next-line react/only-export-components
export async function recoverRoomRouteSession(
  session: RoomSession,
  client: SeatTransitionReplayClient,
  validate: (matchID: string, playerID: string, credentials: string) => Promise<boolean>,
  storage?: RoomSessionStorage,
) {
  const transition = loadSeatTransition(session.matchID, storage)
  if (transition === null) return session
  await recoverRoomSeatTransition(client, transition, validate, storage)
  return loadRoomSession(session.matchID, storage)
}

function isSeatTransitionRequestingForSession(
  session: RoomSession,
  storage?: RoomSessionStorage,
) {
  return isSeatTransitionRequestActive(session, storage)
}

// oxlint-disable-next-line react/only-export-components
export function shouldWakeRoomRouteForSeatTransitionChange(
  storageKey: string | null,
  session: RoomSession,
  storage?: RoomSessionStorage,
  now = Date.now(),
) {
  return storageKey === getSeatTransitionKey(session.matchID) &&
    !isSeatTransitionRequestActive(session, storage, now)
}

// oxlint-disable-next-line react/only-export-components
export async function resolveRoomRouteSnapshotSession(
  session: RoomSession,
  client: SeatTransitionReplayClient,
  validate: (matchID: string, playerID: string, credentials: string) => Promise<boolean>,
  storage?: RoomSessionStorage,
) {
  if (isSeatTransitionRequestingForSession(session, storage)) {
    return { status: 'requesting' as const, session }
  }
  const hadPendingTransition = loadSeatTransition(session.matchID, storage) !== null
  const recoveredSession = await recoverRoomRouteSession(session, client, validate, storage)
  if (recoveredSession === null) return { status: 'invalid' as const }
  if (!isSameRoomSession(recoveredSession, session)) {
    return { status: 'rebind' as const, session: recoveredSession }
  }

  if (hadPendingTransition) {
    return { status: 'refresh' as const, session: recoveredSession }
  }

  const sourceValid = await validate(
    recoveredSession.matchID,
    recoveredSession.playerID,
    recoveredSession.credentials,
  )
  return sourceValid
    ? { status: 'refresh' as const, session: recoveredSession }
    : { status: 'invalid' as const }
}

// oxlint-disable-next-line react/only-export-components
export async function resolveRecoverySeatValidation(
  validate: () => Promise<void>,
) {
  try {
    await validate()
    return true
  } catch (error) {
    if (getRoomSessionInvalidationNotice(error) !== null) return false
    throw error
  }
}

// oxlint-disable-next-line react/only-export-components
export function canRequestRoomExit(
  phase: string | null | undefined,
  roomExitBusy: boolean,
  seatChangePending: boolean,
  persistedSeatTransitionPending: boolean,
) {
  return phase === 'lobby' &&
    !roomExitBusy &&
    !seatChangePending &&
    !persistedSeatTransitionPending
}

function App() {
  return (
    <ToastProvider>
      <HelpProvider>
        <AppRoutes />
      </HelpProvider>
    </ToastProvider>
  )
}

function AppRoutes() {
  const { pushToast } = useToast()
  const [profile, setProfile] = useState(() => loadOrCreatePlayerProfile())
  const handleSaveProfile = useCallback((nextProfile: PlayerProfile) => {
    const savedProfile = savePlayerProfile(nextProfile)
    setProfile(savedProfile)
    pushToast({ message: '用户资料已保存。', tone: 'success' })
  }, [pushToast])

  useEffect(() => {
    const handleProfileStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== PLAYER_PROFILE_KEY) return
      setProfile(loadOrCreatePlayerProfile())
    }

    window.addEventListener('storage', handleProfileStorage)
    return () => window.removeEventListener('storage', handleProfileStorage)
  }, [])

  return (
    <BrowserRouter basename={webConfig.routerBasename}>
      <Routes>
        <Route element={<LobbyRoute onSaveProfile={handleSaveProfile} profile={profile} />} path="/" />
        <Route element={<RoomRoute onSaveProfile={handleSaveProfile} profile={profile} />} path="/rooms/:matchID" />
        {import.meta.env.DEV && <Route element={<RoomLayoutPreview />} path="/dev/room-layout" />}
        {import.meta.env.DEV && <Route element={<RoomLayoutBasePreview />} path="/dev/room-layout/base" />}
        {import.meta.env.DEV && <Route element={<RoomIdentityConfirmationPreview />} path="/dev/room-layout/identity-confirmation" />}
        {import.meta.env.DEV && <Route element={<RoomIdentityConfirmationPreview />} path="/dev/room-layout/identity-confirmation/:scenarioID" />}
        {import.meta.env.DEV && <Route element={<RoomIdentityRecognitionPreview />} path="/dev/room-layout/identity-recognition" />}
        {import.meta.env.DEV && <Route element={<RoomIdentityRecognitionPreview />} path="/dev/room-layout/identity-recognition/:scenarioID" />}
        {import.meta.env.DEV && <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby" />}
        {import.meta.env.DEV && <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby/:scenarioID" />}
        {import.meta.env.DEV && <Route element={<RoomTeamProposalPreview />} path="/dev/room-layout/team-proposal" />}
        {import.meta.env.DEV && <Route element={<RoomTeamProposalPreview />} path="/dev/room-layout/team-proposal/:scenarioID" />}
        {import.meta.env.DEV && <Route element={<RoomTeamVotePreview />} path="/dev/room-layout/team-vote" />}
        {import.meta.env.DEV && <Route element={<RoomTeamVotePreview />} path="/dev/room-layout/team-vote/:scenarioID" />}
        {import.meta.env.DEV && <Route element={<RoomQuestPreview />} path="/dev/room-layout/quest" />}
        {import.meta.env.DEV && <Route element={<RoomQuestPreview />} path="/dev/room-layout/quest/:scenarioID" />}
        {import.meta.env.DEV && <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination" />}
        {import.meta.env.DEV && <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination/:scenarioID" />}
        {import.meta.env.DEV && <Route element={<RoomResultPreview />} path="/dev/room-layout/result" />}
        {import.meta.env.DEV && <Route element={<RoomResultPreview />} path="/dev/room-layout/result/:scenarioID" />}
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}

function LobbyRoute({
  onSaveProfile,
  profile,
}: {
  onSaveProfile: (profile: PlayerProfile) => void
  profile: PlayerProfile
}) {
  const location = useLocation()
  const lobby = useMemo(() => createAvalonLobbyClient(), [])
  const devTools = useMemo(() => createDevToolsClient(webConfig.lobbyURL), [])
  const clientID = useMemo(() => getClientID(), [])
  const navigate = useNavigate()
  const [activeRoomSessions, setActiveRoomSessions] = useState<RoomSession[]>([])
  const [roomAccessStatus, setRoomAccessStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking')
  const [roomAccessError, setRoomAccessError] = useState<string | null>(null)
  const { pushToast } = useToast()
  const { openHelp } = useHelp()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [numPlayers, setNumPlayers] = useState(loadPreferredPlayerCount)
  const [roleConfiguration, setRoleConfiguration] = useState<AvalonRoleConfiguration>(loadPreferredRoleConfiguration)
  const [matches, setMatches] = useState<AvalonRoomSummary[]>([])
  const [busy, setBusy] = useState(false)
  const roomNotice = getRoomNavigationNotice(location.state)
  useEffect(() => {
    if (roomNotice === null) return

    pushToast({ message: roomNotice, tone: 'info' })
    navigate(location.pathname, {
      replace: true,
      state: consumeRoomNavigationNotice(location.state),
    })
  }, [location.pathname, location.state, navigate, pushToast, roomNotice])
  const {
    enabled: devToolsEnabled,
    error: devToolsError,
    run: runDevTool,
    setToken: setDevToken,
    token: devToken,
  } = useDevTools(devTools)
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
      setRoomAccessStatus(validation.validationFailed ? 'unavailable' : 'ready')
      setRoomAccessError(getRoomAccessValidationError(validation.validationFailed))
    } catch {
      if (generation !== refreshGenerationRef.current) return
      setRoomAccessStatus('unavailable')
      setRoomAccessError(getRequestErrorMessage('room-directory'))
    }
  }, [])

  useEffect(() => {
    if (roomAccessError === null) return
    pushToast({ message: roomAccessError, tone: 'error' })
  }, [pushToast, roomAccessError])

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

      setCreateDialogOpen(false)
      setRoomAccessStatus('checking')
      void refreshMatches()
    }

    window.addEventListener('storage', handleRoomSessionStorage)
    return () => window.removeEventListener('storage', handleRoomSessionStorage)
  }, [refreshMatches])

  const executePendingJoinRequest = useCallback(
    async (intent: PendingJoin) => {
      if (requestInFlightRef.current || roomAccessLocked) return

      requestInFlightRef.current = true
      setBusy(true)

      try {
        const session = await executePendingJoin(lobby, intent, {
          avatarID: profile.avatarID,
          clientID,
          gameName: AVALON_GAME_NAME,
          playerName: profile.name,
        })
        saveRoomSession(session)
        setCreateDialogOpen(false)
        navigate(`/rooms/${encodeURIComponent(session.matchID)}`)
      } catch (requestError) {
        const joinError = classifyJoinError(requestError)
        pushToast({ message: joinError.message, tone: 'error' })
        if (joinError.refreshRooms) {
          void refreshMatches()
        }
      } finally {
        requestInFlightRef.current = false
        setBusy(false)
      }
    },
    [clientID, lobby, navigate, profile, pushToast, refreshMatches, roomAccessLocked],
  )

  const handleJoin = (intent: { type: 'join'; matchID: string }) => {
    void executePendingJoinRequest(intent)
  }

  const handleCreate = () => {
    if (!roomAccessLocked) setCreateDialogOpen(true)
  }

  const handleCreateDialogCancel = () => {
    if (requestInFlightRef.current) return
    setCreateDialogOpen(false)
  }

  const handleCreateDialogConfirm = () => {
    if (requestInFlightRef.current || roomAccessLocked) return
    savePreferredPlayerCount(numPlayers)
    savePreferredRoleConfiguration(roleConfiguration)
    void executePendingJoinRequest({ type: 'create', numPlayers, roleConfiguration })
  }

  const handleEnterRoom = (matchID: string) => {
    if (!activeRoomSessions.some((session) => session.matchID === matchID)) return
    navigate(`/rooms/${encodeURIComponent(matchID)}`)
  }

  const handleDeleteRoom = async (matchID: string) => {
    if (!devToolsEnabled || devToken.length === 0) return
    if (!window.confirm(`确定删除房间 ${formatRoomID(matchID)} 吗？`)) return

    await runDevTool(async () => {
      await devTools.deleteRoom(matchID, devToken)
      clearRoomSession(matchID)
      await refreshMatches()
    })
  }

  return (
    <>
      <LobbyView
        activeRoomSessions={activeRoomSessions}
        busy={busy}
        devToolsError={devToolsError}
        devToken={devToken}
        devToolsEnabled={devToolsEnabled}
        matches={matches}
        onCreate={handleCreate}
        onEnterRoom={handleEnterRoom}
        onJoin={handleJoin}
        onOpenHelp={() => openHelp()}
        onRefresh={() => void refreshMatches()}
        onSaveProfile={onSaveProfile}
        onDeleteRoom={handleDeleteRoom}
        onDevTokenChange={setDevToken}
        roomAccessLocked={roomAccessLocked}
        roomAccessPending={roomAccessPending}
        roomAccessUnavailable={roomAccessUnavailable}
        profile={profile}
      />
      <CreateGameDialog
        busy={busy}
        numPlayers={numPlayers}
        onCancel={handleCreateDialogCancel}
        onConfirm={handleCreateDialogConfirm}
        onPlayerCountChange={setNumPlayers}
        onOpenRoleHelp={() => openHelp({ focusRoles: true, tab: 'roles' })}
        onRoleConfigurationChange={setRoleConfiguration}
        open={createDialogOpen}
        roleConfiguration={roleConfiguration}
      />
    </>
  )
}

function RoomRoute({
  onSaveProfile,
  profile,
}: {
  onSaveProfile: (profile: PlayerProfile) => void
  profile: PlayerProfile
}) {
  const { matchID = '' } = useParams()
  const navigate = useNavigate()
  const lobby = useMemo(() => createAvalonLobbyClient(), [])
  const roomParticipation = useMemo(
    () => createRoomParticipationClient(webConfig.lobbyURL),
    [],
  )
  const devTools = useMemo(() => createDevToolsClient(webConfig.lobbyURL), [])
  const { pushToast } = useToast()
  const { openHelp } = useHelp()
  const clientRef = useRef<AvalonClient | null>(null)
  const routeGenerationRef = useRef(0)
  const [session, setSession] = useState<RoomSession | null>(() =>
    loadRoomSession(matchID),
  )
  const [room, setRoom] = useState<AvalonMatch | null>(null)
  const [gameState, setGameState] = useState<AvalonClientState | null>(null)
  const [roomExitDialogOpen, setRoomExitDialogOpen] = useState(false)
  const [roomExitBusy, setRoomExitBusy] = useState(false)
  const [seatChangeTargetID, setSeatChangeTargetID] = useState<PlayerID | null>(null)
  const startOperationRef = useRef<RoomStartOperation<AvalonClient> | null>(null)
  const seatChangeOperationRef = useRef<RoomSeatChangeOperation<AvalonClient> | null>(null)
  const currentMatchIDRef = useRef(matchID)
  const currentRouteSessionRef = useRef<RoomSession | null>(null)
  const [startPending, setStartPending] = useState(false)
  const [seatTransitionRevision, setSeatTransitionRevision] = useState(0)
  const [, setSeatTransitionGuardRevision] = useState(0)
  const seatTransitionChangeRevisionRef = useRef(0)

  const invalidateSession = useCallback(
    (reason: string, generation: number, expectedSession?: RoomSession) => {
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

      if (
        expectedSession !== undefined &&
        isSeatTransitionRequestingForSession(expectedSession)
      ) return

      if (
        expectedSession !== undefined &&
        !isSameRoomSession(loadRoomSession(matchID), expectedSession)
      ) return

      stopCurrentClient(clientRef)
      if (expectedSession !== undefined) {
        clearRoomSessionIfCurrent(expectedSession)
      } else {
        clearRoomSession(matchID)
      }
      setSession(null)
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
      if (isSeatTransitionRequestingForSession(currentSession)) return

      try {
        const hadSeatTransition = loadSeatTransition(currentSession.matchID) !== null
        const recoveredSession = await recoverRoomRouteSession(
          currentSession,
          roomParticipation,
          async (recoveryMatchID, playerID, credentials) => resolveRecoverySeatValidation(async () => {
            await validateRoomSession(webConfig.lobbyURL, {
              matchID: recoveryMatchID,
              playerID,
              credentials,
            })
          }),
        )
        if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
        if (recoveredSession === null) {
          invalidateSession('上次的座位已失效。', generation, currentSession)
          return
        }
        if (!isSameRoomSession(recoveredSession, currentSession)) {
          setSession(recoveredSession)
          return
        }
        if (hadSeatTransition && clientRef.current === null) {
          setSeatTransitionRevision((revision) => revision + 1)
          return
        }

        const [nextRoom] = await Promise.all([
          lobby.getMatch(AVALON_GAME_NAME, roomID),
          validateRoomSession(webConfig.lobbyURL, currentSession),
        ])
        if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

        const nextRoomValue = nextRoom as unknown as AvalonMatch
        setRoom(nextRoomValue)
      } catch (requestError) {
        if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
        const invalidationNotice = roomInvalidationNotice(requestError)
        if (invalidationNotice !== null) {
          invalidateSession(invalidationNotice, generation, currentSession)
          return
        }
        if (!silent) {
          pushToast({
            message: getRequestErrorMessage('room'),
            tone: 'error',
          })
        }
      }
    },
    [invalidateSession, lobby, pushToast, roomParticipation],
  )

  useEffect(() => {
    setSession((currentSession) => {
      if (currentSession?.matchID === matchID) return currentSession
      return loadRoomSession(matchID)
    })
    setRoom(null)
    setGameState(null)
    setRoomExitDialogOpen(false)
    setRoomExitBusy(false)
  }, [matchID])

  const routeSession = session?.matchID === matchID ? session : null
  const getCurrentRoomRoute = () => ({
    client: clientRef.current,
    generation: routeGenerationRef.current,
    matchID: currentMatchIDRef.current,
    session: currentRouteSessionRef.current,
  })
  useLayoutEffect(() => {
    currentMatchIDRef.current = matchID
    currentRouteSessionRef.current = routeSession
    startOperationRef.current = null
    seatChangeOperationRef.current = null
    setSeatChangeTargetID(null)
    setStartPending(false)
  }, [matchID, routeSession])
  const persistedSeatTransition = routeSession === null
    ? null
    : loadSeatTransition(matchID)
  const effectiveSeatChangeTargetID =
    seatChangeTargetID ?? persistedSeatTransition?.targetPlayerID ?? null
  const seatChangePending = effectiveSeatChangeTargetID !== null

  useEffect(() => {
    const handleRoomSessionStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || routeSession === null) return
      if (
        event.key !== null &&
        event.key !== getRoomSessionKey(matchID) &&
        event.key !== getSeatTransitionKey(matchID) &&
        event.key !== ROOM_SESSION_KEY &&
        event.key !== LAST_ROOM_SESSION_KEY
      ) return
      if (event.key === getSeatTransitionKey(matchID)) {
        seatTransitionChangeRevisionRef.current += 1
        setSeatTransitionGuardRevision((revision) => revision + 1)
        if (loadSeatTransition(matchID) !== null) {
          setRoomExitDialogOpen(false)
        }
      }
      if (shouldWakeRoomRouteForSeatTransitionChange(event.key, routeSession)) {
        setSeatTransitionRevision((revision) => revision + 1)
      }
      const storedSession = loadRoomSession(matchID)
      const updatedSession = getUpdatedRoomRouteSession(routeSession, storedSession)
      if (updatedSession !== null) {
        stopCurrentClient(clientRef)
        setSession(updatedSession)
        setRoomExitDialogOpen(false)
        setRoomExitBusy(false)
        return
      }
      if (storedSession !== null) return

      stopCurrentClient(clientRef)
      setSession(null)
      setRoomExitDialogOpen(false)
      setRoomExitBusy(false)
      navigate('/', {
        state: { roomNotice: '你已离开这个房间。' },
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
        if (isSeatTransitionRequestingForSession(routeSession)) return
        const recoveredSession = await recoverRoomRouteSession(
          routeSession,
          roomParticipation,
          async (recoveryMatchID, playerID, credentials) => {
            return resolveRecoverySeatValidation(async () => {
              await validateRoomSession(webConfig.lobbyURL, {
                matchID: recoveryMatchID,
                playerID,
                credentials,
              })
            })
          },
        )
        if (!active || !isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
        if (recoveredSession === null) {
          invalidateSession('上次的座位已失效。', generation, routeSession)
          return
        }
        if (!isSameRoomSession(recoveredSession, routeSession)) {
          setSession(recoveredSession)
          return
        }

        const [initialRoom] = await Promise.all([
          lobby.getMatch(AVALON_GAME_NAME, matchID),
          validateRoomSession(webConfig.lobbyURL, routeSession),
        ])
        if (!active || !isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

        setRoom(initialRoom as unknown as AvalonMatch)
        client = Client({
          debug: BOARDGAME_CLIENT_DEBUG,
          game: AvalonGame,
          numPlayers: getMatchPlayerCount(initialRoom as unknown as AvalonMatch),
          multiplayer: SocketIO({
            server: webConfig.gameURL,
            socketOpts: { path: webConfig.socketPath },
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
              void resolveRoomRouteSnapshotSession(
                routeSession,
                roomParticipation,
                async (recoveryMatchID, playerID, credentials) => resolveRecoverySeatValidation(async () => {
                  await validateRoomSession(webConfig.lobbyURL, {
                    matchID: recoveryMatchID,
                    playerID,
                    credentials,
                  })
                }),
              ).then((resolution) => {
                if (!active || !isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
                if (resolution.status === 'invalid') {
                  invalidateSession('上次的座位已失效。', generation, routeSession)
                  return
                }
                if (resolution.status === 'rebind') {
                  setSession(resolution.session)
                  return
                }
                if (resolution.status === 'requesting') return
                void refreshRoom(matchID, resolution.session, generation, true)
              }).catch(() => {
                if (!active || !isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
                pushToast({ message: getRequestErrorMessage('connection'), tone: 'error' })
              })
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
            invalidateSession(invalidationNotice, generation, routeSession)
          } else {
            pushToast({
              message: getRequestErrorMessage('connection'),
              tone: 'error',
            })
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
      startOperationRef.current = null
      seatChangeOperationRef.current = null
      setSeatChangeTargetID(null)
      setStartPending(false)
      if (isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) {
        routeGenerationRef.current += 1
      }
      window.clearInterval(timer)
      unsubscribe()
      if (client !== null) stopCurrentClient(clientRef, client)
    }
  }, [invalidateSession, lobby, matchID, pushToast, refreshRoom, roomParticipation, routeSession, seatTransitionRevision])

  const handleStart = async () => {
    const targetPlayerCount = room === null ? null : getMatchPlayerCount(room)
    const occupiedCount = room === null ? 0 : getOccupiedPlayerIDs(room).length
    const sourceClient = clientRef.current
    if (
      startOperationRef.current !== null ||
      gameState?.isActive !== true ||
      gameState.isConnected !== true ||
      gameState.ctx.phase !== 'lobby' ||
      routeSession === null ||
      sourceClient === null ||
      room?.ownerPlayerID !== routeSession.playerID ||
      targetPlayerCount === null ||
      occupiedCount !== targetPlayerCount
    ) return
    const operation: RoomStartOperation<AvalonClient> = {
      client: sourceClient,
      generation: routeGenerationRef.current,
      matchID,
      session: routeSession,
      startGame: () => sourceClient.moves.startGame(),
      token: Symbol('room-start'),
    }
    startOperationRef.current = operation
    setStartPending(true)
    await executeRoomStartOperation({
      getCurrentRoute: getCurrentRoomRoute,
      onError: (error) => {
        pushToast({ message: getStartErrorMessage(error), tone: 'error' })
      },
      onSettled: () => setStartPending(false),
      operation,
      operationRef: startOperationRef,
      prepareStart: () => roomParticipation.prepareStart(
        operation.matchID,
        operation.session.playerID,
        operation.session.credentials,
      ),
    })
  }

  const handleChangeSeat = async (targetPlayerID: PlayerID) => {
    const sourceClient = clientRef.current
    if (
      routeSession === null ||
      sourceClient === null ||
      gameState?.ctx.phase !== 'lobby' ||
      seatChangePending ||
      seatChangeOperationRef.current !== null ||
      loadSeatTransition(routeSession.matchID) !== null ||
      targetPlayerID === routeSession.playerID
    ) return
    const operation: RoomSeatChangeOperation<AvalonClient> = {
      client: sourceClient,
      generation: routeGenerationRef.current,
      matchID,
      session: routeSession,
      targetPlayerID,
      token: Symbol('room-seat-change'),
    }
    seatChangeOperationRef.current = operation
    setSeatChangeTargetID(targetPlayerID)
    await executeRoomSeatChangeOperation({
      changeSeat: () => changeRoomSeat(
        roomParticipation,
        operation.session,
        operation.targetPlayerID,
      ),
      getCurrentRoute: getCurrentRoomRoute,
      onError: (error) => {
        pushToast({ message: getSeatChangeErrorMessage(error), tone: 'error' })
      },
      onSession: setSession,
      onSettled: () => {
        setSeatChangeTargetID((currentTarget) => (
          currentTarget === operation.targetPlayerID ? null : currentTarget
        ))
      },
      operation,
      operationRef: seatChangeOperationRef,
    })
  }

  const handleProposeTeam = (team: PlayerID[]) => {
    if (!gameState?.isActive || clientRef.current === null) {
      throw new Error('Team proposal client is unavailable')
    }
    clientRef.current.moves.proposeTeam(team)
  }

  const handleCastTeamVote = (vote: TeamVote) => {
    if (gameState?.isActive) {
      clientRef.current?.moves.castTeamVote(vote)
    }
  }

  const handleConfirmIdentityRecognition = () => {
    if (gameState?.isActive) {
      clientRef.current?.moves.confirmIdentityRecognition()
    }
  }

  const handlePlayQuestCard = (card: QuestCard) => {
    if (gameState?.isActive) {
      clientRef.current?.moves.playQuestCard(card)
    }
  }

  const handleAssassinate = (targetID: PlayerID) => {
    if (gameState?.isActive) {
      clientRef.current?.moves.assassinate(targetID)
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
    navigate('/')
  }

  const handleRequestRoomExit = () => {
    if (
      routeSession === null ||
      !canRequestRoomExit(
        gameState?.ctx.phase,
        roomExitBusy,
        seatChangePending,
        persistedSeatTransition !== null,
      )
    ) return

    setRoomExitDialogOpen(true)
  }

  const handleCancelRoomExit = () => {
    if (roomExitBusy) return

    setRoomExitDialogOpen(false)
  }

  const handleConfirmRoomExit = async () => {
    if (
      routeSession === null ||
      gameState === null ||
      !canRequestRoomExit(
        gameState.ctx.phase,
        roomExitBusy,
        seatChangePending,
        persistedSeatTransition !== null,
      )
    ) return

    const currentSession = routeSession
    const generation = routeGenerationRef.current
    const transitionRevision = seatTransitionChangeRevisionRef.current
    const isOwner = gameState.G.lobby.ownerPlayerID === currentSession.playerID
    setRoomExitBusy(true)

    try {
      const result = isOwner
        ? await dissolveRoom(webConfig.lobbyURL, currentSession)
        : await leaveRoom(webConfig.lobbyURL, currentSession)
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return

      const resolution = await reconcileRoomExit(
        currentSession,
        result,
        transitionRevision !== seatTransitionChangeRevisionRef.current,
        roomParticipation,
        async (recoveryMatchID, playerID, credentials) => resolveRecoverySeatValidation(async () => {
          await validateRoomSession(webConfig.lobbyURL, {
            matchID: recoveryMatchID,
            playerID,
            credentials,
          })
        }),
      )
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
      if (resolution.status === 'rebind') {
        setSession(resolution.session)
        setRoomExitDialogOpen(false)
        return
      }
      if (resolution.status !== 'completed') {
        setRoomExitDialogOpen(false)
        pushToast({ message: '座位正在恢复，请稍后重试退出。', tone: 'error' })
        return
      }

      stopCurrentClient(clientRef)
      setSession(null)
      setRoomExitDialogOpen(false)
      navigate('/', {
        state: {
          roomNotice: isOwner
            ? '房间已解散。'
            : '已退出房间并释放座位。',
        },
      })
    } catch (actionError) {
      if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
      pushToast({
        message: getRoomExitErrorMessage(actionError, isOwner),
        tone: 'error',
      })
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
    navigate('/', { state: { roomNotice: '房间已解散。' } })
  }

  const handleKickPlayer = async (playerID: string, token: string) => {
    const generation = routeGenerationRef.current
    await devTools.kickPlayer(matchID, playerID, token)
    if (!isRoomRouteGenerationCurrent(routeGenerationRef.current, generation)) return
    if (playerID === routeSession?.playerID) {
      stopCurrentClient(clientRef)
      clearRoomSession(matchID)
      setSession(null)
      navigate('/', { state: { roomNotice: '你已被移出房间。' } })
      return
    }
    if (routeSession !== null) {
      await refreshRoom(matchID, routeSession, generation)
    }
  }

  if (routeSession === null) {
    return <RoomAccessView matchID={matchID} onBackHome={() => navigate('/')} />
  }

  const roomExitBlocked = startPending || seatChangePending

  return (
    <>
      <RoomView
        gameState={gameState}
        onAssassinate={handleAssassinate}
        onBackHome={() => navigate('/')}
        onCastTeamVote={handleCastTeamVote}
        onConfirmIdentityRecognition={handleConfirmIdentityRecognition}
        onClearLocalSession={handleClearLocalSessionForTesting}
        onProposeTeam={handleProposeTeam}
        onPlayQuestCard={handlePlayQuestCard}
        onOpenHelp={(playerCount) => openHelp({ playerCount })}
        onReconnect={handleReconnect}
        onRequestRoomExit={handleRequestRoomExit}
        onStart={handleStart}
        onChangeSeat={handleChangeSeat}
        onDeleteRoom={handleDeleteRoom}
        onKickPlayer={handleKickPlayer}
        onSaveProfile={onSaveProfile}
        profile={profile}
        room={room}
        roomExitBlocked={roomExitBlocked}
        roomExitBusy={roomExitBusy}
        seatChangeTargetID={effectiveSeatChangeTargetID}
        session={routeSession}
        startPending={startPending}
      />
      <RoomExitDialog
        busy={roomExitBusy}
        isOwner={gameState?.G.lobby.ownerPlayerID === routeSession.playerID}
        onCancel={handleCancelRoomExit}
        onConfirm={() => void handleConfirmRoomExit()}
        open={roomExitDialogOpen}
      />
    </>
  )
}

export function RoomAccessView({
  matchID,
  onBackHome,
}: {
  matchID: string
  onBackHome: () => void
}) {
  return (
    <PageShell eyebrow={`房间 ${formatRoomID(matchID)}`} title="进入房间">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <p className="text-sm leading-6 text-slate-300">
          你尚未加入这个房间。请返回房间列表，选择一个房间后加入。
        </p>
        <button
          className="mt-6 rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200"
          onClick={onBackHome}
          type="button"
        >
          返回房间列表
        </button>
      </section>
    </PageShell>
  )
}

export interface RoomViewProps {
  gameState: AvalonClientState | null
  onAssassinate: (targetID: PlayerID) => void
  onBackHome: () => void
  onCastTeamVote: (vote: TeamVote) => void
  onConfirmIdentityRecognition: () => void
  onChangeSeat: (targetPlayerID: string) => void
  onClearLocalSession: () => void
  onProposeTeam: (team: PlayerID[]) => void
  onPlayQuestCard: (card: QuestCard) => void
  onOpenHelp: (playerCount: number) => void
  onReconnect: () => void
  onRequestRoomExit: () => void
  onStart: () => void
  onDeleteRoom: (token: string) => Promise<void>
  onKickPlayer: (playerID: string, token: string) => Promise<void>
  onSaveProfile: (profile: PlayerProfile) => void
  profile: PlayerProfile
  room: AvalonMatch | null
  roomExitBlocked: boolean
  roomExitBusy: boolean
  seatChangeTargetID: PlayerID | null
  session: RoomSession
  startPending: boolean
}

export function RoomView({
  gameState,
  onAssassinate,
  onBackHome,
  onCastTeamVote,
  onConfirmIdentityRecognition,
  onChangeSeat,
  onClearLocalSession,
  onProposeTeam,
  onPlayQuestCard,
  onOpenHelp,
  onReconnect,
  onRequestRoomExit,
  onStart,
  onDeleteRoom,
  onKickPlayer,
  room,
  roomExitBusy,
  roomExitBlocked,
  seatChangeTargetID,
  session,
  startPending,
}: RoomViewProps) {
  const { pushToast } = useToast()
  const [layoutDiagnosticsMode, setLayoutDiagnosticsMode] = useState(() =>
    resolveRoomLayoutDiagnosticsMode(
      typeof window === 'undefined' ? '' : window.location.search,
      import.meta.env.DEV,
    ),
  )
  const connected = gameState?.isConnected === true
  const logEntries = useRoomLogEntries(room, gameState)
  const {
    beginManualReconnect,
    manualReconnectAvailable,
  } = useDelayedManualReconnect(connected, gameState !== null)
  const manualReconnectRequestedRef = useRef(false)
  const handleManualReconnect = useCallback(() => {
    manualReconnectRequestedRef.current = true
    beginManualReconnect()
    onReconnect()
  }, [beginManualReconnect, onReconnect])
  useEffect(() => {
    manualReconnectRequestedRef.current = false
  }, [session.credentials, session.matchID, session.playerID])
  useEffect(() => {
    if (!connected || !manualReconnectRequestedRef.current) return
    manualReconnectRequestedRef.current = false
    pushToast({ message: '已重新连接房间。', tone: 'success' })
  }, [connected, pushToast])
  const numPlayers = room === null ? null : getMatchPlayerCount(room)
  const occupiedPlayerIDs = room === null ? [] : getOccupiedPlayerIDs(room)
  const isFull = numPlayers !== null && occupiedPlayerIDs.length === numPlayers
  const phase = gameState?.ctx.phase ?? 'loading'
  const activeStage = gameState?.ctx.activePlayers?.[session.playerID]
  const canStart =
    connected &&
    gameState?.isActive === true &&
    room?.ownerPlayerID === session.playerID &&
    phase === 'lobby' &&
    isFull
  const controller = useRoomScreenController({
    activeStage,
    canStart,
    connected,
    currentPlayerID: session.playerID,
    game: gameState?.G ?? null,
    manualReconnectAvailable,
    matchID: session.matchID,
    onAssassinate,
    onCastTeamVote,
    onChangeSeat,
    onConfirmIdentityRecognition,
    onPlayQuestCard,
    onProposeTeam,
    onTeamSubmissionError: () => pushToast({ message: '确认队伍失败，请重试。', tone: 'error' }),
    onTeamVoteSubmissionError: () => pushToast({ message: '确认投票失败，请重试。', tone: 'error' }),
    onReconnect: handleManualReconnect,
    onStart,
    phase,
    room,
    roomExitBusy,
    seatChangeTargetID,
    startPending,
  })
  const handleLayoutDiagnosticsModeChange = useCallback((mode: typeof layoutDiagnosticsMode) => {
    setLayoutDiagnosticsMode(mode)
    if (typeof window === 'undefined') return
    const nextURL = setRoomLayoutDiagnosticsMode(new URL(window.location.href), mode)
    window.history.replaceState(window.history.state, '', nextURL)
  }, [])

  return (
    <ImmersiveLobbyShell
      variant="game"
      developmentControls={(
        <RoomDevTools
          matchID={session.matchID}
          layoutDiagnosticsMode={layoutDiagnosticsMode}
          onClearLocalSession={onClearLocalSession}
          onDeleteRoom={onDeleteRoom}
          onKickPlayer={onKickPlayer}
          onLayoutDiagnosticsModeChange={handleLayoutDiagnosticsModeChange}
          phase={phase}
          players={room?.players ?? []}
        />
      )}
    >
      <RoomScreen
        actions={controller.actions}
        diagnosticsMode={layoutDiagnosticsMode}
        model={controller.model}
        tools={{
          connected,
          isOwner: room?.ownerPlayerID === session.playerID,
          logEntries,
          onBackHome,
          onOpenHelp: () => onOpenHelp(numPlayers ?? 5),
          onRequestRoomExit,
          onToggleRoleKnowledge: controller.toggleRoleKnowledge,
          roomExitBlocked,
          roomExitBusy,
          seatChangePending: seatChangeTargetID !== null,
          seatChangeTargetID,
        }}
      />
    </ImmersiveLobbyShell>
  )
}

function useRoomLogEntries(
  room: AvalonMatch | null,
  gameState: AvalonClientState | null,
) {
  const [presenceEntries, setPresenceEntries] = useState<RoomLogEntry[]>([])
  const presenceRef = useRef<{
    matchID: string
    nextIndex: number
    players: readonly LobbyPlayer[]
  } | null>(null)
  const snapshotPlayers = (players: readonly LobbyPlayer[]) =>
    players.map((player) => ({ ...player }))

  useEffect(() => {
    if (room === null) return

    const previous = presenceRef.current
    if (previous === null || previous.matchID !== room.matchID) {
      setPresenceEntries([createPresenceBaselineEntry(room.players)])
      presenceRef.current = {
        matchID: room.matchID,
        nextIndex: 1,
        players: snapshotPlayers(room.players),
      }
      return
    }

    const changes = buildPresenceLogChanges(
      previous.players,
      room.players,
      previous.nextIndex,
    )
    if (changes.length > 0) {
      setPresenceEntries((entries) => [...entries, ...changes])
    }
    presenceRef.current = {
      matchID: room.matchID,
      nextIndex: previous.nextIndex + changes.length,
      players: snapshotPlayers(room.players),
    }
  }, [room])

  return useMemo(() => {
    if (room === null || gameState === null) return presenceEntries

    return [
      ...presenceEntries,
      ...buildGameLogEntries(
        gameState.G,
        room.players,
        gameState.ctx.phase ?? 'teamProposal',
      ),
    ]
  }, [gameState, presenceEntries, room])
}

function ImmersiveLobbyShell({
  children,
  developmentControls,
  variant = 'framed',
}: {
  children: ReactNode
  developmentControls: ReactNode
  variant?: 'framed' | 'game'
}) {
  const Root = variant === 'game' ? 'div' : 'main'
  return (
    <Root
      className={`relative h-dvh overflow-hidden overscroll-none bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_35%),#07111f] text-slate-200 ${variant === 'game' ? 'p-0' : 'p-2 sm:p-3 lg:p-4'}`}
      data-room-shell-variant={variant}
    >
      <div className={`h-full min-h-0 ${variant === 'game' ? 'w-full' : 'mx-auto max-w-7xl'}`}>{children}</div>
      {developmentControls}
    </Root>
  )
}

function useDelayedManualReconnect(connected: boolean, active: boolean) {
  const [manualReconnectAvailable, setManualReconnectAvailable] = useState(false)
  const recoveryTimerRef = useRef<ConnectionRecoveryTimer | null>(null)
  if (recoveryTimerRef.current === null) {
    recoveryTimerRef.current = new ConnectionRecoveryTimer(setManualReconnectAvailable)
  }

  useEffect(() => {
    const recoveryTimer = recoveryTimerRef.current!
    recoveryTimer.setConnection(active, connected)
    return () => recoveryTimer.suspend()
  }, [active, connected])

  const beginManualReconnect = useCallback(() => {
    recoveryTimerRef.current?.retry()
  }, [])

  return { beginManualReconnect, manualReconnectAvailable }
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
              <span className="text-xl font-semibold text-white">
                阿瓦隆
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
            5–10 人社交推理游戏
          </p>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </main>
  )
}

export default App
