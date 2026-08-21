import type { RoomSession } from './room-session'

type Fetcher = typeof fetch

export class RoomParticipationHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP status ${status}`)
    this.name = 'RoomParticipationHttpError'
    this.status = status
  }
}

export function getRoomExitErrorMessage(error: unknown, isHost: boolean) {
  if (error instanceof RoomParticipationHttpError && error.status === 409) {
    return isHost
      ? '游戏已经开始，无法解散房间。'
      : '游戏已经开始，无法退出房间。'
  }
  return isHost ? '解散失败，请重试。' : '退出失败，请重试。'
}

async function requestRoomExit(
  url: string,
  credentials: string,
  fetcher: Fetcher,
) {
  const response = await fetcher(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${credentials}` },
  })
  if ([204, 403, 404].includes(response.status)) return

  throw new RoomParticipationHttpError(response.status)
}

export async function leaveRoom(
  baseURL: string,
  session: Pick<RoomSession, 'matchID' | 'playerID' | 'credentials'>,
  fetcher: Fetcher = fetch,
) {
  await requestRoomExit(
    `${baseURL}/rooms/avalon/${encodeURIComponent(session.matchID)}/players/${encodeURIComponent(session.playerID)}`,
    session.credentials,
    fetcher,
  )
}

export async function dissolveRoom(
  baseURL: string,
  session: Pick<RoomSession, 'matchID' | 'credentials'>,
  fetcher: Fetcher = fetch,
) {
  await requestRoomExit(
    `${baseURL}/rooms/avalon/${encodeURIComponent(session.matchID)}`,
    session.credentials,
    fetcher,
  )
}
