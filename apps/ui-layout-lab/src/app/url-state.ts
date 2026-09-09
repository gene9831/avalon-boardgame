import {
  MAX_SIMULATED_VIEWPORT_HEIGHT,
  MAX_SIMULATED_VIEWPORT_WIDTH,
} from '../stage-dimensions'

export type ViewportMode = 'device' | 'simulated'

export type LabState = Readonly<{
  viewportMode: ViewportMode
  simulatedWidth: number
  simulatedHeight: number
  playerCount: number
  gap: number
  maxAvatarSize: number
  avatarSizeStep: number
  showGeometry: boolean
}>

export const DEFAULT_LAB_STATE: LabState = {
  viewportMode: 'simulated',
  simulatedWidth: 390,
  simulatedHeight: 844,
  playerCount: 10,
  gap: 8,
  maxAvatarSize: 56,
  avatarSizeStep: 8,
  showGeometry: false,
}

function finitePositiveInteger(
  value: string | null,
  fallback: number,
  maximum = Number.POSITIVE_INFINITY,
): number {
  if (value === null || value.trim() === '') return fallback
  const number = Number(value)
  return Number.isInteger(number) && number > 0 && number <= maximum
    ? number
    : fallback
}

function finiteNonNegativeNumber(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

export function parseLabState(search: string): LabState {
  const parameters = new URLSearchParams(search)
  const requestedPlayerCount = finitePositiveInteger(
    parameters.get('players'),
    DEFAULT_LAB_STATE.playerCount,
  )
  return {
    viewportMode: parameters.get('viewport') === 'device' ? 'device' : 'simulated',
    simulatedWidth: finitePositiveInteger(
      parameters.get('width'),
      DEFAULT_LAB_STATE.simulatedWidth,
      MAX_SIMULATED_VIEWPORT_WIDTH,
    ),
    simulatedHeight: finitePositiveInteger(
      parameters.get('height'),
      DEFAULT_LAB_STATE.simulatedHeight,
      MAX_SIMULATED_VIEWPORT_HEIGHT,
    ),
    playerCount: requestedPlayerCount >= 5 && requestedPlayerCount <= 10
      ? requestedPlayerCount
      : DEFAULT_LAB_STATE.playerCount,
    gap: finiteNonNegativeNumber(parameters.get('gap'), DEFAULT_LAB_STATE.gap),
    maxAvatarSize: finiteNonNegativeNumber(
      parameters.get('maxAvatarSize'),
      DEFAULT_LAB_STATE.maxAvatarSize,
    ),
    avatarSizeStep: finiteNonNegativeNumber(
      parameters.get('avatarSizeStep'),
      DEFAULT_LAB_STATE.avatarSizeStep,
    ),
    showGeometry: parameters.get('geometry') === '1',
  }
}

export function serializeLabState(state: LabState): string {
  const parameters = new URLSearchParams({
    viewport: state.viewportMode,
    width: String(state.simulatedWidth),
    height: String(state.simulatedHeight),
    players: String(state.playerCount),
    gap: String(state.gap),
    maxAvatarSize: String(state.maxAvatarSize),
    avatarSizeStep: String(state.avatarSizeStep),
    geometry: state.showGeometry ? '1' : '0',
  })
  return `?${parameters.toString()}`
}

export function replaceLabStateInUrl(state: LabState): void {
  window.history.replaceState(null, '', `${window.location.pathname}${serializeLabState(state)}`)
}
