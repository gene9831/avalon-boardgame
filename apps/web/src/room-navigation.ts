export function getRoomNavigationNotice(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null

  const notice = (state as { roomNotice?: unknown }).roomNotice
  return typeof notice === 'string' && notice.length > 0 ? notice : null
}

export function consumeRoomNavigationNotice(state: unknown): unknown {
  if (typeof state !== 'object' || state === null) return state
  if (!('roomNotice' in state)) return state

  const nextState = { ...(state as Record<string, unknown>) }
  delete nextState.roomNotice
  return nextState
}

export function isRoomRouteGenerationCurrent(
  currentGeneration: number,
  expectedGeneration: number,
) {
  return currentGeneration === expectedGeneration
}
