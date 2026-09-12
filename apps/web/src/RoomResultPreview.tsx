import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  buildRoleDeck,
  getPlayerCountConfig,
  loyaltyForRole,
  type AvalonPlayerView,
  type AvalonResult,
  type PlayerID,
  type QuestResult,
  type Role,
} from '@avalon/game'

import { useHelp } from './help-context'
import type { AvalonMatch, LobbyPlayer } from './lobby'
import { resolveRoomLayoutDiagnosticsMode } from './room-layout-diagnostics'
import { buildRoomScreenModel } from './room-screen-controller'
import { LegacyRoomScreen as RoomScreen } from './LegacyRoomScreen'

type ResultPreviewScenarioID =
  | 'good-assassination'
  | 'evil-assassination'
  | 'evil-quests'
  | 'evil-rejections'

const SCENARIO_IDS: readonly ResultPreviewScenarioID[] = [
  'good-assassination',
  'evil-assassination',
  'evil-quests',
  'evil-rejections',
]
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
const noOp = () => undefined

function isScenarioID(value: string | undefined): value is ResultPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as ResultPreviewScenarioID)
}

function createPlayers(playerCount: number): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: id !== 1,
  }))
}

function assignPreviewRoles(playerCount: number, pairedRoles: boolean): Record<PlayerID, Role> {
  const playerIDs = Array.from({ length: playerCount }, (_, index) => String(index) as PlayerID)
  const deck = buildRoleDeck(playerCount, { percivalMorgana: pairedRoles })
  return Object.fromEntries(playerIDs.map((playerID, index) => [playerID, deck[index]]))
}

function createQuestHistory(
  playerCount: number,
  outcomes: readonly boolean[],
  playerIDs: readonly PlayerID[],
): QuestResult[] {
  const config = getPlayerCountConfig(playerCount)
  return outcomes.map((succeeded, questIndex) => {
    const teamSize = config.questTeamSizes[questIndex]
    const failCount = succeeded ? 0 : config.questFailThresholds[questIndex]
    return {
      questIndex,
      team: playerIDs.slice(0, teamSize),
      successCount: teamSize - failCount,
      failCount,
      succeeded,
    }
  })
}

function resultForScenario(
  scenarioID: ResultPreviewScenarioID,
  roles: Record<PlayerID, Role>,
): AvalonResult {
  if (scenarioID === 'evil-quests') return { winner: 'evil', reason: 'three_quests' }
  if (scenarioID === 'evil-rejections') return { winner: 'evil', reason: 'five_rejections' }

  const merlinID = Object.entries(roles).find(([, role]) => role === 'merlin')?.[0] as PlayerID
  if (scenarioID === 'evil-assassination') {
    return { winner: 'evil', reason: 'assassination', targetID: merlinID }
  }
  const missedTargetID = Object.entries(roles).find(([, role]) => role !== 'merlin' && loyaltyForRole(role) === 'good')?.[0] as PlayerID
  return { winner: 'good', reason: 'assassination', targetID: missedTargetID }
}

// oxlint-disable-next-line react/only-export-components
export function createRoomResultPreviewState(input: Readonly<{
  scenarioID: ResultPreviewScenarioID
  playerCount: number
  pairedRoles: boolean
}>): { room: AvalonMatch; game: AvalonPlayerView } {
  const players = createPlayers(input.playerCount)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const roleConfiguration = { percivalMorgana: input.pairedRoles }
  const roles = assignPreviewRoles(input.playerCount, input.pairedRoles)
  const outcomes = input.scenarioID === 'evil-quests'
    ? [false, true, false, false]
    : input.scenarioID === 'evil-rejections'
      ? [true, false]
      : [true, false, true, true]
  const questHistory = createQuestHistory(input.playerCount, outcomes, occupiedPlayerIDs)
  const result = resultForScenario(input.scenarioID, roles)
  const viewerRole = roles[CURRENT_PLAYER_ID]
  const room: AvalonMatch = {
    gameName: 'avalon',
    matchID: `result-preview-${input.scenarioID}-${input.playerCount}`,
    players,
    setupData: { numPlayers: input.playerCount },
    ownerPlayerID,
    occupiedPlayerIDs,
    roleConfiguration,
  }

  return {
    room,
    game: {
      status: 'finished',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: null,
      leaderID: '0',
      questIndex: Math.min(questHistory.length, 4),
      proposedTeam: occupiedPlayerIDs.slice(0, 2),
      submittedTeamVotePlayerIDs: [],
      submittedQuestCardCount: 0,
      voteHistory: [],
      questHistory,
      consecutiveRejectedTeams: input.scenarioID === 'evil-rejections' ? 5 : 0,
      goodSuccesses: questHistory.filter(({ succeeded }) => succeeded).length,
      evilFailures: questHistory.filter(({ succeeded }) => !succeeded).length,
      rules: { roleConfiguration, timeouts: { enabled: false } },
      result,
      revealedRoles: roles,
      viewer: {
        role: viewerRole,
        loyalty: loyaltyForRole(viewerRole),
        knownEvilPlayerIDs: [],
        knownMerlinCandidatePlayerIDs: [],
      },
    },
  }
}

export function RoomResultPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <ResultPreviewScenario scenarioID={scenarioID} />
}

function ResultPreviewScenario({ scenarioID }: { scenarioID: ResultPreviewScenarioID }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { openHelp } = useHelp()
  const [playerCount, setPlayerCount] = useState(5)
  const [pairedRoles, setPairedRoles] = useState(true)
  const [controlsOpen, setControlsOpen] = useState(false)
  const preview = useMemo(
    () => createRoomResultPreviewState({ scenarioID, playerCount, pairedRoles }),
    [pairedRoles, playerCount, scenarioID],
  )
  const model = useMemo(() => buildRoomScreenModel({
    kind: 'ready', matchID: preview.room.matchID, room: preview.room, game: preview.game,
    phase: 'finished', activeStage: undefined, currentPlayerID: CURRENT_PLAYER_ID,
    selectedTeam: ['0'], selectedTarget: '1', roleKnowledgeOpen: false,
    canStart: false, roomExitBusy: false, connected: true,
    manualReconnectAvailable: false, startPending: false,
  }), [preview])
  const diagnosticsMode = resolveRoomLayoutDiagnosticsMode(location.search, import.meta.env.DEV)

  return (
    <div className="room-lobby-preview">
      <RoomScreen
        actions={{
          onActivatePlayer: noOp, onStart: noOp, onReconnect: noOp,
          onConfirmIdentityRecognition: noOp, onSubmitTeam: noOp,
          onSelectTeamVote: noOp, onConfirmTeamVote: noOp,
          onSelectQuestCard: noOp, onConfirmQuestCard: noOp, onAssassinate: noOp,
        }}
        diagnosticsMode={diagnosticsMode}
        model={model}
        stageAccessory={!controlsOpen ? (
          <button aria-expanded={controlsOpen} aria-label="打开开发预览控制" className="room-lobby-preview__controls-trigger" onClick={() => setControlsOpen(true)} type="button">
            <Info aria-hidden="true" size={20} />
          </button>
        ) : undefined}
        tools={{
          connected: true, isOwner: false, logEntries: [],
          onBackHome: () => navigate('/dev/room-layout'),
          onOpenHelp: () => openHelp({ playerCount }), onRequestRoomExit: noOp,
          onToggleRoleKnowledge: noOp, roomExitBlocked: false, roomExitBusy: false,
          seatChangePending: false, seatChangeTargetID: null,
        }}
      />
      {controlsOpen && (
        <aside aria-label="开发预览控制" className="room-lobby-preview__controls" id="room-result-preview-controls">
          <button aria-controls="room-result-preview-controls" aria-expanded={controlsOpen} aria-label="关闭开发预览控制" className="room-lobby-preview__controls-close" onClick={() => setControlsOpen(false)} type="button">×</button>
          <h1>对局结果预览</h1>
          <label>
            玩家人数
            <select value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>
              {Array.from({ length: 6 }, (_, index) => index + 5).map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label className="room-lobby-preview__controls-check">
            <input checked={pairedRoles} onChange={(event) => setPairedRoles(event.target.checked)} type="checkbox" />启用帕西维尔与莫甘娜
          </label>
        </aside>
      )}
    </div>
  )
}
