import type { RoomSessionStorage } from './room-session'

export const GAME_CLIENT_SETTINGS_KEY = 'avalon:game-client-settings'

export interface GameClientSettings {
  version: 1
  roleKnowledgeOpen: boolean
}

const DEFAULT_GAME_CLIENT_SETTINGS: GameClientSettings = {
  version: 1,
  roleKnowledgeOpen: false,
}

function browserStorage(): RoomSessionStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

function isGameClientSettings(value: unknown): value is GameClientSettings {
  if (typeof value !== 'object' || value === null) return false

  const settings = value as Partial<GameClientSettings>
  return settings.version === 1 && typeof settings.roleKnowledgeOpen === 'boolean'
}

export function loadGameClientSettings(
  storage: RoomSessionStorage | null = browserStorage(),
): GameClientSettings {
  if (storage === null) return DEFAULT_GAME_CLIENT_SETTINGS

  try {
    const rawSettings = storage.getItem(GAME_CLIENT_SETTINGS_KEY)
    if (rawSettings === null) return DEFAULT_GAME_CLIENT_SETTINGS

    const parsed: unknown = JSON.parse(rawSettings)
    return isGameClientSettings(parsed) ? parsed : DEFAULT_GAME_CLIENT_SETTINGS
  } catch {
    return DEFAULT_GAME_CLIENT_SETTINGS
  }
}

export function saveGameClientSettings(
  settings: Pick<GameClientSettings, 'roleKnowledgeOpen'>,
  storage: RoomSessionStorage | null = browserStorage(),
): GameClientSettings {
  const savedSettings: GameClientSettings = {
    version: 1,
    roleKnowledgeOpen: settings.roleKnowledgeOpen,
  }

  try {
    if (storage === null) return savedSettings
    storage.setItem(GAME_CLIENT_SETTINGS_KEY, JSON.stringify(savedSettings))
  } catch {
    // The in-memory preference remains usable when storage is unavailable.
  }

  return savedSettings
}
