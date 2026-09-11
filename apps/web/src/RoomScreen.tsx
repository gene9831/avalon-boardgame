import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlayerID } from '@avalon/game'

import { IdentityRecognitionLayer } from './IdentityRecognitionLayer'
import { QuestProgressTrack } from './QuestProgressTrack'
import { RoomCenterSummary } from './RoomCenterSummary'
import { RoomBackButton } from './RoomBackButton'
import { RoomLayout } from './RoomLayout'
import { RoomLayoutDiagnostics } from './RoomLayoutDiagnostics'
import { RoomNumber } from './RoomNumber'
import { RoomPhaseLabel } from './RoomPhaseLabel'
import { RoomPhasePanel } from './RoomPhasePanel'
import { RoomPhasePanelContent } from './RoomPhasePanelContent'
import { RoomPlayerSeat } from './RoomPlayerSeat'
import { RoomStage } from './RoomStage'
import { RoomUtilities, type RoomUtilityTools } from './RoomUtilities'
import { readRoomSafeAreaInsets, type RoomSafeAreaInsets } from './room-layout-diagnostics'
import type { RoomPlayerModel, RoomScreenActions, RoomScreenModel } from './room-screen-model'
import { useRoomLayout, type RoomLayoutDiagnosticsMode } from './useRoomLayout'

export interface RoomScreenProps {
  model: RoomScreenModel
  actions: RoomScreenActions
  diagnosticsMode: RoomLayoutDiagnosticsMode
  tools: RoomUtilityTools & { onBackHome: () => void; seatChangeTargetID: PlayerID | null }
}

export function RoomScreen({ model, actions, diagnosticsMode, tools }: RoomScreenProps) {
  const { canvasRef, stageRef, snapshot } = useRoomLayout(model.numPlayers, diagnosticsMode)
  const rootRef = useRef<HTMLElement | null>(null)
  const [safeArea, setSafeArea] = useState<RoomSafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 })
  const setCanvasRef = useCallback((node: HTMLElement | null) => {
    rootRef.current = node
    canvasRef(node)
  }, [canvasRef])
  useEffect(() => {
    if (rootRef.current !== null) setSafeArea(readRoomSafeAreaInsets(rootRef.current))
  }, [snapshot.viewportSize])
  const phase = RoomPhasePanelContent({ actions, model: model.phase })
  const center = <RoomCenterSummary model={model.center} />

  return (
    <div className="size-full" data-room-mode={model.mode} data-room-screen="true">
      <RoomLayout
        chrome={{
          back: <RoomBackButton onBack={tools.onBackHome} />,
          phase: <RoomPhaseLabel phase={model.phase.title} />,
          questProgress: <QuestProgressTrack nodes={model.questProgress} />,
          roomNumber: <RoomNumber matchID={model.matchID} />,
          toolbar: <RoomUtilities model={model.utilities} tools={tools} />,
        }}
        layoutRef={setCanvasRef}
        phasePanel={<RoomPhasePanel action={phase.action} middle={phase.middle} />}
        stage={(
          <>
            {model.numPlayers === null ? (
              <section aria-label="房间加载舞台" className="room-stage grid size-full place-items-center" data-room-stage="true" data-stage-layout-status="measuring">{center}</section>
            ) : (
              <RoomStage
                ariaLabel={`${model.numPlayers} 人游戏圆桌`}
                center={center}
                layout={snapshot.stageLayout}
                players={model.players}
                renderPlayer={(player, layout) => (
                  <RoomPlayerSeat
                    disabled={isPlayerDisabled(model, player, tools.seatChangeTargetID)}
                    interactionMode={model.playerInteractionMode}
                    layout={layout}
                    onActivate={actions.onActivatePlayer}
                    pending={tools.seatChangeTargetID === player.playerID}
                    player={player}
                  />
                )}
              />
            )}
            {model.stageOverlay.kind === 'identityRecognition' && <IdentityRecognitionLayer overlay={model.stageOverlay} />}
            {diagnosticsMode !== 'off' && <RoomLayoutDiagnostics mode={diagnosticsMode} playerCount={model.numPlayers} safeArea={safeArea} snapshot={snapshot} />}
          </>
        )}
        stageRef={stageRef}
      />
    </div>
  )
}

function isPlayerDisabled(
  model: RoomScreenModel,
  player: RoomPlayerModel,
  seatChangeTargetID: PlayerID | null,
): boolean {
  if (model.playerInteractionMode === 'none') return true
  if (model.playerInteractionMode === 'changeSeat') {
    return !model.connected || player.occupied || seatChangeTargetID !== null
  }
  if (model.playerInteractionMode === 'selectAssassinationTarget') {
    return player.isCurrentPlayer || player.knownEvil
  }
  return !player.occupied
}
