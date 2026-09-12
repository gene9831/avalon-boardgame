import { useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import type { PlayerID } from '@avalon/game'

import { useHelp } from './help-context'
import { LegacyRoomScreen as RoomScreen } from './LegacyRoomScreen'
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

function isScenarioID(value: string | undefined): value is LobbyPreviewScenarioID {
  return value !== undefined && LOBBY_PREVIEW_SCENARIO_IDS.includes(value as LobbyPreviewScenarioID)
}

const noOp = () => undefined

export function RoomLobbyPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <LobbyPreviewScenario scenarioID={scenarioID} />
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
    seatChangeTargetID,
    startPending,
  }), [preview, reconnectPresentation.connected, reconnectPresentation.manualReconnectAvailable, room, seatChangeTargetID, startPending])
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
          onSelectTeamVote: noOp,
          onConfirmTeamVote: noOp,
          onSelectQuestCard: noOp,
          onConfirmQuestCard: noOp,
          onAssassinate: noOp,
        }}
        diagnosticsMode={diagnosticsMode}
        model={model}
        stageAccessory={!controlsOpen ? (
          <button aria-expanded={controlsOpen} aria-label="打开开发预览控制" className="room-lobby-preview__controls-trigger" onClick={() => setControlsOpen(true)} type="button">
            <Info aria-hidden="true" size={20} />
          </button>
        ) : undefined}
        tools={{
          connected: reconnectPresentation.connected,
          isOwner: room.ownerPlayerID === preview.currentPlayerID,
          logEntries: [],
          onBackHome: () => navigate('/dev/room-layout'),
          onOpenHelp: () => openHelp({ playerCount }),
          onRequestRoomExit: noOp,
          onToggleRoleKnowledge: noOp,
          roomExitBlocked: seatChangeTargetID !== null || startPending,
          roomExitBusy: false,
          seatChangePending: seatChangeTargetID !== null,
          seatChangeTargetID,
        }}
      />
      {controlsOpen && (
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
      )}
    </div>
  )
}
