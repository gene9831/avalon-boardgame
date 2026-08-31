import {
  AVALON_LOBBY_ERROR_CODES,
  type AvalonLobbyErrorCode,
  type AvalonRoomSessionResponse,
} from '@avalon/game'

import {
  beginSeatTransition,
  clearRoomSessionIfCurrent,
  clearSeatTransitionIfCurrent,
  completeSeatTransition,
  loadRoomSession,
  loadSeatTransition,
  markSeatTransitionUncertain,
  recoverSeatTransition,
  renewSeatTransitionLease,
  SEAT_TRANSITION_LEASE_MS,
  type RoomSession,
  type RoomSessionStorage,
  type ValidateSeat,
} from './room-session'
import { getLobbyErrorMessage } from './join-error'

type Fetcher = typeof fetch

export class RoomParticipationHttpError extends Error {
  readonly code: AvalonLobbyErrorCode | null
  readonly status: number

  constructor(status: number, code: AvalonLobbyErrorCode | null = null) {
    super(`HTTP status ${status}`)
    this.name = 'RoomParticipationHttpError'
    this.code = code
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

export interface RoomExitResult {
  status: 204 | 403 | 404
}

export type RoomExitResolution =
  | { status: 'completed' }
  | { status: 'rebind', session: RoomSession }
  | { status: 'session-retained' }
  | { status: 'transition-pending' }

export function createRoomParticipationClient(
  baseURL: string,
  fetcher: Fetcher = fetch,
): RoomParticipationClient {
  const request = async (url: string, credentials: string, body?: unknown) => {
    const response = await fetcher(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined)
      const code = typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error?: { code?: unknown } }).error?.code
        : undefined
      throw new RoomParticipationHttpError(
        response.status,
        typeof code === 'string' && AVALON_LOBBY_ERROR_CODES.includes(code as AvalonLobbyErrorCode)
          ? code as AvalonLobbyErrorCode
          : null,
      )
    }
    return response
  }

  return {
    async changeSeat(matchID, sourcePlayerID, credentials, targetPlayerID) {
      const response = await request(
        `${baseURL}/rooms/avalon/${encodeURIComponent(matchID)}/players/${encodeURIComponent(sourcePlayerID)}/seat`,
        credentials,
        { targetPlayerID },
      )
      return response.json() as Promise<AvalonRoomSessionResponse>
    },
    async prepareStart(matchID, playerID, credentials) {
      await request(
        `${baseURL}/rooms/avalon/${encodeURIComponent(matchID)}/players/${encodeURIComponent(playerID)}/prepare-start`,
        credentials,
      )
    },
  }
}

export function getSeatChangeErrorMessage(error: unknown) {
  if (error instanceof RoomParticipationHttpError && error.code === 'seat_unavailable') {
    return getLobbyErrorMessage(error.code)
  }
  return '换座失败，请重试。'
}

export function getStartErrorMessage(error: unknown) {
  if (error instanceof RoomParticipationHttpError && error.code !== null) {
    return getLobbyErrorMessage(error.code)
  }
  return '开始游戏失败，请重试。'
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
  const transition = beginSeatTransition(source, targetPlayerID, storage)
  const heartbeat = globalThis.setInterval(
    () => renewSeatTransitionLease(transition, storage),
    SEAT_TRANSITION_LEASE_MS / 4,
  )
  try {
    const response = await client.changeSeat(
      source.matchID,
      source.playerID,
      source.credentials,
      targetPlayerID,
    )
    return completeSeatTransition(source, transition, response, storage)
  } catch (error) {
    if (isDefinitiveSeatChangeRejection(error)) {
      clearSeatTransitionIfCurrent(transition, storage)
    } else {
      markSeatTransitionUncertain(transition, storage)
    }
    throw error
  } finally {
    globalThis.clearInterval(heartbeat)
  }
}

function isDefinitiveSeatChangeRejection(error: unknown) {
  if (!(error instanceof RoomParticipationHttpError)) return false
  if ([400, 401, 403, 404].includes(error.status)) return true
  return error.status === 409 && error.code === 'seat_unavailable'
}

async function requestRoomExit(
  url: string,
  credentials: string,
  fetcher: Fetcher,
): Promise<RoomExitResult> {
  const response = await fetcher(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${credentials}` },
  })
  if (response.status === 204 || response.status === 403 || response.status === 404) {
    return { status: response.status as RoomExitResult['status'] }
  }

  throw new RoomParticipationHttpError(response.status)
}

function sameRoomSession(current: RoomSession | null, expected: RoomSession) {
  return current?.playerID === expected.playerID &&
    current.credentials === expected.credentials
}

export async function reconcileRoomExit(
  expected: RoomSession,
  result: RoomExitResult,
  transitionChanged: boolean,
  validate: ValidateSeat,
  storage?: RoomSessionStorage,
): Promise<RoomExitResolution> {
  let currentSession = loadRoomSession(expected.matchID, storage)
  if (currentSession !== null && !sameRoomSession(currentSession, expected)) {
    return { status: 'rebind', session: currentSession }
  }

  const transition = loadSeatTransition(expected.matchID, storage)
  if (transition !== null) {
    const recovery = await recoverSeatTransition(transition, validate, storage)
    currentSession = loadRoomSession(expected.matchID, storage)
    if (currentSession !== null && !sameRoomSession(currentSession, expected)) {
      return { status: 'rebind', session: currentSession }
    }
    if (recovery.status === 'requesting') return { status: 'transition-pending' }
    if (recovery.status === 'source') return { status: 'session-retained' }
    if (recovery.status === 'target' && currentSession !== null) {
      return { status: 'rebind', session: currentSession }
    }
    if (recovery.status === 'invalid') return { status: 'completed' }
  }

  if (transitionChanged && result.status === 403) {
    const sourceValid = await validate(
      expected.matchID,
      expected.playerID,
      expected.credentials,
    )
    currentSession = loadRoomSession(expected.matchID, storage)
    if (currentSession !== null && !sameRoomSession(currentSession, expected)) {
      return { status: 'rebind', session: currentSession }
    }
    if (sourceValid || currentSession !== null) return { status: 'session-retained' }
  }

  clearRoomSessionIfCurrent(expected, storage)
  currentSession = loadRoomSession(expected.matchID, storage)
  if (currentSession === null) return { status: 'completed' }
  return sameRoomSession(currentSession, expected)
    ? { status: 'session-retained' }
    : { status: 'rebind', session: currentSession }
}

export async function leaveRoom(
  baseURL: string,
  session: Pick<RoomSession, 'matchID' | 'playerID' | 'credentials'>,
  fetcher: Fetcher = fetch,
) {
  return requestRoomExit(
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
  return requestRoomExit(
    `${baseURL}/rooms/avalon/${encodeURIComponent(session.matchID)}`,
    session.credentials,
    fetcher,
  )
}
