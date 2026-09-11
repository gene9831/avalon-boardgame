import { useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import type { PlayerID } from '@avalon/game'

import { useHelp } from './help-context'
import { RoomScreen } from './RoomScreen'
import { resolveRoomLayoutDiagnosticsMode } from './room-layout-diagnostics'
import { buildRoomScreenModel } from './room-screen-controller'
import {
  applyLobbyPreviewReconnectCompletion,
  buildLobbyPreviewState,
  completeLobbyPreviewReconnect,
  getLobbyPreviewReconnectPresentation,
  LOBBY_PREVIEW_SCENARIO_IDS,
  resetLobbyPreviewReconnect,
  type LobbyPreviewReconnectState,
  type LobbyPreviewScenarioID,
} from './room-lobby-preview-model'
import { useToast } from './toast-context'

const SCENARIO_LABELS: Record<LobbyPreviewScenarioID, string> = {
  'member-incomplete': '玩家 · 未满员',
  'owner-incomplete': '房主 · 未满员',
  'member-full': '玩家 · 已满员',
  'owner-full': '房主 · 已满员',
  'current-player-disconnected': '当前玩家掉线',
}

function isScenarioID(value: string | undefined): value is LobbyPreviewScenarioID {
  return value !== undefined && LOBBY_PREVIEW_SCENARIO_IDS.includes(value as LobbyPreviewScenarioID)
}

const noOp = () => undefined

export function RoomLobbyPreview() {
  const { scenarioID } = useParams()
  if (scenarioID === undefined) return <LobbyPreviewIndex />
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout/lobby" />
  return <LobbyPreviewScenario scenarioID={scenarioID} />
}

function LobbyPreviewIndex() {
  return (
    <main className="room-lobby-preview-index">
      <h1>等待大厅预览</h1>
      <p>使用真实房间界面检查等待状态，不连接服务端。</p>
      <nav aria-label="等待大厅场景">
        <ul>
          {LOBBY_PREVIEW_SCENARIO_IDS.map((scenarioID) => (
            <li key={scenarioID}><Link to={`/dev/room-layout/lobby/${scenarioID}`}>{SCENARIO_LABELS[scenarioID]}</Link></li>
          ))}
        </ul>
      </nav>
      <Link to="/dev/room-layout">返回几何预览</Link>
    </main>
  )
}

function LobbyPreviewScenario({ scenarioID }: { scenarioID: LobbyPreviewScenarioID }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { openHelp } = useHelp()
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [seatChangeTargetID, setSeatChangeTargetID] = useState<PlayerID | null>(null)
  const [startPending, setStartPending] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [reconnectState, setReconnectState] = useState<LobbyPreviewReconnectState>({ mode: 'automatic', completed: false })
  const reconnectCompletionRef = useRef(false)
  const preview = useMemo(() => buildLobbyPreviewState({
    scenarioID, playerCount, reconnectMode: reconnectState.mode, seatChangeTargetID, startPending,
  }), [playerCount, reconnectState.mode, scenarioID, seatChangeTargetID, startPending])
  const reconnectScenario = scenarioID === 'current-player-disconnected'
  const reconnectPresentation = reconnectScenario
    ? getLobbyPreviewReconnectPresentation(reconnectState)
    : { connected: preview.connected, manualReconnectAvailable: preview.manualReconnectAvailable }
  const room = reconnectScenario
    ? applyLobbyPreviewReconnectCompletion(preview.room, preview.currentPlayerID, reconnectState.completed)
    : preview.room
  const model = useMemo(() => buildRoomScreenModel({
    kind: 'ready',
    matchID: room.matchID,
    room,
    game: preview.game,
    phase: 'lobby',
    activeStage: undefined,
    currentPlayerID: preview.currentPlayerID,
    selectedTeam: [],
    selectedTarget: null,
    roleKnowledgeOpen: false,
    canStart: preview.canStart,
    roomExitBusy: false,
    connected: reconnectPresentation.connected,
    manualReconnectAvailable: reconnectPresentation.manualReconnectAvailable,
    startPending,
  }), [preview, reconnectPresentation.connected, reconnectPresentation.manualReconnectAvailable, room, startPending])
  const emptySeatID = room.players.find((player) => player.name == null)
  const diagnosticsMode = resolveRoomLayoutDiagnosticsMode(location.search, import.meta.env.DEV)

  const resetReconnect = () => {
    reconnectCompletionRef.current = false
    setReconnectState((current) => resetLobbyPreviewReconnect(current))
  }

  const handleReconnect = () => {
    if (reconnectCompletionRef.current) return
    const completion = completeLobbyPreviewReconnect(reconnectState)
    if (completion.toast === null) return
    reconnectCompletionRef.current = true
    setReconnectState(completion.state)
    pushToast(completion.toast)
  }

  const resetDemo = () => {
    setSeatChangeTargetID(null)
    setStartPending(false)
    resetReconnect()
  }

  return (
    <div className="room-lobby-preview">
      <RoomScreen
        actions={{
          onActivatePlayer: (playerID) => setSeatChangeTargetID(playerID),
          onStart: () => setStartPending(true),
          onReconnect: handleReconnect,
          onConfirmIdentityRecognition: noOp,
          onSubmitTeam: noOp,
          onCastTeamVote: noOp,
          onPlayQuestCard: noOp,
          onAssassinate: noOp,
        }}
        diagnosticsMode={diagnosticsMode}
        model={model}
        tools={{
          connected: reconnectPresentation.connected,
          isOwner: room.ownerPlayerID === preview.currentPlayerID,
          logEntries: [],
          onBackHome: () => navigate('/dev/room-layout/lobby'),
          onOpenHelp: () => openHelp({ playerCount }),
          onRequestRoomExit: noOp,
          onToggleRoleKnowledge: noOp,
          roomExitBlocked: seatChangeTargetID !== null || startPending,
          roomExitBusy: false,
          seatChangePending: seatChangeTargetID !== null,
          seatChangeTargetID,
        }}
      />
      {controlsOpen ? (
        <aside aria-label="开发预览控制" className="room-lobby-preview__controls" id="room-lobby-preview-controls">
          <button aria-controls="room-lobby-preview-controls" aria-expanded={controlsOpen} aria-label="关闭开发预览控制" className="room-lobby-preview__controls-close" onClick={() => setControlsOpen(false)} type="button">×</button>
          <h1>开发预览控制</h1>
          <label>
            玩家人数
            <select onChange={(event) => { setPlayerCount(Number(event.target.value)); setSeatChangeTargetID(null) }} value={playerCount}>
              {[5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          {emptySeatID !== undefined && (
            <button disabled={seatChangeTargetID !== null} onClick={() => setSeatChangeTargetID(String(emptySeatID.id))} type="button">模拟换座</button>
          )}
          {scenarioID === 'owner-full' && (
            <button disabled={startPending} onClick={() => setStartPending(true)} type="button">模拟开始中</button>
          )}
          {reconnectScenario && (
            <fieldset>
              <legend>重连展示</legend>
              <button aria-pressed={reconnectState.mode === 'automatic'} onClick={resetReconnect} type="button">自动重连中</button>
              <button aria-pressed={reconnectState.mode === 'manual'} onClick={() => {
                reconnectCompletionRef.current = false
                setReconnectState({ mode: 'manual', completed: false })
              }} type="button">可手动重连</button>
            </fieldset>
          )}
          <button onClick={resetDemo} type="button">重置预览</button>
        </aside>
      ) : (
        <button aria-controls="room-lobby-preview-controls" aria-expanded={controlsOpen} aria-label="打开开发预览控制" className="room-lobby-preview__controls-trigger" onClick={() => setControlsOpen(true)} type="button">
          <SlidersHorizontal aria-hidden="true" size={20} />
        </button>
      )}
    </div>
  )
}
