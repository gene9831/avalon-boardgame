import { describe, expect, it, vi } from 'vitest'

import {
  canJoinRoom,
  paginateRooms,
  type AvalonRoomSummary,
} from '../src/room-directory'
import { createDevToolsClient } from '../src/dev-tools'
import {
  clearDeletedLastRoomSession,
  getRoomSessionKey,
  loadLastRoomSession,
  saveRoomSession,
  type RoomSessionStorage,
} from '../src/room-session'

describe('room directory', () => {
  it('paginates a room section without mutating the source list', () => {
    const rooms = Array.from({ length: 21 }, (_, index) => ({
      matchID: `room-${index}`,
    }))

    expect(paginateRooms(rooms, 2, 20)).toEqual({
      items: [{ matchID: 'room-20' }],
      page: 2,
      pageCount: 2,
    })
    expect(rooms).toHaveLength(21)
  })

  it('clamps a page to the last valid page', () => {
    expect(paginateRooms([{ matchID: 'room-1' }], 4, 20)).toEqual({
      items: [{ matchID: 'room-1' }],
      page: 1,
      pageCount: 1,
    })
  })

  it('does not offer joining for a playing or finished room', () => {
    expect(canJoinRoom({ status: 'playing' } as AvalonRoomSummary)).toBe(false)
    expect(canJoinRoom({ status: 'finished' } as AvalonRoomSummary)).toBe(false)
    expect(canJoinRoom({ status: 'lobby' } as AvalonRoomSummary)).toBe(true)
  })

  it('clears the saved last-room session after successful deletion', async () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const session = {
      matchID: 'room-1',
      playerID: '0',
      credentials: 'credentials-1',
      playerName: 'Arthur',
      sessionID: 'join-session-1',
    }
    saveRoomSession(session, storage)
    const deleteRoom = createDevToolsClient(
      'http://localhost:8001',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    ).deleteRoom

    await deleteRoom('room-1', 'local-dev-token')
    const nextSession = clearDeletedLastRoomSession('room-1', session, storage)

    expect(nextSession).toBeNull()
    expect(loadLastRoomSession(storage)).toBeNull()
    expect(storage.getItem(getRoomSessionKey('room-1'))).toBeNull()
  })

  it('preserves the saved session when the deletion endpoint is unavailable', async () => {
    const values = new Map<string, string>()
    const storage: RoomSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    const session = {
      matchID: 'room-1',
      playerID: '0',
      credentials: 'credentials-1',
      playerName: 'Arthur',
      sessionID: 'join-session-1',
    }
    saveRoomSession(session, storage)
    const deleteRoom = createDevToolsClient(
      'http://localhost:8001',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    ).deleteRoom

    await expect(deleteRoom('room-1', 'local-dev-token')).rejects.toThrow('HTTP status 404')

    expect(loadLastRoomSession(storage)).toEqual(session)
    expect(storage.getItem(getRoomSessionKey('room-1'))).not.toBeNull()
  })
})
