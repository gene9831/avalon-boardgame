import type { RoomShellMetrics } from '@avalon/ui-layout'

export function applyPreviewRoomShell(
  canvas: HTMLElement,
  shell: RoomShellMetrics,
): void {
  canvas.dataset.roomLayoutMode = shell.mode
  canvas.style.setProperty('--room-topbar-height', `${shell.topBarHeight}px`)
  canvas.style.setProperty('--phase-sidebar-width', `${shell.sidebarWidth}px`)
  canvas.style.setProperty('--task-rail-width', `${shell.taskRailWidth}px`)
  canvas.style.setProperty('--room-topbar-padding', `${shell.topBarPadding}px`)
  canvas.style.setProperty('--round-table-stage-margin', `${shell.stageMargin}px`)
  canvas.style.setProperty('--phase-header-height', `${shell.phaseHeaderHeight}px`)
  canvas.style.setProperty('--phase-middle-height', `${shell.phaseMiddleHeight}px`)
  canvas.style.setProperty('--phase-action-height', `${shell.phaseActionHeight}px`)
}
