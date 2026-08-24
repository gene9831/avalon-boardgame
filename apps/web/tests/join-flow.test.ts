import { beforeEach, describe, expect, it } from 'vitest'

import {
  executePendingJoin,
  type LobbyJoinClient,
  type PendingJoin,
} from '../src/join-flow'

const calls: unknown[][] = []
const fakeLobby: LobbyJoinClient = {
  createMatch: async (gameName, options) => {
    calls.push(['createMatch', gameName, options])
    return { matchID: 'room-created' }
  },
  joinMatch: async (gameName, matchID, options) => {
    calls.push(['joinMatch', gameName, matchID, options])
    return {
      playerID: options.playerID,
      playerCredentials: `credential-${options.playerID}`,
    }
  },
}

const intent: PendingJoin = {
  type: 'join',
  matchID: 'room-existing',
  playerID: '3',
}

beforeEach(() => {
  calls.length = 0
})

describe('pending join flow', () => {
  it('creates first and then joins seat 0 with the submitted name', async () => {
    const result = await executePendingJoin(
      fakeLobby,
      {
        type: 'create',
        numPlayers: 5,
      },
      {
        avatarID: 'percival',
        clientID: 'client-1',
        createSessionID: () => 'join-session-1',
        gameName: 'avalon',
        playerName: ' Alice ',
      },
    )

    expect(result).toEqual({
      matchID: 'room-created',
      playerID: '0',
      credentials: 'credential-0',
      avatarID: 'percival',
      playerName: 'Alice',
      sessionID: 'join-session-1',
    })
    expect(calls).toEqual([
      ['createMatch', 'avalon', { numPlayers: 5 }],
      [
        'joinMatch',
        'avalon',
        'room-created',
        {
          data: {
            avatarID: 'percival',
            clientID: 'client-1',
            sessionID: 'join-session-1',
          },
          playerID: '0',
          playerName: 'Alice',
        },
      ],
    ])
  })

  it('joins the selected seat without creating another room', async () => {
    const result = await executePendingJoin(
      fakeLobby,
      {
        type: 'join',
        matchID: 'room-existing',
        playerID: '3',
      },
      {
        avatarID: 'morgana',
        clientID: 'client-1',
        createSessionID: () => 'join-session-2',
        gameName: 'avalon',
        playerName: ' Bob ',
      },
    )

    expect(result.matchID).toBe('room-existing')
    expect(result.playerID).toBe('3')
    expect(calls).toEqual([
      [
        'joinMatch',
        'avalon',
        'room-existing',
        {
          data: {
            avatarID: 'morgana',
            clientID: 'client-1',
            sessionID: 'join-session-2',
          },
          playerID: '3',
          playerName: 'Bob',
        },
      ],
    ])
  })

  it('rejects a blank name before calling the lobby client', async () => {
    await expect(
      executePendingJoin(fakeLobby, intent, {
        avatarID: 'assassin',
        clientID: 'client-1',
        createSessionID: () => 'join-session-3',
        gameName: 'avalon',
        playerName: '   ',
      }),
    ).rejects.toThrow('玩家名称不能为空')
    expect(calls).toEqual([])
  })

  it('rejects a name longer than 24 characters before calling the lobby client', async () => {
    await expect(
      executePendingJoin(fakeLobby, intent, {
        avatarID: 'assassin',
        clientID: 'client-1',
        createSessionID: () => 'join-session-too-long',
        gameName: 'avalon',
        playerName: 'A'.repeat(25),
      }),
    ).rejects.toThrow('玩家名称不能超过 24 个字符')
    expect(calls).toEqual([])
  })

  it('keeps the public join session ID distinct from player credentials', async () => {
    const result = await executePendingJoin(fakeLobby, intent, {
      avatarID: 'merlin',
      clientID: 'client-1',
      createSessionID: () => 'opaque-join-session',
      gameName: 'avalon',
      playerName: 'Alice',
    })

    expect(result.sessionID).toBe('opaque-join-session')
    expect(result.credentials).toBe('credential-3')
    expect(result.sessionID).not.toBe(result.credentials)
  })

  it('namespaces default public session IDs away from credential UUIDs', async () => {
    const result = await executePendingJoin(fakeLobby, intent, {
      avatarID: 'loyal-servant',
      clientID: 'client-1',
      gameName: 'avalon',
      playerName: 'Alice',
    })

    expect(result.sessionID).toMatch(/^join-/)
    expect(result.credentials).toBe('credential-3')
  })
})
