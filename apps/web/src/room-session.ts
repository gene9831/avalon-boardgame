import type { AvalonRoomSessionResponse, AvalonRoomSummary } from '@avalon/game'

import type { PlayerAvatarID } from './player-profile'

export interface RoomSession {
  matchID: string
  playerID: string
  credentials: string
  avatarID?: PlayerAvatarID
  playerName: string
  sessionID?: string
}

export interface RoomSessionStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export class RoomSessionValidationHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP status ${status}`)
    this.name = 'RoomSessionValidationHttpError'
    this.status = status
  }
}

type Fetcher = typeof fetch

interface RoomSessionRoom {
  players: readonly {
    id: string | number
    name?: string | null
    data?: unknown
  }[]
}

type ActiveRoomSummary = Pick<AvalonRoomSummary, 'matchID' | 'status'>

export interface ActiveRoomSessionValidation {
  sessions: RoomSession[]
  validationFailed: boolean
}

export interface SeatTransition {
  transitionID: string
  matchID: string
  sourcePlayerID: string
  targetPlayerID: string
  credentials: string
  startedAt: number
  status: 'requesting' | 'uncertain'
  leaseExpiresAt: number
}

type SeatTransitionIDGenerator = () => string

export type ValidateSeat = (
  matchID: string,
  playerID: string,
  credentials: string,
) => Promise<boolean>

export type SeatTransitionRecovery =
  | { status: 'requesting'; playerID: string }
  | { status: 'source'; playerID: string }
  | { status: 'target'; playerID: string }
  | { status: 'invalid' }

export const ROOM_SESSION_KEY = 'avalon:room-session'
export const LAST_ROOM_SESSION_KEY = 'avalon:last-room'
export const SEAT_TRANSITION_KEY = 'avalon:seat-transition'
export const SEAT_TRANSITION_LEASE_MS = 120_000

export function getRoomSessionKey(matchID: string) {
  return `${ROOM_SESSION_KEY}:${encodeURIComponent(matchID)}`
}

export function getSeatTransitionKey(matchID: string) {
  return `${SEAT_TRANSITION_KEY}:${encodeURIComponent(matchID)}`
}

function browserStorage(): RoomSessionStorage {
  if (typeof window === 'undefined') {
    throw new Error('Room session storage is only available in a browser')
  }

  return window.localStorage
}

function isRoomSession(value: unknown): value is RoomSession {
  if (typeof value !== 'object' || value === null) return false

  const session = value as Partial<RoomSession>
  const requiredFieldsAreValid = [
    session.matchID,
    session.playerID,
    session.credentials,
    session.playerName,
  ].every((field) => typeof field === 'string' && field.length > 0)
  return requiredFieldsAreValid && (
    session.sessionID === undefined ||
    (typeof session.sessionID === 'string' && session.sessionID.length > 0)
  )
}

export function saveRoomSession(
  session: RoomSession,
  storage: RoomSessionStorage = browserStorage(),
) {
  storage.setItem(getRoomSessionKey(session.matchID), JSON.stringify(session))
  storage.setItem(LAST_ROOM_SESSION_KEY, session.matchID)
  storage.removeItem(ROOM_SESSION_KEY)
}

export function loadRoomSession(
  matchID: string,
  storage: RoomSessionStorage = browserStorage(),
): RoomSession | null {
  if (matchID.length === 0) return null

  const roomSession = readRoomSession(storage.getItem(getRoomSessionKey(matchID)))
  if (roomSession !== null) return roomSession

  const legacySession = readRoomSession(storage.getItem(ROOM_SESSION_KEY))
  return legacySession?.matchID === matchID ? legacySession : null
}

export function loadLastRoomSession(
  storage: RoomSessionStorage = browserStorage(),
): RoomSession | null {
  try {
    const lastMatchID = storage.getItem(LAST_ROOM_SESSION_KEY)
    if (lastMatchID !== null) {
      const session = loadRoomSession(lastMatchID, storage)
      if (session !== null) return session
    }

    return readRoomSession(storage.getItem(ROOM_SESSION_KEY))
  } catch {
    return null
  }
}

export function clearRoomSession(
  matchID: string,
  storage: RoomSessionStorage = browserStorage(),
) {
  storage.removeItem(getRoomSessionKey(matchID))

  if (storage.getItem(LAST_ROOM_SESSION_KEY) === matchID) {
    storage.removeItem(LAST_ROOM_SESSION_KEY)
  }

  const legacySession = readRoomSession(storage.getItem(ROOM_SESSION_KEY))
  if (legacySession?.matchID === matchID) {
    storage.removeItem(ROOM_SESSION_KEY)
  }
}

export function clearRoomSessionIfCurrent(
  expected: RoomSession,
  storage: RoomSessionStorage = browserStorage(),
) {
  const current = loadRoomSession(expected.matchID, storage)
  if (
    current?.playerID !== expected.playerID ||
    current.credentials !== expected.credentials
  ) return

  clearRoomSession(expected.matchID, storage)
}

export function beginSeatTransition(
  source: Pick<RoomSession, 'matchID' | 'playerID' | 'credentials'>,
  targetPlayerID: string,
  storage: RoomSessionStorage = browserStorage(),
  startedAt = Date.now(),
  generateID: SeatTransitionIDGenerator = generateSeatTransitionID,
): SeatTransition {
  const transition: SeatTransition = {
    transitionID: generateID(),
    matchID: source.matchID,
    sourcePlayerID: source.playerID,
    targetPlayerID,
    credentials: source.credentials,
    startedAt,
    status: 'requesting',
    leaseExpiresAt: startedAt + SEAT_TRANSITION_LEASE_MS,
  }
  storage.setItem(getSeatTransitionKey(transition.matchID), JSON.stringify(transition))
  return transition
}

export function loadSeatTransition(
  matchID: string,
  storage: RoomSessionStorage = browserStorage(),
): SeatTransition | null {
  const raw = storage.getItem(getSeatTransitionKey(matchID))
  if (raw === null) return null

  try {
    const transition: unknown = JSON.parse(raw)
    if (!isSeatTransition(transition) || transition.matchID !== matchID) return null
    return {
      ...transition,
      transitionID: transition.transitionID ?? legacySeatTransitionID(transition),
      status: transition.status ?? 'uncertain',
      leaseExpiresAt: transition.leaseExpiresAt ??
        transition.startedAt + SEAT_TRANSITION_LEASE_MS,
    }
  } catch {
    return null
  }
}

export function completeSeatTransition(
  source: RoomSession,
  transition: SeatTransition,
  response: AvalonRoomSessionResponse,
  storage: RoomSessionStorage = browserStorage(),
) {
  const target = {
    ...source,
    matchID: response.matchID,
    playerID: response.playerID,
    credentials: response.playerCredentials,
  }
  saveRoomSession(target, storage)
  clearSeatTransitionIfCurrent(transition, storage)
  return target
}

function isSameSeatTransition(current: SeatTransition | null, expected: SeatTransition) {
  return current?.transitionID === expected.transitionID
}

export function clearSeatTransitionIfCurrent(
  expected: SeatTransition,
  storage: RoomSessionStorage = browserStorage(),
) {
  if (isSameSeatTransition(loadSeatTransition(expected.matchID, storage), expected)) {
    storage.removeItem(getSeatTransitionKey(expected.matchID))
  }
}

export function markSeatTransitionUncertain(
  expected: SeatTransition,
  storage: RoomSessionStorage = browserStorage(),
) {
  const current = loadSeatTransition(expected.matchID, storage)
  if (!isSameSeatTransition(current, expected)) return
  storage.setItem(getSeatTransitionKey(expected.matchID), JSON.stringify({
    ...current,
    status: 'uncertain',
  }))
}

export function renewSeatTransitionLease(
  expected: SeatTransition,
  storage: RoomSessionStorage = browserStorage(),
  now = Date.now(),
) {
  const current = loadSeatTransition(expected.matchID, storage)
  if (!isSameSeatTransition(current, expected) || current?.status !== 'requesting') return
  storage.setItem(getSeatTransitionKey(expected.matchID), JSON.stringify({
    ...current,
    leaseExpiresAt: now + SEAT_TRANSITION_LEASE_MS,
  }))
}

export function isSeatTransitionRequestActive(
  session: Pick<RoomSession, 'matchID' | 'playerID' | 'credentials'>,
  storage: RoomSessionStorage = browserStorage(),
  now = Date.now(),
) {
  const transition = loadSeatTransition(session.matchID, storage)
  return transition?.status === 'requesting' &&
    transition.sourcePlayerID === session.playerID &&
    transition.credentials === session.credentials &&
    transition.leaseExpiresAt > now
}

export async function recoverSeatTransition(
  transition: SeatTransition,
  validate: ValidateSeat,
  storage?: RoomSessionStorage,
  now = Date.now(),
): Promise<SeatTransitionRecovery> {
  const resolvedStorage = storage ?? browserStorage()
  const currentTransition = loadSeatTransition(transition.matchID, resolvedStorage)
  if (currentTransition === null || !isSameSeatTransition(currentTransition, transition)) {
    return { status: 'requesting', playerID: transition.sourcePlayerID }
  }
  let recoverableTransition = currentTransition
  if (recoverableTransition.status === 'requesting' && recoverableTransition.leaseExpiresAt > now) {
    return { status: 'requesting', playerID: transition.sourcePlayerID }
  }
  if (recoverableTransition.status === 'requesting') {
    markSeatTransitionUncertain(recoverableTransition, resolvedStorage)
    recoverableTransition = { ...recoverableTransition, status: 'uncertain' }
  }
  const sourceValid = await validate(
    transition.matchID,
    transition.sourcePlayerID,
    transition.credentials,
  )
  if (sourceValid) {
    clearSeatTransitionIfCurrent(transition, resolvedStorage)
    return { status: 'source', playerID: transition.sourcePlayerID }
  }

  const targetValid = await validate(
    transition.matchID,
    transition.targetPlayerID,
    transition.credentials,
  )
  if (targetValid) {
    const source = loadRoomSession(transition.matchID, resolvedStorage)
    if (
      source?.playerID === transition.sourcePlayerID &&
      source.credentials === transition.credentials
    ) {
      saveRoomSession({ ...source, playerID: transition.targetPlayerID }, resolvedStorage)
    }
    clearSeatTransitionIfCurrent(transition, resolvedStorage)
    return { status: 'target', playerID: transition.targetPlayerID }
  }

  const current = loadRoomSession(transition.matchID, resolvedStorage)
  if (current !== null) clearRoomSessionIfCurrent({
    ...current,
    playerID: transition.sourcePlayerID,
    credentials: transition.credentials,
  }, resolvedStorage)
  clearSeatTransitionIfCurrent(transition, resolvedStorage)
  return { status: 'invalid' }
}

export function clearDeletedLastRoomSession(
  matchID: string,
  lastRoomSession: RoomSession | null,
  storage: RoomSessionStorage = browserStorage(),
) {
  if (lastRoomSession?.matchID !== matchID) return lastRoomSession

  clearRoomSession(matchID, storage)
  return null
}

function readRoomSession(raw: string | null): RoomSession | null {
  if (raw === null) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    return isRoomSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

type StoredSeatTransition = Omit<SeatTransition, 'status' | 'transitionID' | 'leaseExpiresAt'> & {
  status?: SeatTransition['status']
  transitionID?: string
  leaseExpiresAt?: number
}

function isSeatTransition(value: unknown): value is StoredSeatTransition {
  if (typeof value !== 'object' || value === null) return false
  const transition = value as Partial<SeatTransition>
  return [
    transition.matchID,
    transition.sourcePlayerID,
    transition.targetPlayerID,
    transition.credentials,
  ].every((field) => typeof field === 'string' && field.length > 0) &&
    typeof transition.startedAt === 'number' && Number.isFinite(transition.startedAt) &&
    (transition.status === undefined || transition.status === 'requesting' || transition.status === 'uncertain') &&
    (transition.transitionID === undefined || (typeof transition.transitionID === 'string' && transition.transitionID.length > 0)) &&
    (transition.leaseExpiresAt === undefined || (typeof transition.leaseExpiresAt === 'number' && Number.isFinite(transition.leaseExpiresAt)))
}

function legacySeatTransitionID(transition: StoredSeatTransition) {
  return `legacy:${JSON.stringify([
    transition.matchID,
    transition.sourcePlayerID,
    transition.targetPlayerID,
    transition.credentials,
    transition.startedAt,
  ])}`
}

function generateSeatTransitionID() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure random values are unavailable')
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function getAvailableSeatIDs(
  numPlayers: number,
  occupiedPlayerIDs: readonly (string | number)[],
) {
  const occupied = new Set(occupiedPlayerIDs.map(String))

  return Array.from({ length: numPlayers }, (_, index) => String(index)).filter(
    (playerID) => !occupied.has(playerID),
  )
}

function readJoinSessionID(data: unknown) {
  if (typeof data !== 'object' || data === null) return undefined
  const sessionID = (data as Record<string, unknown>).sessionID
  return typeof sessionID === 'string' && sessionID.length > 0
    ? sessionID
    : undefined
}

export function isRoomSessionStillValid(
  room: RoomSessionRoom,
  session: Pick<RoomSession, 'playerID' | 'sessionID'>,
) {
  const player = room.players.find(
    (candidate) => String(candidate.id) === session.playerID,
  )
  if (player?.name === undefined || player.name === null) return false

  const seatSessionID = readJoinSessionID(player.data)
  if (session.sessionID === undefined) return seatSessionID === undefined
  return seatSessionID === session.sessionID
}

export async function validateRoomSession(
  baseURL: string,
  session: Pick<RoomSession, 'matchID' | 'playerID' | 'credentials'>,
  fetcher: Fetcher = fetch,
) {
  const response = await fetcher(
    `${baseURL}/rooms/avalon/${encodeURIComponent(session.matchID)}/players/${encodeURIComponent(session.playerID)}/session`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.credentials}` },
    },
  )
  if (!response.ok) throw new RoomSessionValidationHttpError(response.status)
}

export async function validateActiveRoomSessions(
  rooms: readonly ActiveRoomSummary[],
  baseURL: string,
  storage: RoomSessionStorage = browserStorage(),
  fetcher: Fetcher = fetch,
): Promise<ActiveRoomSessionValidation> {
  let validationFailed = false
  const candidates = rooms.flatMap((room) => {
    if (room.status === 'finished') return []
    const session = loadRoomSession(room.matchID, storage)
    return session === null ? [] : [session]
  })
  const sessions = await Promise.all(candidates.map(async (session) => {
    const transition = loadSeatTransition(session.matchID, storage)
    if (
      transition?.sourcePlayerID === session.playerID &&
      transition.credentials === session.credentials
    ) return session

    try {
      await validateRoomSession(baseURL, session, fetcher)
      return session
    } catch (error) {
      if (getRoomSessionInvalidationNotice(error) !== null) {
        clearRoomSessionIfCurrent(session, storage)
        return null
      }
      validationFailed = true
      return session
    }
  }))

  return {
    sessions: sessions.filter((session): session is RoomSession => session !== null),
    validationFailed,
  }
}

export function getRoomSessionInvalidationNotice(error: unknown) {
  if (!(error instanceof RoomSessionValidationHttpError)) return null
  if (error.status === 404) return '房间已解散。'
  if (error.status === 403) return '上次的座位已失效。'
  return null
}
