import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { loyaltyForRole, type AvalonPlayerView, type PlayerID, type Role } from '@avalon/game'

import { useHelp } from './help-context'
import type { AvalonMatch, LobbyPlayer } from './lobby'
import { resolveRoomLayoutDiagnosticsMode } from './room-layout-diagnostics'
import { buildRoomScreenModel } from './room-screen-controller'
import {
  type RoomIdentityConfirmationState,
} from './RoomIdentityConfirmation'
import { RoomScreen } from './RoomScreen'
import { ROLE_LABELS } from './room-game'
import { useToast } from './toast-context'

type IdentityConfirmationPreviewScenarioID = Extract<
  RoomIdentityConfirmationState,
  'concealed' | 'revealed' | 'confirming' | 'waiting'
>

const SCENARIO_IDS: readonly IdentityConfirmationPreviewScenarioID[] = [
  'concealed',
  'revealed',
  'confirming',
  'waiting',
]
const ROLES: readonly Role[] = ['merlin', 'percival', 'loyal_servant', 'assassin', 'morgana', 'minion']
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
const noOp = () => undefined

function isScenarioID(value: string | undefined): value is IdentityConfirmationPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as IdentityConfirmationPreviewScenarioID)
}

function createPlayers(playerCount: number): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: id !== 1,
  }))
}

function createPreviewState(input: Readonly<{
  playerCount: number
  role: Role
  confirmedCount: number
}>): { room: AvalonMatch; game: AvalonPlayerView } {
  const players = createPlayers(input.playerCount)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const roleConfiguration = { percivalMorgana: true }
  const confirmed = input.confirmedCount > 0

  return {
    room: {
      gameName: 'avalon',
      matchID: `identity-confirmation-preview-${input.role}-${input.playerCount}`,
      players,
      setupData: { numPlayers: input.playerCount },
      ownerPlayerID,
      occupiedPlayerIDs,
      roleConfiguration,
    },
    game: {
      status: 'playing',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: {
        step: 'roleReveal',
        deadlineAt: 0,
        confirmedCount: input.confirmedCount,
        participantCount: input.playerCount,
      },
      leaderID: '0',
      questIndex: 0,
      proposedTeam: null,
      submittedTeamVotePlayerIDs: [],
      submittedQuestCardCount: 0,
      voteHistory: [],
      questHistory: [],
      consecutiveRejectedTeams: 0,
      goodSuccesses: 0,
      evilFailures: 0,
      rules: { roleConfiguration, timeouts: { enabled: false } },
      viewer: {
        role: input.role,
        loyalty: loyaltyForRole(input.role),
        knownEvilPlayerIDs: [],
        knownMerlinCandidatePlayerIDs: [],
        identityRecognition: {
          isParticipant: true,
          confirmed,
          deadlineRefreshRequired: false,
          serverNow: 0,
        },
      },
    },
  }
}

export function RoomIdentityConfirmationPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <IdentityConfirmationPreviewScenario key={scenarioID} scenarioID={scenarioID} />
}

function IdentityConfirmationPreviewScenario({
  scenarioID,
}: {
  scenarioID: IdentityConfirmationPreviewScenarioID
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { openHelp } = useHelp()
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [role, setRole] = useState<Role>('merlin')
  const [confirmedCount, setConfirmedCount] = useState(scenarioID === 'waiting' ? 3 : 0)
  const [state, setState] = useState<RoomIdentityConfirmationState>(scenarioID)
  const [controlsOpen, setControlsOpen] = useState(false)
  const preview = useMemo(
    () => createPreviewState({ playerCount, role, confirmedCount }),
    [confirmedCount, playerCount, role],
  )
  const model = useMemo(() => buildRoomScreenModel({
    kind: 'ready',
    matchID: preview.room.matchID,
    room: preview.room,
    game: preview.game,
    phase: 'identityRecognition',
    activeStage: 'identityRecognition',
    currentPlayerID: CURRENT_PLAYER_ID,
    selectedTeam: [],
    selectedTarget: null,
    roleKnowledgeOpen: false,
    canStart: false,
    roomExitBusy: false,
    connected: true,
    manualReconnectAvailable: false,
    startPending: false,
  }), [preview])
  const diagnosticsMode = resolveRoomLayoutDiagnosticsMode(location.search, import.meta.env.DEV)
  const setPreviewState = (next: RoomIdentityConfirmationState) => {
    setState(next)
    if (next === 'waiting' || next === 'reviewing') {
      setConfirmedCount((count) => Math.max(1, count))
    }
  }

  return (
    <div className="room-lobby-preview">
      <RoomScreen
        actions={{
          onActivatePlayer: noOp,
          onStart: noOp,
          onReconnect: noOp,
          onConfirmIdentityRecognition: noOp,
          onSubmitTeam: noOp,
          onSelectTeamVote: noOp,
          onConfirmTeamVote: noOp,
          onSelectQuestCard: noOp,
          onConfirmQuestCard: noOp,
          onAssassinate: noOp,
        }}
        diagnosticsMode={diagnosticsMode}
        identityConfirmation={{
          confirmedCount,
          onCloseReview: () => setPreviewState('waiting'),
          onConfirm: () => setPreviewState('confirming'),
          onHide: () => setPreviewState('hiding'),
          onHideComplete: () => setPreviewState('concealed'),
          onReveal: () => setPreviewState('revealing'),
          onRevealComplete: () => setPreviewState('revealed'),
          onReview: () => setPreviewState('reviewing'),
          participantCount: playerCount,
          role,
          state,
        }}
        model={model}
        stageAccessory={!controlsOpen ? (
          <button aria-expanded={controlsOpen} aria-label="打开开发预览控制" className="room-lobby-preview__controls-trigger" onClick={() => setControlsOpen(true)} type="button">
            <Info aria-hidden="true" size={20} />
          </button>
        ) : undefined}
        tools={{
          connected: true,
          isOwner: false,
          logEntries: [],
          onBackHome: () => navigate('/dev/room-layout'),
          onOpenHelp: () => openHelp({ playerCount }),
          onRequestRoomExit: noOp,
          onToggleRoleKnowledge: noOp,
          roomExitBlocked: false,
          roomExitBusy: false,
          seatChangePending: false,
          seatChangeTargetID: null,
        }}
      />
      {controlsOpen && (
        <aside aria-label="开发预览控制" className="room-lobby-preview__controls" id="room-identity-confirmation-preview-controls">
          <button aria-controls="room-identity-confirmation-preview-controls" aria-expanded={controlsOpen} aria-label="关闭开发预览控制" className="room-lobby-preview__controls-close" onClick={() => setControlsOpen(false)} type="button">×</button>
          <h1>首次身份确认预览</h1>
          <label>
            玩家人数
            <select onChange={(event) => {
              const nextCount = Number(event.target.value)
              setPlayerCount(nextCount)
              setConfirmedCount((count) => Math.min(count, nextCount))
            }} value={playerCount}>
              {[5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label>
            当前角色
            <select onChange={(event) => setRole(event.target.value as Role)} value={role}>
              {ROLES.map((option) => <option key={option} value={option}>{ROLE_LABELS[option]}</option>)}
            </select>
          </label>
          <label>
            已确认人数
            <select onChange={(event) => setConfirmedCount(Number(event.target.value))} value={confirmedCount}>
              {Array.from({ length: playerCount + 1 }, (_, count) => <option key={count} value={count}>{count} / {playerCount}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>场景状态</legend>
            <button onClick={() => setPreviewState('concealed')} type="button">未揭示</button>
            <button onClick={() => setPreviewState('revealed')} type="button">已揭示</button>
            <button onClick={() => setPreviewState('confirming')} type="button">正在确认</button>
            <button onClick={() => setPreviewState('waiting')} type="button">已确认等待</button>
            <button onClick={() => setPreviewState('reviewing')} type="button">再次查看</button>
          </fieldset>
          {state === 'confirming' && (
            <fieldset>
              <legend>确认请求结果</legend>
              <button onClick={() => {
                setConfirmedCount((count) => Math.min(playerCount, Math.max(1, count + 1)))
                setPreviewState('waiting')
              }} type="button">模拟确认成功</button>
              <button onClick={() => {
                setPreviewState('revealed')
                pushToast({ message: '确认身份失败，请重试。', tone: 'error' })
              }} type="button">模拟确认失败</button>
            </fieldset>
          )}
        </aside>
      )}
    </div>
  )
}
