import type { CSSProperties, ReactNode, RefCallback } from 'react'
import type { RoomShellMetrics, RoomShellMode } from '@avalon/ui-layout'

interface RoomGameShellProps {
  backAction: ReactNode
  canvasRef: RefCallback<HTMLElement>
  layoutMetrics: RoomShellMetrics | null
  phaseAction: ReactNode
  phaseMiddle: ReactNode
  phaseTitle: ReactNode
  phaseTools: ReactNode
  questProgress: ReactNode
  roomStatus: ReactNode
  stage: ReactNode
  stageRef: RefCallback<HTMLDivElement>
  utilityActions: ReactNode
}

type ShellStyle = CSSProperties & Record<`--${string}`, string>

function shellStyle(metrics: RoomShellMetrics | null): ShellStyle | undefined {
  if (metrics === null) return undefined

  return {
    '--room-topbar-height': `${metrics.topBarHeight}px`,
    '--room-topbar-padding': `${metrics.topBarPadding}px`,
    '--round-table-stage-margin': `${metrics.stageMargin}px`,
    '--task-rail-width': `${metrics.taskRailWidth}px`,
    '--phase-sidebar-width': `${metrics.sidebarWidth}px`,
    '--phase-header-height': `${metrics.phaseHeaderHeight}px`,
    '--phase-middle-height': `${metrics.phaseMiddleHeight}px`,
    '--phase-action-height': `${metrics.phaseActionHeight}px`,
  }
}

export function RoomGameShell({
  backAction,
  canvasRef,
  layoutMetrics,
  phaseAction,
  phaseMiddle,
  phaseTitle,
  phaseTools,
  questProgress,
  roomStatus,
  stage,
  stageRef,
  utilityActions,
}: RoomGameShellProps) {
  const layoutMode: RoomShellMode | 'measuring' = layoutMetrics?.mode ?? 'measuring'

  return (
    <section
      aria-label="阿瓦隆游戏圆桌"
      className="room-game-shell"
      data-room-game-shell="true"
      data-room-layout-mode={layoutMode}
      ref={canvasRef}
      style={shellStyle(layoutMetrics)}
    >
      <header className="room-game-topbar">
        <div className="room-game-back">{backAction}</div>
        <div className="room-game-status">{roomStatus}</div>
        <div className="room-game-quest-progress">{questProgress}</div>
        <div className="room-game-utilities">{utilityActions}</div>
      </header>

      <div className="room-game-stage-region" data-room-game-slot="stage">
        <div className="room-game-stage-content" ref={stageRef}>
          {stage}
        </div>
      </div>

      <footer className="room-game-phase-panel">
        <div className="room-game-phase-title">{phaseTitle}</div>
        <div className="room-game-phase-tools">{phaseTools}</div>
        <div className="room-game-phase-middle" data-room-game-slot="phase-middle">
          {phaseMiddle}
        </div>
        <div className="room-game-phase-action" data-room-game-slot="phase-action">
          {phaseAction}
        </div>
        <div aria-hidden="true" className="room-game-phase-clearance" />
      </footer>
    </section>
  )
}
