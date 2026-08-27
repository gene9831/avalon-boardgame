import { describe, expect, it } from 'vitest'

import {
  parseAvalonCreateRoomRequest,
  parseAvalonJoinRoomRequest,
  parseAvalonRoomDetail,
} from '../src/room-api'

describe('Avalon room API contracts', () => {
  it('accepts the supported create request and rejects extra options', () => {
    expect(parseAvalonCreateRoomRequest({ numPlayers: 5 })).toEqual({
      numPlayers: 5,
    })
    expect(() => parseAvalonCreateRoomRequest({
      numPlayers: 5,
      unlisted: true,
    })).toThrow()
  })

  it('normalizes a supported join request', () => {
    expect(parseAvalonJoinRoomRequest({
      playerID: '0',
      playerName: '  Ａlice  ',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    })).toEqual({
      playerID: '0',
      playerName: 'Ａlice',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
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
      playerID: '0',
      playerName: 'Alice',
      data: {
        avatarID: 'unknown',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    },
    {
      playerID: '0',
      playerName: 'Alice\nAdmin',
      data: {
        avatarID: 'merlin',
        clientID: 'client-1',
        sessionID: 'join-session-1',
      },
    },
    {
      playerID: '0',
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
      gameover: false,
      createdAt: 1,
      updatedAt: 2,
    })
  })
})
