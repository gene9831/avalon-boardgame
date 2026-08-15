export interface RoomSession {
  matchID: string
  playerID: string
  credentials: string
  playerName: string
}

export interface RoomSessionStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
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
  return [
    session.matchID,
    session.playerID,
    session.credentials,
    session.playerName,
  ].every((field) => typeof field === 'string' && field.length > 0)
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
