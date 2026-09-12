import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { PlayerID } from '@avalon/game'

import { IdentityRecognitionLayer } from './IdentityRecognitionLayer'
import { QuestProgressTrack } from './QuestProgressTrack'
import { RoomCenterSummary } from './RoomCenterSummary'
import { RoomBackButton } from './RoomBackButton'
import { RoomLayout } from './RoomLayout'
import { RoomLayoutDiagnostics } from './RoomLayoutDiagnostics'
import { RoomNumber } from './RoomNumber'
import { RoomPhasePanel } from './RoomPhasePanel'
import { RoomPhasePanelContent } from './RoomPhasePanelContent'
import {
  RoomIdentityConfirmationCenter,
  RoomIdentityConfirmationPhaseContent,
  RoomIdentityConfirmationStage,
  type RoomIdentityConfirmationPresentation,
} from './RoomIdentityConfirmation'
import {
  RoomIdentityRecognitionCenter,
  RoomIdentityRecognitionPhaseContent,
  RoomIdentityRecognitionStage,
  type RoomIdentityRecognitionPresentation,
} from './RoomIdentityRecognition'
import { applyLegacyRoomIdentityRecognitionSeat } from './room-identity-recognition-seat'
import { RoomPlayerSeat } from './RoomPlayerSeat'
import { RoomStage } from './RoomStage'
import { RoomUtilities, type RoomUtilityTools } from './RoomUtilities'
import { readRoomSafeAreaInsets, type RoomSafeAreaInsets } from './room-layout-diagnostics'
import type { RoomScreenActions, RoomScreenModel } from './room-screen-model'
import { useRoomLayout, type RoomLayoutDiagnosticsMode } from './useRoomLayout'

export interface RoomScreenProps {
  model: RoomScreenModel
  actions: RoomScreenActions
  diagnosticsMode: RoomLayoutDiagnosticsMode
  identityConfirmation?: RoomIdentityConfirmationPresentation
  identityRecognition?: RoomIdentityRecognitionPresentation
  stageAccessory?: ReactNode
  tools: RoomUtilityTools & { onBackHome: () => void; seatChangeTargetID: PlayerID | null }
}

export function RoomScreen({ model, actions, diagnosticsMode, identityConfirmation, identityRecognition, stageAccessory, tools }: RoomScreenProps) {
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
  const phase = identityRecognition !== undefined
    ? RoomIdentityRecognitionPhaseContent({ presentation: identityRecognition })
    : identityConfirmation !== undefined
      ? RoomIdentityConfirmationPhaseContent({ presentation: identityConfirmation })
      : RoomPhasePanelContent({ actions, model: model.phase })
  const center = identityRecognition !== undefined
    ? <RoomIdentityRecognitionCenter presentation={identityRecognition} />
    : identityConfirmation?.state === 'waiting'
      ? <RoomIdentityConfirmationCenter presentation={identityConfirmation} />
      : <RoomCenterSummary model={model.center} />

  return (
    <div
      className="size-full"
      data-identity-confirmation-state={identityConfirmation?.state}
      data-identity-recognition-scene={identityRecognition?.scene.type}
      data-identity-recognition-state={identityRecognition?.state}
      data-room-mode={model.mode}
      data-room-screen="true"
    >
      <RoomLayout
        chrome={{
          back: <RoomBackButton onBack={tools.onBackHome} />,
          phase: phase.title,
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
                    layout={layout}
                    onActivate={() => actions.onActivatePlayer(player.playerID)}
                    player={identityRecognition === undefined
                      ? player
                      : applyLegacyRoomIdentityRecognitionSeat(identityRecognition, player)}
                  />
                )}
              />
            )}
            {identityRecognition !== undefined
              ? <RoomIdentityRecognitionStage presentation={identityRecognition} />
              : identityConfirmation !== undefined
                ? <RoomIdentityConfirmationStage presentation={identityConfirmation} />
                : model.stageOverlay.kind === 'identityRecognition' && <IdentityRecognitionLayer overlay={model.stageOverlay} />}
            {diagnosticsMode !== 'off' && <RoomLayoutDiagnostics mode={diagnosticsMode} playerCount={model.numPlayers} safeArea={safeArea} snapshot={snapshot} />}
          </>
        )}
        stageAccessory={stageAccessory}
        stageRef={stageRef}
      />
    </div>
  )
}
