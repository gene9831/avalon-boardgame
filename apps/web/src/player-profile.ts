import {
  AVALON_PLAYER_AVATAR_IDS,
  AvalonPlayerAvatarIDSchema,
  type AvalonPlayerAvatarID,
} from '@avalon/game'

import { getPlayerNameValidationError, loadPlayerName, PLAYER_NAME_KEY } from './player-name'
import type { RoomSessionStorage } from './room-session'

export const PLAYER_PROFILE_KEY = 'avalon:player-profile'

export const PLAYER_AVATAR_IDS = AVALON_PLAYER_AVATAR_IDS

export type PlayerAvatarID = AvalonPlayerAvatarID

export interface PlayerProfile {
  avatarID: PlayerAvatarID
  name: string
}

const NAME_PREFIXES = [
  '银月',
  '雾林',
  '晨星',
  '赤羽',
  '青岚',
  '暮色',
  '白鹿',
  '暮鸦',
  '荆棘',
  '霜塔',
  '赤狐',
  '灰狼',
  '月桂',
  '橡木',
  '黑羽',
  '银烛',
  '金狮',
  '雪松',
  '苍鹰',
  '深谷',
  '长夜',
  '曙光',
  '铁冠',
  '星辉',
] as const
const NAME_SUFFIXES = [
  '骑士',
  '旅人',
  '守望者',
  '游侠',
  '贤者',
  '信使',
  '侍从',
  '守卫',
  '猎手',
  '铸剑师',
  '吟游诗人',
  '守塔人',
  '巡林客',
  '旅法师',
  '旗手',
  '弓手',
  '驯鹰人',
  '药草师',
  '抄写员',
  '护林人',
  '修士',
  '占星师',
  '盾卫',
  '领航者',
] as const

function browserStorage(): RoomSessionStorage {
  if (typeof window === 'undefined') {
    throw new Error('Player profile storage is only available in a browser')
  }

  return window.localStorage
}

export function isPlayerAvatarID(value: unknown): value is PlayerAvatarID {
  return AvalonPlayerAvatarIDSchema.safeParse(value).success
}

function isPlayerProfile(value: unknown): value is PlayerProfile {
  if (typeof value !== 'object' || value === null) return false

  const profile = value as Partial<PlayerProfile>
  return typeof profile.name === 'string' &&
    getPlayerNameValidationError(profile.name) === null &&
    isPlayerAvatarID(profile.avatarID)
}

function randomItem<T>(items: readonly T[], random: () => number) {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]
}

export function createRandomPlayerProfile(
  random: () => number = Math.random,
  preferredName?: string | null,
): PlayerProfile {
  return {
    avatarID: randomItem(PLAYER_AVATAR_IDS, random),
    name: preferredName ?? `${randomItem(NAME_PREFIXES, random)}${randomItem(NAME_SUFFIXES, random)}`,
  }
}

export function savePlayerProfile(
  profile: PlayerProfile,
  storage: RoomSessionStorage = browserStorage(),
) {
  const name = profile.name.trim()
  const validationError = getPlayerNameValidationError(name)
  if (validationError !== null) throw new Error(validationError)
  if (!isPlayerAvatarID(profile.avatarID)) throw new Error('请选择有效头像')

  const savedProfile: PlayerProfile = { avatarID: profile.avatarID, name }
  storage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(savedProfile))
  storage.removeItem(PLAYER_NAME_KEY)
  return savedProfile
}

export function loadOrCreatePlayerProfile(
  storage: RoomSessionStorage = browserStorage(),
  random: () => number = Math.random,
): PlayerProfile {
  try {
    const rawProfile = storage.getItem(PLAYER_PROFILE_KEY)
    if (rawProfile !== null) {
      const parsed: unknown = JSON.parse(rawProfile)
      if (isPlayerProfile(parsed)) return parsed
    }
  } catch {
    // Replace malformed or inaccessible profile storage with a safe local default.
  }

  const profile = createRandomPlayerProfile(random, loadPlayerName(storage))
  try {
    return savePlayerProfile(profile, storage)
  } catch {
    return profile
  }
}
