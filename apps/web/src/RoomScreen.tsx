import type { CSSProperties, ReactNode } from 'react'
import {
  getRoomShellStyleVariables,
  ROOM_SHELL_CLASSES,
} from '@avalon/ui-layout'

import type { RoomScreenMode } from './room-screen-model'
import {
  useRoomLayout,
  type RoomLayoutDiagnosticsMode,
  type RoomLayoutSnapshot,
} from './useRoomLayout'

export interface RoomScreenProps {
  mode: RoomScreenMode
  playerCount: number | null
  diagnosticsMode: RoomLayoutDiagnosticsMode
  back: ReactNode
  roomStatus: ReactNode
  questProgress: ReactNode
  utilities: ReactNode
  stage: (snapshot: RoomLayoutSnapshot) => ReactNode
  phaseTitle: ReactNode
  phaseTools: ReactNode
  phaseMiddle: ReactNode
  phaseAction: ReactNode
}

export function RoomScreen({
  mode,
  playerCount,
  diagnosticsMode,
  back,
  roomStatus,
  questProgress,
  utilities,
  stage,
  phaseTitle,
  phaseTools,
  phaseMiddle,
  phaseAction,
}: RoomScreenProps) {
  const { canvasRef, stageRef, snapshot } = useRoomLayout(
    playerCount,
    diagnosticsMode,
  )

  return (
    <section
      className={ROOM_SHELL_CLASSES.root}
      data-room-layout-mode={snapshot.shellMetrics?.mode ?? 'measuring'}
      data-room-mode={mode}
      data-room-screen="true"
      ref={canvasRef}
      style={snapshot.shellMetrics
        ? getRoomShellStyleVariables(snapshot.shellMetrics) as CSSProperties
        : undefined}
    >
      <header className={ROOM_SHELL_CLASSES.topBar}>
        <div className={ROOM_SHELL_CLASSES.back}>{back}</div>
        <div className={ROOM_SHELL_CLASSES.roomStatus}>{roomStatus}</div>
        <div className={ROOM_SHELL_CLASSES.questProgress}>{questProgress}</div>
        <div className={ROOM_SHELL_CLASSES.utilities}>{utilities}</div>
      </header>
      <main className={ROOM_SHELL_CLASSES.stageRegion} data-room-slot="stage">
        <div className={ROOM_SHELL_CLASSES.stageContent} ref={stageRef}>
          {stage(snapshot)}
        </div>
      </main>
      <footer className={ROOM_SHELL_CLASSES.phasePanel}>
        <div className={ROOM_SHELL_CLASSES.phaseTitle}>{phaseTitle}</div>
        <div className={ROOM_SHELL_CLASSES.phaseTools}>{phaseTools}</div>
        <div className={ROOM_SHELL_CLASSES.phaseMiddle} data-room-slot="phase-middle">
          {phaseMiddle}
        </div>
        <div className={ROOM_SHELL_CLASSES.phaseAction} data-room-slot="phase-action">
          {phaseAction}
        </div>
        <div aria-hidden="true" className={ROOM_SHELL_CLASSES.phaseClearance} />
      </footer>
    </section>
  )
}
