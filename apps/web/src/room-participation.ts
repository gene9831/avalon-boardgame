import type { AvalonRoomSessionResponse } from '@avalon/game'

import {
  beginSeatTransition,
  completeSeatTransition,
  type RoomSession,
  type RoomSessionStorage,
} from './room-session'

type Fetcher = typeof fetch

export class RoomParticipationHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP status ${status}`)
    this.name = 'RoomParticipationHttpError'
    this.status = status
  }
}

export interface RoomParticipationClient {
  changeSeat: (
    matchID: string,
    sourcePlayerID: string,
    credentials: string,
    targetPlayerID: string,
  ) => Promise<AvalonRoomSessionResponse>
  prepareStart: (
    matchID: string,
    playerID: string,
    credentials: string,
  ) => Promise<void>
}

export function getRoomExitErrorMessage(error: unknown, isHost: boolean) {
  if (error instanceof RoomParticipationHttpError && error.status === 409) {
    return isHost
      ? '对局已经开始，无法解散房间。'
      : '对局已经开始，无法退出房间。'
  }
  return isHost ? '解散房间失败，请重试。' : '退出房间失败，请重试。'
}

export async function changeRoomSeat(
  client: RoomParticipationClient,
  source: RoomSession,
  targetPlayerID: string,
  storage?: RoomSessionStorage,
) {
  beginSeatTransition(source, targetPlayerID, storage)
  const response = await client.changeSeat(
    source.matchID,
    source.playerID,
    source.credentials,
    targetPlayerID,
  )
  return completeSeatTransition(source, response, storage)
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
