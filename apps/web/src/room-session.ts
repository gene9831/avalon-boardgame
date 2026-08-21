export interface RoomSession {
  matchID: string
  playerID: string
  credentials: string
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

interface ActiveRoomSummary {
  matchID: string
  status: 'lobby' | 'playing' | 'finished'
}

export interface ActiveRoomSessionValidation {
  sessions: RoomSession[]
  validationFailed: boolean
}

export const ROOM_SESSION_KEY = 'avalon:room-session'
export const LAST_ROOM_SESSION_KEY = 'avalon:last-room'

export function getRoomSessionKey(matchID: string) {
  return `${ROOM_SESSION_KEY}:${encodeURIComponent(matchID)}`
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
    try {
      await validateRoomSession(baseURL, session, fetcher)
      return session
    } catch (error) {
      if (getRoomSessionInvalidationNotice(error) !== null) {
        clearRoomSession(session.matchID, storage)
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
  if (error.status === 404) return '房主已解散房间，已返回主页。'
  if (error.status === 403) return '你的房间座位已被释放，已返回主页。'
  return null
}
