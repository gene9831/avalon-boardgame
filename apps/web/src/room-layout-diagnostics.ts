import type { RoomLayoutDiagnosticsMode } from './useRoomLayout'

export type RoomSafeAreaInsets = Readonly<{ top: number; right: number; bottom: number; left: number }>

export function resolveRoomLayoutDiagnosticsMode(search: string, isDevelopment: boolean): RoomLayoutDiagnosticsMode {
  if (!isDevelopment) return 'off'
  const value = new URLSearchParams(search).get('layoutDebug')
  if (value === 'geometry') return 'geometry'
  if (value === '1' || value === 'metrics') return 'metrics'
  return 'off'
}

export function setRoomLayoutDiagnosticsMode(url: URL, mode: RoomLayoutDiagnosticsMode): URL {
  const next = new URL(url)
  if (mode === 'off') next.searchParams.delete('layoutDebug')
  else next.searchParams.set('layoutDebug', mode === 'metrics' ? '1' : 'geometry')
  return next
}

function cssPixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function readRoomSafeAreaInsets(
  root: HTMLElement,
  readStyles: (element: Element) => CSSStyleDeclaration = getComputedStyle,
): RoomSafeAreaInsets {
  const styles = readStyles(root)
  return {
    top: cssPixels(styles.getPropertyValue('--room-layout-safe-top')),
    right: cssPixels(styles.getPropertyValue('--room-layout-safe-right')),
    bottom: cssPixels(styles.getPropertyValue('--room-layout-safe-bottom')),
    left: cssPixels(styles.getPropertyValue('--room-layout-safe-left')),
  }
}
