import type { ViewportSize } from './viewport-adapter'

const clamp = (min: number, value: number, max: number): number =>
  Math.min(Math.max(min, value), max)

export type PreviewRoomShellMode =
  | 'vertical'
  | 'compact-landscape'
  | 'normal-landscape'

export type PreviewRoomShell = Readonly<{
  mode: PreviewRoomShellMode
  topBarHeight: number
  topBarPadding: number
  stageMargin: number
  taskRailWidth: number
  sidebarWidth: number
  phaseHeaderHeight: 48
  phaseMiddleHeight: 56
  phaseActionHeight: 56
}>

export function resolvePreviewRoomShell(size: ViewportSize): PreviewRoomShell {
  if (size.width <= size.height) {
    const usesCompactTopChrome = size.height < 800
    return {
      mode: 'vertical',
      topBarHeight: usesCompactTopChrome ? 48 : 56,
      topBarPadding: usesCompactTopChrome ? 8 : 12,
      stageMargin: usesCompactTopChrome ? 8 : 12,
      taskRailWidth: 0,
      sidebarWidth: 0,
      phaseHeaderHeight: 48,
      phaseMiddleHeight: 56,
      phaseActionHeight: 56,
    }
  }

  const isCompactLandscape = size.height < 515
  if (isCompactLandscape) {
    const sidebarWidth =
      size.width < 720
        ? 192
        : Math.round(
            clamp(224, size.width * 0.28, 288),
          )

    return {
      mode: 'compact-landscape',
      topBarHeight: 0,
      topBarPadding: 0,
      stageMargin: 8,
      taskRailWidth: 56,
      sidebarWidth,
      phaseHeaderHeight: 48,
      phaseMiddleHeight: 56,
      phaseActionHeight: 56,
    }
  }

  const sidebarWidth = Math.round(
    clamp(288, size.width * 0.28, 384),
  )

  return {
    mode: 'normal-landscape',
    topBarHeight: size.height < 680 ? 48 : 56,
    topBarPadding: size.height < 680 ? 8 : 12,
    stageMargin: size.height < 680 ? 12 : 16,
    taskRailWidth: 0,
    sidebarWidth,
    phaseHeaderHeight: 48,
    phaseMiddleHeight: 56,
    phaseActionHeight: 56,
  }
}

export function applyPreviewRoomShell(
  canvas: HTMLElement,
  shell: PreviewRoomShell,
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
