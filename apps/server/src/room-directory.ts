import type { Server, State, StorageAPI } from 'boardgame.io'

import type {
  AvalonRoomStatus,
  AvalonRoomSummary,
} from '@avalon/game'

import {
  AvalonLobbyError,
  getPublicLobbyAuthority,
} from './room-lobby'

function getStatus(metadata: Server.MatchData, state: State): AvalonRoomStatus {
  if (metadata.gameover !== undefined) return 'finished'
  return (state.G as { status?: AvalonRoomStatus }).status === 'lobby'
    ? 'lobby'
    : 'playing'
}

export function toAvalonRoomSummary(
  matchID: string,
  metadata: Server.MatchData,
  state: State,
): AvalonRoomSummary {
  const authority = getPublicLobbyAuthority(state, metadata)
  return {
    matchID,
    status: getStatus(metadata, state),
    players: Object.values(metadata.players).map(({ id, name, isConnected }) => ({
      id,
      ...(name === undefined ? {} : { name }),
      isConnected: isConnected === true,
    })),
    ...authority,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }
}

export async function listAvalonRoomSummaries(
  db: StorageAPI.Sync | StorageAPI.Async,
  unavailableMatchIDs: ReadonlySet<string> = new Set(),
): Promise<AvalonRoomSummary[]> {
  const matchIDs = await db.listMatches({ gameName: 'avalon' })
  const rooms: AvalonRoomSummary[] = []

  for (const matchID of matchIDs) {
    if (unavailableMatchIDs.has(matchID)) continue
    const { metadata, state } = await (db as StorageAPI.Async).fetch(matchID, {
      metadata: true,
      state: true,
    })
    if (metadata === undefined || state === undefined || metadata.unlisted) continue
    try {
      rooms.push(toAvalonRoomSummary(matchID, metadata, state))
    } catch (error) {
      if (
        error instanceof AvalonLobbyError &&
        error.code === 'room_not_joinable'
      ) {
        continue
      }
      throw error
    }
  }

  return rooms.sort((first, second) => second.updatedAt - first.updatedAt)
}
