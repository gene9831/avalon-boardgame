import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getPlayerCountConfig, loyaltyForRole, type AvalonPlayerView, type PlayerID, type Role } from '@avalon/game'

import { useHelp } from './help-context'
import type { AvalonMatch, LobbyPlayer } from './lobby'
import { resolveRoomLayoutDiagnosticsMode } from './room-layout-diagnostics'
import { buildRoomScreenModel } from './room-screen-controller'
import {
  type RoomIdentityRecognitionScene,
  type RoomIdentityRecognitionState,
} from './RoomIdentityRecognition'
import { LegacyRoomScreen as RoomScreen } from './LegacyRoomScreen'
import { useToast } from './toast-context'

type IdentityRecognitionPreviewScenarioID = RoomIdentityRecognitionScene['type']

const SCENARIO_IDS: readonly IdentityRecognitionPreviewScenarioID[] = [
  'evil-allies',
  'merlin-evil',
  'percival-candidates',
  'none',
]
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
const noOp = () => undefined

const SCENARIO_ROLES: Readonly<Record<IdentityRecognitionPreviewScenarioID, Role>> = {
  'evil-allies': 'assassin',
  'merlin-evil': 'merlin',
  'percival-candidates': 'percival',
  none: 'loyal_servant',
}

function isScenarioID(value: string | undefined): value is IdentityRecognitionPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as IdentityRecognitionPreviewScenarioID)
}

function createPlayers(playerCount: number): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: id !== 1,
  }))
}

function createScene(
  scenarioID: IdentityRecognitionPreviewScenarioID,
  playerCount: number,
): RoomIdentityRecognitionScene {
  const evilCount = getPlayerCountConfig(playerCount).evil
  const evilSeats = ['0', '4', '6', '8'] as const satisfies readonly PlayerID[]
  if (scenarioID === 'evil-allies') {
    return { type: scenarioID, targetPlayerIDs: evilSeats.slice(0, evilCount - 1) }
  }
  if (scenarioID === 'merlin-evil') {
    return { type: scenarioID, targetPlayerIDs: evilSeats.slice(0, evilCount) }
  }
  if (scenarioID === 'percival-candidates') {
    return {
      type: scenarioID,
      targetPlayerIDs: ['1', playerCount >= 7 ? '6' : '4'],
    }
  }
  return { type: 'none', targetPlayerIDs: [] }
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

  return {
    room: {
      gameName: 'avalon',
      matchID: `identity-recognition-preview-${input.role}-${input.playerCount}`,
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
          confirmed: false,
          deadlineRefreshRequired: false,
          serverNow: 0,
        },
      },
    },
  }
}

export function RoomIdentityRecognitionPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <IdentityRecognitionPreviewScenario key={scenarioID} scenarioID={scenarioID} />
}

function IdentityRecognitionPreviewScenario({
  scenarioID,
}: {
  scenarioID: IdentityRecognitionPreviewScenarioID
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { openHelp } = useHelp()
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [state, setState] = useState<RoomIdentityRecognitionState>('concealed')
  const [controlsOpen, setControlsOpen] = useState(false)
  const role = SCENARIO_ROLES[scenarioID]
  const scene = useMemo(() => createScene(scenarioID, playerCount), [playerCount, scenarioID])
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

  const showStableState = (next: RoomIdentityRecognitionState) => {
    setState(next)
    if (next === 'waiting') setConfirmedCount((count) => Math.max(1, count))
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
        identityRecognition={{
          confirmedCount,
          onConfirm: () => setState('confirming'),
          onReveal: () => setState('revealing'),
          onRevealComplete: () => setState('revealed'),
          participantCount: playerCount,
          scene,
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
        <aside aria-label="开发预览控制" className="room-lobby-preview__controls" id="room-identity-recognition-preview-controls">
          <button aria-controls="room-identity-recognition-preview-controls" aria-expanded={controlsOpen} aria-label="关闭开发预览控制" className="room-lobby-preview__controls-close" onClick={() => setControlsOpen(false)} type="button">×</button>
          <h1>身份辨认预览</h1>
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
            已确认人数
            <select onChange={(event) => setConfirmedCount(Number(event.target.value))} value={confirmedCount}>
              {Array.from({ length: playerCount + 1 }, (_, count) => <option key={count} value={count}>{count} / {playerCount}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>场景状态</legend>
            <button onClick={() => showStableState('concealed')} type="button">未查看</button>
            <button onClick={() => showStableState('revealed')} type="button">已显示</button>
            <button onClick={() => showStableState('confirming')} type="button">正在确认</button>
            <button onClick={() => showStableState('waiting')} type="button">已确认等待</button>
          </fieldset>
          {state === 'confirming' && (
            <fieldset>
              <legend>确认请求结果</legend>
              <button onClick={() => {
                setConfirmedCount((count) => Math.min(playerCount, Math.max(1, count + 1)))
                setState('waiting')
              }} type="button">模拟确认成功</button>
              <button onClick={() => {
                setState('revealed')
                pushToast({ message: '确认辨认失败，请重试。', tone: 'error' })
              }} type="button">模拟确认失败</button>
            </fieldset>
          )}
        </aside>
      )}
    </div>
  )
}
