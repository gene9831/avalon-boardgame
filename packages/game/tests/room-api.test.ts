import { describe, expect, it } from 'vitest'

import {
  AvalonJoinRoomRequestSchema,
  parseAvalonCreateRoomRequest,
  parseAvalonJoinRoomRequest,
  parseAvalonRoomDetail,
  parseAvalonSeatChangeRequest,
} from '../src/room-api'

describe('Avalon room API contracts', () => {
  const profile = {
    playerName: 'Arthur',
    data: {
      avatarID: 'merlin',
      clientID: 'client_a',
      sessionID: 'session_a',
    },
  } as const

  it('parses create as create-and-enter with default paired roles', () => {
    expect(parseAvalonCreateRoomRequest({ numPlayers: 5, ...profile })).toEqual({
      numPlayers: 5,
      roleConfiguration: { percivalMorgana: true },
      ...profile,
    })
    expect(() => parseAvalonCreateRoomRequest({
      numPlayers: 5,
      ...profile,
      unlisted: true,
    })).toThrow()
  })

  it('parses join without accepting a caller-selected seat', () => {
    expect(parseAvalonJoinRoomRequest({
      playerName: '  Ａlice  ',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    })).toEqual({
      playerName: 'Ａlice',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    })
    expect(AvalonJoinRoomRequestSchema.safeParse({
      playerID: '2',
      ...profile,
    }).success).toBe(false)
  })

  it('parses a target-only seat change', () => {
    expect(parseAvalonSeatChangeRequest({ targetPlayerID: '0' })).toEqual({
      targetPlayerID: '0',
    })
  })

  it.each([
    {
      playerID: '10',
      playerName: 'Alice',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    },
    {
      playerName: 'Alice',
      data: {
        avatarID: 'unknown',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    },
    {
      playerName: 'Alice\nAdmin',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    },
    {
      playerName: 'Alice',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
        privileged: true,
      },
    },
  ])('rejects an unsupported join request %#', (request) => {
    expect(() => parseAvalonJoinRoomRequest(request)).toThrow()
  })

  it('returns only the public room-detail allowlist', () => {
    expect(parseAvalonRoomDetail({
      matchID: 'room-1',
      gameName: 'avalon',
      players: [{
        id: 0,
        name: 'Alice',
        credentials: 'seat-secret',
        isConnected: true,
        data: {
          avatarID: 'merlin',
          clientID: 'client-1',
          sessionID: 'join-session-1',
          internal: 'hidden',
        },
      }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      setupData: { numPlayers: 5, internal: true },
      authorityVersion: 1,
      ownerPlayerID: '0',
      occupiedPlayerIDs: ['0'],
      roleConfiguration: { percivalMorgana: true },
      gameover: false,
      createdAt: 1,
      updatedAt: 2,
      secret: { roles: ['merlin'] },
    })).toEqual({
      matchID: 'room-1',
      gameName: 'avalon',
      players: [{
        id: 0,
        name: 'Alice',
        isConnected: true,
        data: {
          avatarID: 'merlin',
          sessionID: 'join-session-1',
        },
      }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      setupData: { numPlayers: 5 },
      authorityVersion: 1,
      ownerPlayerID: '0',
      occupiedPlayerIDs: ['0'],
      roleConfiguration: { percivalMorgana: true },
      gameover: false,
      createdAt: 1,
      updatedAt: 2,
    })
  })

  it('accepts an ownerless legacy detail only when seat zero is empty', () => {
    expect(parseAvalonRoomDetail({
      matchID: 'legacy-room',
      gameName: 'avalon',
      players: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      setupData: { numPlayers: 5 },
      authorityVersion: 1,
      ownerPlayerID: null,
      occupiedPlayerIDs: ['1'],
      roleConfiguration: { percivalMorgana: false },
      createdAt: 1,
      updatedAt: 2,
    })).toMatchObject({ ownerPlayerID: null, occupiedPlayerIDs: ['1'] })
  })

  it.each([
    { ownerPlayerID: null, occupiedPlayerIDs: ['0'] },
    { ownerPlayerID: '1', occupiedPlayerIDs: ['0'] },
  ])('rejects an invalid room-detail ownership invariant %#', (authority) => {
    expect(() => parseAvalonRoomDetail({
      matchID: 'room-1',
      gameName: 'avalon',
      players: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      setupData: { numPlayers: 5 },
      authorityVersion: 1,
      ...authority,
      roleConfiguration: { percivalMorgana: true },
      createdAt: 1,
      updatedAt: 2,
    })).toThrow()
  })
})
