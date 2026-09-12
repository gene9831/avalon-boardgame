import { useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { PlayerID } from '@avalon/game'

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
import { buildQuestProgress, buildRoomPlayers } from './room-screen-model'
import type { RoomConnectionRecoveryScene, RoomLobbyScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'
import { useToast } from './toast-context'

function isScenarioID(value: string | undefined): value is LobbyPreviewScenarioID {
  return value !== undefined && LOBBY_PREVIEW_SCENARIO_IDS.includes(value as LobbyPreviewScenarioID)
}

export function RoomLobbyPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <LobbyPreviewScenario scenarioID={scenarioID} />
}

function LobbyPreviewScenario({ scenarioID }: { scenarioID: LobbyPreviewScenarioID }) {
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [seatChangeTargetID, setSeatChangeTargetID] = useState<PlayerID | null>(null)
  const [startPending, setStartPending] = useState(false)
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
  const emptySeatID = room.players.find((player) => player.name == null)
  const players = useMemo(() => buildRoomPlayers({
    players: room.players,
    numPlayers: room.setupData?.numPlayers ?? room.players.length,
    currentPlayerID: preview.currentPlayerID,
    phase: 'lobby',
    viewerConnected: reconnectPresentation.connected,
    ownerPlayerID: room.ownerPlayerID,
    game: preview.game,
    selectedTeam: [],
    selectedTarget: null,
    showKnownPlayerInfo: false,
    showPrivateRoleKnowledge: false,
    interactionMode: reconnectPresentation.connected ? 'changeSeat' : 'none',
    seatChangeTargetID,
  }), [preview.currentPlayerID, preview.game, reconnectPresentation.connected, room, seatChangeTargetID])
  const sceneBase = {
    matchID: room.matchID,
    playerCount: room.setupData?.numPlayers ?? room.players.length,
    players,
    questProgress: buildQuestProgress(room.setupData?.numPlayers ?? room.players.length, preview.game),
  }

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

  const controls = (
    <>
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
    </>
  )

  if (!reconnectPresentation.connected) {
    const scene: RoomConnectionRecoveryScene = {
      kind: 'connectionRecovery',
      ...sceneBase,
      manualReconnectAvailable: reconnectPresentation.manualReconnectAvailable,
    }
    return <RoomScreenPreviewShell actions={{ onReconnect: handleReconnect }} controls={controls} scene={scene} />
  }

  const scene: RoomLobbyScene = {
    kind: 'lobby',
    ...sceneBase,
    occupiedCount: room.players.filter(({ name }) => name != null).length,
    seatCount: sceneBase.playerCount,
    viewer: room.ownerPlayerID === preview.currentPlayerID ? 'owner' : 'player',
    canStart: preview.canStart && !startPending,
    startRequestState: startPending ? 'pending' : 'idle',
  }
  return (
    <RoomScreenPreviewShell
      actions={{
        onActivatePlayer: (playerID) => setSeatChangeTargetID(playerID),
        onStart: () => setStartPending(true),
      }}
      controls={controls}
      scene={scene}
    />
  )
}
