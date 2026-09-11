import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft } from 'lucide-react'
import { getRoomShellStyleVariables, ROOM_SHELL_CLASSES } from '@avalon/ui-layout'

import { IdentityRecognitionLayer } from './IdentityRecognitionLayer'
import { QuestProgressTrack } from './QuestProgressTrack'
import { RoomCenterSummary } from './RoomCenterSummary'
import { RoomLayoutDiagnostics } from './RoomLayoutDiagnostics'
import { RoomPhasePanelContent } from './RoomPhasePanelContent'
import { RoomPlayerSeat } from './RoomPlayerSeat'
import { RoomStage } from './RoomStage'
import { RoomUtilities, type RoomUtilityTools } from './RoomUtilities'
import { readRoomSafeAreaInsets, type RoomSafeAreaInsets } from './room-layout-diagnostics'
import { formatRoomID } from './room-id'
import type { RoomScreenActions, RoomScreenModel } from './room-screen-model'
import { useRoomLayout, type RoomLayoutDiagnosticsMode } from './useRoomLayout'

export interface RoomScreenProps {
  model: RoomScreenModel
  actions: RoomScreenActions
  diagnosticsMode: RoomLayoutDiagnosticsMode
  tools: RoomUtilityTools & { onBackHome: () => void }
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
    <section
      className={ROOM_SHELL_CLASSES.root}
      data-room-layout-mode={snapshot.shellMetrics?.mode ?? 'measuring'}
      data-room-mode={model.mode}
      data-room-screen="true"
      ref={setCanvasRef}
      style={snapshot.shellMetrics ? getRoomShellStyleVariables(snapshot.shellMetrics) as CSSProperties : undefined}
    >
      <header className={ROOM_SHELL_CLASSES.topBar}>
        <div className={ROOM_SHELL_CLASSES.back}><button aria-label="返回主页" className="room-utility-button" onClick={tools.onBackHome} type="button"><ChevronLeft aria-hidden="true" /></button></div>
        <div className={ROOM_SHELL_CLASSES.roomStatus}><h1 className="truncate text-sm font-semibold text-white">房间 {formatRoomID(model.matchID)}</h1></div>
        <div className={ROOM_SHELL_CLASSES.questProgress}><QuestProgressTrack nodes={model.questProgress} /></div>
        <div className={ROOM_SHELL_CLASSES.utilities}><RoomUtilities model={model.utilities} tools={tools} /></div>
      </header>
      <main className={ROOM_SHELL_CLASSES.stageRegion} data-room-slot="stage">
        <div
          className={ROOM_SHELL_CLASSES.stageContent}
          data-stage-layout-height={snapshot.stageSize?.height}
          data-stage-layout-width={snapshot.stageSize?.width}
          ref={stageRef}
        >
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
                  disabled={isPlayerDisabled(model, player.playerID, tools.seatChangePending)}
                  interactionMode={model.playerInteractionMode}
                  layout={layout}
                  onActivate={actions.onActivatePlayer}
                  player={player}
                />
              )}
            />
          )}
          {model.stageOverlay.kind === 'identityRecognition' && <IdentityRecognitionLayer overlay={model.stageOverlay} />}
          {diagnosticsMode !== 'off' && <RoomLayoutDiagnostics mode={diagnosticsMode} playerCount={model.numPlayers} safeArea={safeArea} snapshot={snapshot} />}
        </div>
      </main>
      <footer className={ROOM_SHELL_CLASSES.phasePanel}>
        <div className={ROOM_SHELL_CLASSES.phaseTitle}>{phase.title}</div>
        <div className={ROOM_SHELL_CLASSES.phaseTools} />
        <div className={ROOM_SHELL_CLASSES.phaseMiddle} data-room-slot="phase-middle">{phase.middle}</div>
        <div className={ROOM_SHELL_CLASSES.phaseAction} data-room-slot="phase-action">{phase.action}</div>
        <div aria-hidden="true" className={ROOM_SHELL_CLASSES.phaseClearance} />
      </footer>
    </section>
  )
}

function isPlayerDisabled(model: RoomScreenModel, playerID: string, seatChangePending: boolean): boolean {
  if (model.playerInteractionMode === 'none') return true
  const player = model.players.find((candidate) => candidate.playerID === playerID)
  if (player === undefined) return true
  if (model.playerInteractionMode === 'changeSeat') return player.occupied || seatChangePending
  if (model.playerInteractionMode === 'selectAssassinationTarget') {
    return player.isCurrentPlayer || player.knownEvil
  }
  return !player.occupied
}
