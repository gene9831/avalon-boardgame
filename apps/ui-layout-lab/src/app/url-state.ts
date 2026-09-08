export type ViewportMode = 'device' | 'simulated'

export type LabState = Readonly<{
  viewportMode: ViewportMode
  simulatedWidth: number
  simulatedHeight: number
  playerCount: number
  showGeometry: boolean
}>

export const DEFAULT_LAB_STATE: LabState = {
  viewportMode: 'simulated',
  simulatedWidth: 390,
  simulatedHeight: 844,
  playerCount: 10,
  showGeometry: false,
}

function finitePositiveInteger(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') return fallback
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
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
    ),
    simulatedHeight: finitePositiveInteger(
      parameters.get('height'),
      DEFAULT_LAB_STATE.simulatedHeight,
    ),
    playerCount: requestedPlayerCount >= 5 && requestedPlayerCount <= 10
      ? requestedPlayerCount
      : DEFAULT_LAB_STATE.playerCount,
    showGeometry: parameters.get('geometry') === '1',
  }
}

export function serializeLabState(state: LabState): string {
  const parameters = new URLSearchParams({
    viewport: state.viewportMode,
    width: String(state.simulatedWidth),
    height: String(state.simulatedHeight),
    players: String(state.playerCount),
    geometry: state.showGeometry ? '1' : '0',
  })
  return `?${parameters.toString()}`
}

export function replaceLabStateInUrl(state: LabState): void {
  window.history.replaceState(null, '', `${window.location.pathname}${serializeLabState(state)}`)
}
