import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  executePendingJoin,
  type LobbyJoinClient,
  type PendingJoin,
} from '../src/join-flow'

const createRoomAndJoin = vi.fn(async () => ({
    matchID: 'room-created',
    playerID: '0',
    playerCredentials: 'credential-0',
  }))
const joinMatch = vi.fn(async (_gameName: 'avalon', matchID: string, _request: unknown) => {
    return {
      matchID,
      playerID: '3',
      playerCredentials: 'credential-3',
    }
  })
const fakeLobby: LobbyJoinClient = { createRoomAndJoin, joinMatch }

const intent: PendingJoin = {
  type: 'join',
  matchID: 'room-existing',
}

beforeEach(() => {
  createRoomAndJoin.mockClear()
  joinMatch.mockClear()
})

describe('pending join flow', () => {
  it('creates and enters with one request', async () => {
    const result = await executePendingJoin(
      fakeLobby,
      {
        type: 'create',
        numPlayers: 5,
        roleConfiguration: { percivalMorgana: true },
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
    expect(createRoomAndJoin).toHaveBeenCalledWith({
      numPlayers: 5,
      roleConfiguration: { percivalMorgana: true },
      playerName: 'Alice',
      data: { avatarID: 'percival', clientID: 'client-1', sessionID: 'join-session-1' },
    })
    expect(joinMatch).not.toHaveBeenCalled()
  })

  it('joins without sending a seat', async () => {
    const result = await executePendingJoin(
      fakeLobby,
      {
        type: 'join',
        matchID: 'room-existing',
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
    expect(joinMatch).toHaveBeenCalledWith('avalon', 'room-existing', {
      data: { avatarID: 'morgana', clientID: 'client-1', sessionID: 'join-session-2' },
      playerName: 'Bob',
    })
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
    expect(createRoomAndJoin).not.toHaveBeenCalled()
    expect(joinMatch).not.toHaveBeenCalled()
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
    expect(createRoomAndJoin).not.toHaveBeenCalled()
    expect(joinMatch).not.toHaveBeenCalled()
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
