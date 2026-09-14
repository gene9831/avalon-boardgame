import type { AvalonPlayerView, PlayerID } from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'

export type LobbyPreviewScenarioID =
  | 'member-incomplete'
  | 'owner-incomplete'
  | 'member-full'
  | 'owner-full'
  | 'current-player-disconnected'

export const LOBBY_PREVIEW_SCENARIO_IDS: readonly LobbyPreviewScenarioID[] = [
  'member-incomplete',
  'owner-incomplete',
  'member-full',
  'owner-full',
  'current-player-disconnected',
]

export type LobbyPreviewReconnectState = Readonly<{
  mode: 'automatic' | 'manual'
  completed: boolean
}>

export function getLobbyPreviewReconnectPresentation(state: LobbyPreviewReconnectState) {
  return {
    connected: state.completed,
    manualReconnectAvailable: state.mode === 'manual' && !state.completed,
  }
}

export function completeLobbyPreviewReconnect(state: LobbyPreviewReconnectState) {
  if (state.mode !== 'manual' || state.completed) return { state, toast: null }
  return {
    state: { ...state, completed: true },
    toast: { message: '已重新连接房间。', tone: 'success' as const },
  }
}

export function resetLobbyPreviewReconnect(_state: LobbyPreviewReconnectState): LobbyPreviewReconnectState {
  return { mode: 'automatic', completed: false }
}

export function applyLobbyPreviewReconnectCompletion(
  room: AvalonMatch,
  currentPlayerID: PlayerID,
  completed: boolean,
): AvalonMatch {
  if (!completed) return room
  return {
    ...room,
    players: room.players.map((player) => String(player.id) === currentPlayerID
      ? { ...player, isConnected: true }
      : player),
  }
}

const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']

function isFullScenario(scenarioID: LobbyPreviewScenarioID) {
  return scenarioID === 'member-full' || scenarioID === 'owner-full' || scenarioID === 'current-player-disconnected'
}

function isOwnerScenario(scenarioID: LobbyPreviewScenarioID) {
  return scenarioID === 'owner-incomplete' || scenarioID === 'owner-full'
}

function createPlayers(playerCount: number, scenarioID: LobbyPreviewScenarioID): LobbyPlayer[] {
  const full = isFullScenario(scenarioID)
  const occupiedCount = full ? playerCount : playerCount - 2
  const disconnectedPlayerID = scenarioID === 'member-incomplete' || scenarioID === 'owner-incomplete'
    ? 1
    : scenarioID === 'current-player-disconnected' ? 2 : null
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: id < occupiedCount ? `${PLAYER_NAMES[id]} ${id + 1}` : undefined,
    isConnected: id < occupiedCount && id !== disconnectedPlayerID,
  }))
}

function createPublicLobbyGame(room: AvalonMatch): AvalonPlayerView {
  return {
    status: 'lobby',
    lobby: { authorityVersion: 1, ownerPlayerID: room.ownerPlayerID as PlayerID, occupiedPlayerIDs: room.occupiedPlayerIDs },
    players: Object.fromEntries(room.players.flatMap((player) => player.name === null || player.name === undefined
      ? []
      : [[String(player.id), { name: player.name }]])),
    identityRecognition: null,
    leaderID: null,
    questIndex: 0,
    proposedTeam: null,
    submittedTeamVotePlayerIDs: [],
    submittedQuestCardCount: 0,
    voteHistory: [],
    questHistory: [],
    consecutiveRejectedTeams: 0,
    goodSuccesses: 0,
    evilFailures: 0,
    rules: { roleConfiguration: room.roleConfiguration, timeouts: { enabled: false } },
    viewer: { role: null, loyalty: null, knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [] },
  }
}

export function buildLobbyPreviewState(input: Readonly<{
  scenarioID: LobbyPreviewScenarioID
  playerCount: number
  reconnectMode: 'automatic' | 'manual'
  seatChangeTargetID: PlayerID | null
  startPending: boolean
}>): Readonly<{
  room: AvalonMatch
  game: AvalonPlayerView
  currentPlayerID: PlayerID
  connected: boolean
  manualReconnectAvailable: boolean
  canStart: boolean
}> {
  const full = isFullScenario(input.scenarioID)
  const players = createPlayers(input.playerCount, input.scenarioID)
  const ownerPlayerID = isOwnerScenario(input.scenarioID) ? CURRENT_PLAYER_ID : '0'
  const room: AvalonMatch = {
    gameName: 'avalon',
    matchID: `lobby-preview-${input.scenarioID}-${input.playerCount}`,
    players,
    setupData: { numPlayers: input.playerCount },
    ownerPlayerID,
    occupiedPlayerIDs: players.filter((player) => player.name != null).map((player) => String(player.id)),
    roleConfiguration: { percivalMorgana: true },
  }
  const disconnected = input.scenarioID === 'current-player-disconnected'

  return {
    room,
    game: createPublicLobbyGame(room),
    currentPlayerID: CURRENT_PLAYER_ID,
    connected: !disconnected,
    manualReconnectAvailable: disconnected && input.reconnectMode === 'manual',
    canStart: full && ownerPlayerID === CURRENT_PLAYER_ID && !input.startPending,
  }
}
