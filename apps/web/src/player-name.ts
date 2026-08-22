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

export function getPlayerNameValidationError(playerName: string) {
  const trimmedName = playerName.trim()
  if (trimmedName.length === 0) return '玩家名称不能为空'
  if (trimmedName.length > 24) return '玩家名称不能超过 24 个字符'
  return null
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
  const validationError = getPlayerNameValidationError(trimmedName)
  if (validationError !== null) throw new Error(validationError)

  storage.setItem(PLAYER_NAME_KEY, trimmedName)
  return trimmedName
}
