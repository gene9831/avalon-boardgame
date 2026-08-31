import { describe, expect, it } from 'vitest'

import { parseAvalonRoomDirectoryResponse } from '../src/room-directory'

const validRoom = {
  matchID: 'room-1',
  status: 'lobby',
  players: [{ id: 0, name: 'Alice', isConnected: true }],
  authorityVersion: 1,
  ownerPlayerID: '0',
  occupiedPlayerIDs: ['0'],
  roleConfiguration: { percivalMorgana: true },
  createdAt: 1,
  updatedAt: 2,
} as const

describe('Avalon room directory contract', () => {
  it('accepts a valid directory and strips unknown fields', () => {
    expect(parseAvalonRoomDirectoryResponse({
      traceID: 'ignored',
      rooms: [{
        ...validRoom,
        internal: 'ignored',
        players: [{
          ...validRoom.players[0],
          credential: 'ignored',
        }],
      }],
    })).toEqual({
      rooms: [validRoom],
    })
  })

  it.each([
    null,
    {},
    { rooms: 'room-1' },
    { rooms: [{ ...validRoom, matchID: '' }] },
    { rooms: [{ ...validRoom, status: 'unknown' }] },
    { rooms: [{ ...validRoom, createdAt: Number.POSITIVE_INFINITY }] },
    { rooms: [{ ...validRoom, updatedAt: -1 }] },
    { rooms: [{ ...validRoom, players: [{ id: -1, isConnected: true }] }] },
    { rooms: [{ ...validRoom, players: [{ id: 0.5, isConnected: true }] }] },
    { rooms: [{ ...validRoom, players: [{ id: 0, name: 1, isConnected: true }] }] },
    { rooms: [{ ...validRoom, players: [{ id: 0, isConnected: 'yes' }] }] },
  ])('rejects an invalid directory shape %#', (directory) => {
    expect(() => parseAvalonRoomDirectoryResponse(directory)).toThrow()
  })

  it('rejects duplicate player IDs inside one room', () => {
    expect(() => parseAvalonRoomDirectoryResponse({
      rooms: [{
        ...validRoom,
        players: [
          { id: 0, name: 'Alice', isConnected: true },
          { id: 0, name: 'Bob', isConnected: false },
        ],
      }],
    })).toThrow()
  })

  it('rejects duplicate room IDs inside one directory', () => {
    expect(() => parseAvalonRoomDirectoryResponse({
      rooms: [
        validRoom,
        { ...validRoom, status: 'playing' },
      ],
    })).toThrow()
  })
})
