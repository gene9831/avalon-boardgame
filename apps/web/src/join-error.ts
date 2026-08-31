import {
  AVALON_LOBBY_ERROR_CODES,
  type AvalonLobbyErrorCode,
} from '@avalon/game'

export interface ClassifiedJoinError {
  message: string
  refreshRooms: boolean
}

const LOBBY_ERROR_COPY: Record<AvalonLobbyErrorCode, string> = {
  room_full: '房间已满。',
  room_not_joinable: '游戏已经开始。',
  room_not_found: '房间不存在或已解散。',
  client_already_joined: '本浏览器已经加入该房间。',
  seat_unavailable: '该空座刚刚被其他玩家占用。',
  invalid_seat_session: '当前座位会话已失效。',
  not_room_owner: '只有房间拥有者可以执行此操作。',
  owner_must_dissolve: '房间拥有者退出时需要解散房间。',
}

const ROOM_REFRESH_ERROR_CODES = new Set<AvalonLobbyErrorCode>([
  'room_full',
  'room_not_joinable',
  'room_not_found',
  'client_already_joined',
  'seat_unavailable',
])

function errorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('details' in error)) return null
  const details = (error as { details?: unknown }).details
  if (typeof details !== 'object' || details === null || !('error' in details)) return null
  const bodyError = (details as { error?: unknown }).error
  if (typeof bodyError !== 'object' || bodyError === null || !('code' in bodyError)) return null
  const code = (bodyError as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function isAvalonLobbyErrorCode(code: string): code is AvalonLobbyErrorCode {
  return AVALON_LOBBY_ERROR_CODES.includes(code as AvalonLobbyErrorCode)
}

export function getLobbyErrorMessage(code: AvalonLobbyErrorCode) {
  return LOBBY_ERROR_COPY[code]
}

export function classifyJoinError(error: unknown): ClassifiedJoinError {
  const code = errorCode(error)

  if (code !== null && isAvalonLobbyErrorCode(code)) {
    return {
      message: getLobbyErrorMessage(code),
      refreshRooms: ROOM_REFRESH_ERROR_CODES.has(code),
    }
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      message: '网络连接异常，请稍后重试。',
      refreshRooms: false,
    }
  }

  return {
    message: '暂时无法加入房间，请稍后重试。',
    refreshRooms: false,
  }
}
