import type { ViewportSize } from './viewport-adapter'

export type PreviewRoomShell = Readonly<{
  topBarHeight: number
  topBarPadding: number
  stageMargin: number
  phaseHeaderHeight: 48
  phaseMiddleHeight: 56
  phaseActionHeight: 56
}>

export function resolvePreviewRoomShell(size: ViewportSize): PreviewRoomShell {
  const usesCompactTopChrome = size.height < 800
  return {
    topBarHeight: usesCompactTopChrome ? 48 : 56,
    topBarPadding: usesCompactTopChrome ? 8 : 12,
    stageMargin: usesCompactTopChrome ? 8 : 12,
    phaseHeaderHeight: 48,
    phaseMiddleHeight: 56,
    phaseActionHeight: 56,
  }
}

export function applyPreviewRoomShell(
  canvas: HTMLElement,
  shell: PreviewRoomShell,
): void {
  canvas.style.setProperty('--room-topbar-height', `${shell.topBarHeight}px`)
  canvas.style.setProperty('--room-topbar-padding', `${shell.topBarPadding}px`)
  canvas.style.setProperty('--round-table-stage-margin', `${shell.stageMargin}px`)
  canvas.style.setProperty('--phase-header-height', `${shell.phaseHeaderHeight}px`)
  canvas.style.setProperty('--phase-middle-height', `${shell.phaseMiddleHeight}px`)
  canvas.style.setProperty('--phase-action-height', `${shell.phaseActionHeight}px`)
}
