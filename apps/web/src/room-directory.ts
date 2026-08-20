export type RoomStatus = 'lobby' | 'playing' | 'finished'

export interface RoomPlayer {
  id: number
  name?: string
  isConnected: boolean
}

export interface AvalonRoomSummary {
  matchID: string
  status: RoomStatus
  players: RoomPlayer[]
  createdAt: number
  updatedAt: number
}

export interface PaginatedRooms<T> {
  items: T[]
  page: number
  pageCount: number
}

export class RoomDirectoryHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP status ${status}`)
    this.name = 'RoomDirectoryHttpError'
    this.status = status
  }
}

type Fetcher = typeof fetch

export async function fetchRoomSummaries(
  baseURL: string,
  fetcher: Fetcher = fetch,
): Promise<AvalonRoomSummary[]> {
  const response = await fetcher(`${baseURL}/rooms/avalon`)
  if (!response.ok) throw new RoomDirectoryHttpError(response.status)
  const result = (await response.json()) as { rooms: AvalonRoomSummary[] }
  return result.rooms
}

export function paginateRooms<T>(rooms: readonly T[], page: number, pageSize = 20): PaginatedRooms<T> {
  const safePageSize = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(rooms.length / safePageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const start = (currentPage - 1) * safePageSize

  return {
    items: rooms.slice(start, start + safePageSize),
    page: currentPage,
    pageCount,
  }
}

export function canJoinRoom(room: Pick<AvalonRoomSummary, 'status'>) {
  return room.status === 'lobby'
}

export function getOccupiedRoomPlayerIDs(room: Pick<AvalonRoomSummary, 'players'>) {
  return room.players
    .filter((player) => player.name !== undefined && player.name !== null)
    .map(({ id }) => String(id))
}

export function getRoomPlayerCount(room: Pick<AvalonRoomSummary, 'players'>) {
  return room.players.length
}
