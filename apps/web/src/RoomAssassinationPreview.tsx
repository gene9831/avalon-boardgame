import { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { AvalonPlayerView, PlayerID, Role } from '@avalon/game'

import { useHelp } from './help-context'
import type { AvalonMatch, LobbyPlayer } from './lobby'
import {
  withAssassinationOutcome,
  type AssassinationOutcome,
} from './room-assassination-preview-model'
import { resolveRoomLayoutDiagnosticsMode } from './room-layout-diagnostics'
import { buildRoomScreenModel } from './room-screen-controller'
import { LegacyRoomScreen as RoomScreen } from './LegacyRoomScreen'
import { useToast } from './toast-context'

type AssassinationPreviewScenarioID = 'assassin' | 'evil' | 'good'

const SCENARIO_IDS: readonly AssassinationPreviewScenarioID[] = ['assassin', 'evil', 'good']
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚']
const noOp = () => undefined

function isScenarioID(value: string | undefined): value is AssassinationPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as AssassinationPreviewScenarioID)
}

function rolesForScenario(scenarioID: AssassinationPreviewScenarioID): Record<PlayerID, Role> {
  if (scenarioID === 'assassin') {
    return { '0': 'merlin', '1': 'percival', '2': 'assassin', '3': 'loyal_servant', '4': 'minion' }
  }
  if (scenarioID === 'evil') {
    return { '0': 'merlin', '1': 'percival', '2': 'minion', '3': 'loyal_servant', '4': 'assassin' }
  }
  return { '0': 'merlin', '1': 'percival', '2': 'loyal_servant', '3': 'minion', '4': 'assassin' }
}

function createPlayers(disconnected: boolean): LobbyPlayer[] {
  return PLAYER_NAMES.map((name, id) => ({
    id,
    name: `${name} ${id + 1}`,
    isConnected: !disconnected || id !== 1,
  }))
}

function createPreviewState(input: Readonly<{
  scenarioID: AssassinationPreviewScenarioID
  disconnected: boolean
  finalOutcome: AssassinationOutcome | null
}>): { room: AvalonMatch; game: AvalonPlayerView; roles: Record<PlayerID, Role> } {
  const players = createPlayers(input.disconnected)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const roles = rolesForScenario(input.scenarioID)
  const questHistory = [
    { questIndex: 0, team: ['0', '1'], successCount: 2, failCount: 0, succeeded: true },
    { questIndex: 1, team: ['1', '2', '3'], successCount: 3, failCount: 0, succeeded: true },
    { questIndex: 2, team: ['0', '2'], successCount: 2, failCount: 0, succeeded: true },
  ]
  const viewerRole = roles[CURRENT_PLAYER_ID]
  const viewerLoyalty = input.scenarioID === 'good' ? 'good' : 'evil'
  const knownEvilPlayerIDs = viewerLoyalty === 'evil'
    ? occupiedPlayerIDs.filter((playerID) => playerID !== CURRENT_PLAYER_ID && ['assassin', 'minion'].includes(roles[playerID]))
    : []
  const room: AvalonMatch = {
    gameName: 'avalon', matchID: `assassination-preview-${input.scenarioID}`,
    players, setupData: { numPlayers: 5 }, ownerPlayerID, occupiedPlayerIDs,
    roleConfiguration: { percivalMorgana: true },
  }

  return {
    room,
    roles,
    game: {
      status: input.finalOutcome === null ? 'playing' : 'finished',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: null,
      leaderID: '0', questIndex: 2, proposedTeam: ['0', '2'],
      submittedTeamVotePlayerIDs: [], submittedQuestCardCount: 0,
      voteHistory: [{
        proposerID: '0', questIndex: 2, team: ['0', '2'], approved: true,
        votes: { '0': 'approve', '1': 'approve', '2': 'reject', '3': 'approve', '4': 'approve' },
      }],
      questHistory,
      consecutiveRejectedTeams: 0, goodSuccesses: 3, evilFailures: 0,
      rules: { roleConfiguration: room.roleConfiguration, timeouts: { enabled: false } },
      viewer: {
        role: viewerRole, loyalty: viewerLoyalty, knownEvilPlayerIDs,
        knownMerlinCandidatePlayerIDs: [],
      },
      ...(input.finalOutcome === null ? {} : {
        result: {
          winner: input.finalOutcome.winner,
          reason: 'assassination' as const,
          targetID: input.finalOutcome.targetID,
        },
        revealedRoles: roles,
      }),
    },
  }
}

export function RoomAssassinationPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <AssassinationPreviewScenario scenarioID={scenarioID} />
}

function AssassinationPreviewScenario({ scenarioID }: { scenarioID: AssassinationPreviewScenarioID }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { openHelp } = useHelp()
  const { pushToast } = useToast()
  const [selectedTarget, setSelectedTarget] = useState<PlayerID | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [disconnected, setDisconnected] = useState(true)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [outcome, setOutcome] = useState<AssassinationOutcome | null>(null)
  const [finalOutcome, setFinalOutcome] = useState<AssassinationOutcome | null>(null)

  useEffect(() => {
    if (outcome === null) return
    const timer = window.setTimeout(() => {
      setFinalOutcome(outcome)
      setOutcome(null)
    }, 3_000)
    return () => window.clearTimeout(timer)
  }, [outcome])

  const preview = useMemo(() => createPreviewState({ scenarioID, disconnected, finalOutcome }), [disconnected, finalOutcome, scenarioID])
  const diagnosticsMode = resolveRoomLayoutDiagnosticsMode(location.search, import.meta.env.DEV)
  const baseModel = useMemo(() => buildRoomScreenModel({
    kind: 'ready', matchID: preview.room.matchID, room: preview.room, game: preview.game,
    phase: finalOutcome === null ? 'assassination' : 'finished',
    activeStage: finalOutcome === null && scenarioID === 'assassin' ? 'assassin' : undefined,
    currentPlayerID: CURRENT_PLAYER_ID, selectedTeam: [], selectedTarget,
    roleKnowledgeOpen: false, canStart: false, roomExitBusy: false,
    connected: true, manualReconnectAvailable: false, startPending: false,
    assassinationSubmissionPending: submitting || outcome !== null,
  }), [finalOutcome, outcome, preview, scenarioID, selectedTarget, submitting])
  const targetName = selectedTarget === null
    ? ''
    : preview.room.players.find(({ id }) => String(id) === selectedTarget)?.name ?? `玩家 ${Number(selectedTarget) + 1}`
  const model = outcome === null
    ? baseModel
    : withAssassinationOutcome(baseModel, outcome, targetName)

  const resetPreview = () => {
    setSelectedTarget(null)
    setSubmitting(false)
    setDisconnected(true)
    setOutcome(null)
    setFinalOutcome(null)
  }
  const simulateOutcome = (hit: boolean) => {
    const targetID = hit ? ('0' as PlayerID) : ('1' as PlayerID)
    const targetRole = preview.roles[targetID]
    setSelectedTarget(targetID)
    setSubmitting(false)
    setFinalOutcome(null)
    setOutcome({ targetID, targetRole, hit, winner: hit ? 'evil' : 'good' })
  }

  return (
    <div className="room-lobby-preview">
      <RoomScreen
        actions={{
          onActivatePlayer: (playerID) => {
            if (scenarioID !== 'assassin' || submitting || outcome !== null || finalOutcome !== null) return
            setSelectedTarget(playerID)
          },
          onStart: noOp, onReconnect: noOp, onConfirmIdentityRecognition: noOp,
          onSubmitTeam: noOp, onSelectTeamVote: noOp, onConfirmTeamVote: noOp,
          onSelectQuestCard: noOp, onConfirmQuestCard: noOp,
          onAssassinate: () => {
            if (scenarioID === 'assassin' && selectedTarget !== null) setSubmitting(true)
          },
        }}
        diagnosticsMode={diagnosticsMode}
        model={model}
        stageAccessory={!controlsOpen ? (
          <button aria-expanded={controlsOpen} aria-label="打开开发预览控制" className="room-lobby-preview__controls-trigger" onClick={() => setControlsOpen(true)} type="button">
            <Info aria-hidden="true" size={20} />
          </button>
        ) : undefined}
        tools={{
          connected: true, isOwner: preview.room.ownerPlayerID === CURRENT_PLAYER_ID,
          logEntries: [], onBackHome: () => navigate('/dev/room-layout'),
          onOpenHelp: () => openHelp({ playerCount: 5 }), onRequestRoomExit: noOp,
          onToggleRoleKnowledge: noOp, roomExitBlocked: false, roomExitBusy: false,
          seatChangePending: false, seatChangeTargetID: null,
        }}
      />
      {controlsOpen && (
        <aside aria-label="开发预览控制" className="room-lobby-preview__controls" id="room-assassination-preview-controls">
          <button aria-controls="room-assassination-preview-controls" aria-expanded={controlsOpen} aria-label="关闭开发预览控制" className="room-lobby-preview__controls-close" onClick={() => setControlsOpen(false)} type="button">×</button>
          <h1>刺杀阶段预览</h1>
          <label className="room-lobby-preview__controls-check">
            <input checked={disconnected} onChange={(event) => setDisconnected(event.target.checked)} type="checkbox" />2 号玩家掉线
          </label>
          {scenarioID === 'assassin' && (
            <fieldset>
              <legend>刺杀选择</legend>
              <button onClick={() => { setSelectedTarget(null); setSubmitting(false); setOutcome(null); setFinalOutcome(null) }} type="button">未选择</button>
              <button onClick={() => { setSelectedTarget('0'); setSubmitting(false); setOutcome(null); setFinalOutcome(null) }} type="button">选择梅林</button>
              <button onClick={() => { setSelectedTarget('1'); setSubmitting(false); setOutcome(null); setFinalOutcome(null) }} type="button">选择其他正义玩家</button>
              <button onClick={() => { setSelectedTarget('0'); setSubmitting(true); setOutcome(null); setFinalOutcome(null) }} type="button">正在确认</button>
              <button onClick={() => { setSubmitting(false); pushToast({ message: '刺杀提交失败，请重试', tone: 'error' }) }} type="button">模拟提交失败</button>
            </fieldset>
          )}
          <button onClick={() => simulateOutcome(true)} type="button">模拟刺杀命中</button>
          <button onClick={() => simulateOutcome(false)} type="button">模拟刺杀未命中</button>
          <button onClick={resetPreview} type="button">重置预览</button>
        </aside>
      )}
    </div>
  )
}
