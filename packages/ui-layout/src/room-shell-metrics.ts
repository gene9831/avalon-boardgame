const clamp = (minimum: number, value: number, maximum: number): number =>
  Math.min(Math.max(minimum, value), maximum)

export type RoomCanvasSize = Readonly<{
  width: number
  height: number
}>

export type RoomShellMode =
  | 'vertical'
  | 'compact-landscape'
  | 'normal-landscape'

export type RoomShellMetrics = Readonly<{
  mode: RoomShellMode
  topBarHeight: number
  topBarPadding: number
  stageMargin: number
  taskRailWidth: number
  sidebarWidth: number
  phaseHeaderHeight: 48
  phaseMiddleHeight: 56
  phaseActionHeight: 56
}>

export function resolveRoomShellMetrics(size: RoomCanvasSize): RoomShellMetrics {
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

  if (size.height < 515) {
    return {
      mode: 'compact-landscape',
      topBarHeight: 0,
      topBarPadding: 0,
      stageMargin: 8,
      taskRailWidth: 56,
      sidebarWidth: size.width < 720
        ? 192
        : Math.round(clamp(224, size.width * 0.28, 288)),
      phaseHeaderHeight: 48,
      phaseMiddleHeight: 56,
      phaseActionHeight: 56,
    }
  }

  return {
    mode: 'normal-landscape',
    topBarHeight: size.height < 680 ? 48 : 56,
    topBarPadding: size.height < 680 ? 8 : 12,
    stageMargin: size.height < 680 ? 12 : 16,
    taskRailWidth: 0,
    sidebarWidth: Math.round(clamp(288, size.width * 0.28, 384)),
    phaseHeaderHeight: 48,
    phaseMiddleHeight: 56,
    phaseActionHeight: 56,
  }
}
