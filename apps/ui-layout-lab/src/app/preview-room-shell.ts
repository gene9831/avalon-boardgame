import {
  getRoomShellStyleVariables,
  ROOM_SHELL_CLASSES,
  type RoomShellMetrics,
} from '@avalon/ui-layout'

export function applyPreviewRoomShell(
  canvas: HTMLElement,
  metrics: RoomShellMetrics,
): void {
  canvas.classList.add(ROOM_SHELL_CLASSES.root)
  canvas.dataset.roomLayoutMode = metrics.mode
  for (const [property, value] of Object.entries(
    getRoomShellStyleVariables(metrics),
  )) {
    canvas.style.setProperty(property, value)
  }
}
