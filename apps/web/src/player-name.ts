import type { RoomSessionStorage } from './room-session'

export const PLAYER_NAME_KEY = 'avalon:player-name'

function browserStorage(): RoomSessionStorage {
  if (typeof window === 'undefined') {
    throw new Error('Player name storage is only available in a browser')
  }

  return window.localStorage
}

function normalizePlayerName(value: string | null) {
  const trimmedValue = value?.trim() ?? ''
  return trimmedValue.length > 0 ? trimmedValue : null
}

export function loadPlayerName(
  storage: RoomSessionStorage = browserStorage(),
): string | null {
  try {
    return normalizePlayerName(storage.getItem(PLAYER_NAME_KEY))
  } catch {
    return null
  }
}

export function savePlayerName(
  playerName: string,
  storage: RoomSessionStorage = browserStorage(),
) {
  const trimmedName = playerName.trim()
  if (trimmedName.length === 0) {
    throw new Error('玩家名称不能为空。')
  }

  storage.setItem(PLAYER_NAME_KEY, trimmedName)
  return trimmedName
}

export function getPreferredPlayerName(
  storedName: string | null,
  fallbackName: string | null,
) {
  return normalizePlayerName(storedName) ?? normalizePlayerName(fallbackName)
}
