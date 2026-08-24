import {
  isPlayerAvatarID,
  PLAYER_AVATAR_IDS,
} from './player-profile'

export function getSeatAvatarID(data: unknown, seatIndex: number) {
  if (typeof data === 'object' && data !== null) {
    const avatarID = (data as Record<string, unknown>).avatarID
    if (isPlayerAvatarID(avatarID)) return avatarID
  }

  const normalizedSeatIndex = Math.abs(Math.trunc(seatIndex))
  return PLAYER_AVATAR_IDS[normalizedSeatIndex % PLAYER_AVATAR_IDS.length]
}
