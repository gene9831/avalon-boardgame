import type { RoomShellMetrics } from './room-shell-metrics'

export const ROOM_SHELL_CLASSES = {
  root: 'avalon-room-shell',
  topBar: 'avalon-room-shell__topbar',
  back: 'avalon-room-shell__back',
  roomStatus: 'avalon-room-shell__room-status',
  questProgress: 'avalon-room-shell__quest-progress',
  utilities: 'avalon-room-shell__utilities',
  stageRegion: 'avalon-room-shell__stage-region',
  stageContent: 'avalon-room-shell__stage-content',
  phasePanel: 'avalon-room-shell__phase-panel',
  phaseTitle: 'avalon-room-shell__phase-title',
  phaseTools: 'avalon-room-shell__phase-tools',
  phaseMiddle: 'avalon-room-shell__phase-middle',
  phaseAction: 'avalon-room-shell__phase-action',
  phaseClearance: 'avalon-room-shell__phase-clearance',
} as const

export type RoomShellStyleVariables = Readonly<
  Record<
    | '--room-topbar-height'
    | '--room-topbar-padding'
    | '--round-table-stage-margin'
    | '--task-rail-width'
    | '--phase-sidebar-width'
    | '--phase-header-height'
    | '--phase-middle-height'
    | '--phase-action-height',
    string
  >
>

export function getRoomShellStyleVariables(
  metrics: RoomShellMetrics,
): RoomShellStyleVariables {
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
