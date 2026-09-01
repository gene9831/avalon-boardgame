import { DEFAULT_ROLE_CONFIGURATION, type AvalonRoleConfiguration } from '@avalon/game'

import type { RoomSessionStorage } from './room-session'

const CREATE_PLAYER_COUNT_KEY = 'avalon:create-player-count'
const CREATE_ROLE_CONFIGURATION_KEY = 'avalon:create-role-configuration'
const SUPPORTED_PLAYER_COUNTS = new Set([5, 6, 7, 8, 9, 10])

function browserStorage(): RoomSessionStorage {
  if (typeof window === 'undefined') {
    throw new Error('Create game preferences are only available in a browser')
  }
  return window.localStorage
}

export function loadPreferredPlayerCount(
  storage: RoomSessionStorage = browserStorage(),
) {
  try {
    const value = Number(storage.getItem(CREATE_PLAYER_COUNT_KEY))
    return SUPPORTED_PLAYER_COUNTS.has(value) ? value : 5
  } catch {
    return 5
  }
}

export function savePreferredPlayerCount(
  numPlayers: number,
  storage: RoomSessionStorage = browserStorage(),
) {
  if (!SUPPORTED_PLAYER_COUNTS.has(numPlayers)) {
    throw new Error('Avalon player count must be between 5 and 10')
  }
  storage.setItem(CREATE_PLAYER_COUNT_KEY, String(numPlayers))
  return numPlayers
}

export function loadPreferredRoleConfiguration(
  storage: RoomSessionStorage = browserStorage(),
): AvalonRoleConfiguration {
  try {
    const value: unknown = JSON.parse(storage.getItem(CREATE_ROLE_CONFIGURATION_KEY) ?? '')
    if (typeof value === 'object' && value !== null && typeof (value as { percivalMorgana?: unknown }).percivalMorgana === 'boolean') {
      return { percivalMorgana: (value as { percivalMorgana: boolean }).percivalMorgana }
    }
  } catch {
    // Use the current new-room default for missing or malformed local preference.
  }
  return { ...DEFAULT_ROLE_CONFIGURATION }
}

export function savePreferredRoleConfiguration(
  roleConfiguration: AvalonRoleConfiguration,
  storage: RoomSessionStorage = browserStorage(),
) {
  const next = { percivalMorgana: roleConfiguration.percivalMorgana }
  storage.setItem(CREATE_ROLE_CONFIGURATION_KEY, JSON.stringify(next))
  return next
}
