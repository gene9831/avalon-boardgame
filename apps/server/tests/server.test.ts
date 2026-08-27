import { describe, expect, it } from 'vitest'

import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'

import { AvalonGame, type AvalonPlayerView } from '@avalon/game'

import { createAvalonServer, startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'
import { PostgresStorage } from '../src/storage/postgres'
import { AvalonTestLobbyClient as LobbyClient } from './support/lobby-client'

const testConfig = { gamePort: 0, lobbyPort: 0, origins: ['*'], devToolsEnabled: false }

type AvalonClient = ReturnType<typeof Client>
type AvalonClientState = NonNullable<ReturnType<AvalonClient['getState']>>

function waitForClientState(
  client: AvalonClient,
  predicate: (state: AvalonClientState) => boolean,
) {
  return new Promise<AvalonClientState>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error('Timed out waiting for boardgame.io client state'))
    }, 4000)

    const finish = (state: AvalonClientState) => {
      clearTimeout(timeout)
      unsubscribe()
      resolve(state)
    }

    unsubscribe = client.subscribe((state) => {
      if (state !== null && predicate(state)) finish(state)
    })

    const currentState = client.getState()
    if (currentState !== null && predicate(currentState)) finish(currentState)
  })
}

describe('Avalon server', () => {
  it('selects PostgreSQL storage when DATABASE_URL is configured', async () => {
    const previousDatabaseURL = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://example:example@127.0.0.1:5432/avalon'

    try {
      const { db } = createAvalonServer({
        config: testConfig,
      })

      expect(db).toBeInstanceOf(PostgresStorage)
      await (db as PostgresStorage).close()
    } finally {
      if (previousDatabaseURL === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = previousDatabaseURL
      }
    }
  })

  it('allows memory storage only when explicitly configured', async () => {
    const previousDatabaseURL = process.env.DATABASE_URL
    const previousStorageMode = process.env.AVALON_STORAGE
    delete process.env.DATABASE_URL
    process.env.AVALON_STORAGE = 'memory'

    try {
      const { db } = createAvalonServer({
        config: testConfig,
      })

      expect(db).toBeInstanceOf(MemoryStorage)
    } finally {
      if (previousDatabaseURL === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = previousDatabaseURL
      }
      if (previousStorageMode === undefined) {
        delete process.env.AVALON_STORAGE
      } else {
        process.env.AVALON_STORAGE = previousStorageMode
      }
    }
  })

  it('starts the game server with the generic game-list route disabled', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })

    try {
      const response = await fetch(`http://127.0.0.1:${running.lobbyPort}/games`)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: { code: 'not_found', message: 'Route not found' },
      })
    } finally {
      await running.close()
    }
  })

  it('injects a private deterministic game seed for replay tests', async () => {
    const storage = new MemoryStorage()
    const running = await startAvalonServer({
      config: testConfig,
      db: storage,
      gameSeed: 'server-replay-seed',
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const { state } = storage.fetch(matchID, { state: true })

      expect(state.plugins.random.data).toEqual({
        seed: 'server-replay-seed',
      })
    } finally {
      await running.close()
    }
  })

  it('keeps multiple Lobby matches isolated', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const first = await lobby.createMatch('avalon', { numPlayers: 5 })
      const second = await lobby.createMatch('avalon', { numPlayers: 5 })

      expect(first.matchID).not.toBe(second.matchID)

      await lobby.joinMatch('avalon', first.matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      await lobby.joinMatch('avalon', second.matchID, {
        playerID: '0',
        playerName: 'Alice',
      })

      const firstMatch = await lobby.getMatch('avalon', first.matchID)
      const secondMatch = await lobby.getMatch('avalon', second.matchID)
      expect(firstMatch.players.find(({ id }) => id === 0)?.name).toBe('Alice')
      expect(secondMatch.players.find(({ id }) => id === 0)?.name).toBe('Alice')
    } finally {
      await running.close()
    }
  })

  it('rejects invalid player names without occupying the requested seat', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })

      await expect(lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: '   ',
      })).rejects.toThrow('HTTP status 400')
      await expect(lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'A'.repeat(25),
      })).rejects.toThrow('HTTP status 400')

      const match = await lobby.getMatch('avalon', matchID)
      expect(match.players.find(({ id }) => id === 0)?.name).toBeUndefined()
      expect(match.players.find(({ id }) => id === 1)?.name).toBeUndefined()
    } finally {
      await running.close()
    }
  })

  it('allows duplicate display names because seats remain the stable identity', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
        data: { avatarID: 'merlin', clientID: 'client-alice-1' },
        playerID: '0',
        playerName: 'Alice',
      })

      await lobby.joinMatch('avalon', matchID, {
        data: { avatarID: 'morgana', clientID: 'client-alice-2' },
        playerID: '1',
        playerName: '  ALICE  ',
      })

      const match = await lobby.getMatch('avalon', matchID)
      expect(match.players.find(({ id }) => id === 0)?.name).toBe('Alice')
      expect(match.players.find(({ id }) => id === 1)?.name).toBe('ALICE')
      expect(match.players.find(({ id }) => id === 0)?.data).toMatchObject({ avatarID: 'merlin' })
      expect(match.players.find(({ id }) => id === 1)?.data).toMatchObject({ avatarID: 'morgana' })
    } finally {
      await running.close()
    }
  })

  it('persists a valid player name after trimming surrounding whitespace', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: '  Alice  ',
      })

      const match = await lobby.getMatch('avalon', matchID)
      expect(match.players.find(({ id }) => id === 0)?.name).toBe('Alice')
    } finally {
      await running.close()
    }
  })

  it('returns one seat conflict when two clients concurrently claim the same seat', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const results = await Promise.allSettled([
        lobby.joinMatch('avalon', matchID, {
          playerID: '1',
          playerName: 'Alice',
          data: { clientID: 'client-a' },
        }),
        lobby.joinMatch('avalon', matchID, {
          playerID: '1',
          playerName: 'Bob',
          data: { clientID: 'client-b' },
        }),
      ])

      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(({ status }) => status === 'rejected')).toEqual([
        expect.objectContaining({
          reason: expect.objectContaining({
            message: 'HTTP status 409',
            details: {
              error: {
                code: 'seat_unavailable',
                message: 'Seat is unavailable',
              },
            },
          }),
        }),
      ])

      const match = await lobby.getMatch('avalon', matchID)
      expect(match.players.find(({ id }) => id === 1)?.name).toMatch(/^(Alice|Bob)$/)
    } finally {
      await running.close()
    }
  })

  it('prevents one client identity from occupying multiple seats', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
        data: { clientID: 'client-1' },
      })

      await expect(lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Alice on another tab',
        data: { clientID: 'client-1' },
      })).rejects.toThrow('HTTP status 409')

      const match = await lobby.getMatch('avalon', matchID)
      expect(match.players.find(({ id }) => id === 1)?.name).toBeUndefined()
    } finally {
      await running.close()
    }
  })

  it('synchronizes five seat-bound clients through Socket.IO', async () => {
    const running = await startAvalonServer({
      config: testConfig,
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })
    const clients: AvalonClient[] = []

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const players = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          lobby.joinMatch('avalon', matchID, {
            playerID: String(index),
            playerName: `Player ${index + 1}`,
          }),
        ),
      )

      for (const player of players) {
        clients.push(Client({
          game: AvalonGame,
          numPlayers: 5,
          multiplayer: SocketIO({
            server: `http://127.0.0.1:${running.gamePort}`,
          }),
          matchID,
          playerID: player.playerID,
          credentials: player.playerCredentials,
        }))
      }

      clients.forEach((client) => client.start())
      await Promise.all(
        clients.map((client) =>
          waitForClientState(client, (state) => state.isConnected),
        ),
      )

      clients[0].moves.startGame()
      const states = await Promise.all(
        clients.map((client) =>
          waitForClientState(
            client,
            (state) => state.ctx.phase === 'identityRecognition',
          ),
        ),
      )

      for (const state of states) {
        expect(state.G).not.toHaveProperty('secret')
      }

      clients[2].moves.confirmIdentityRecognition()
      const confirmedStates = await Promise.all(
        clients.map((client) =>
          waitForClientState(
            client,
            (state) =>
              (state.G as AvalonPlayerView).identityRecognition
                ?.confirmedCount === 1,
          ),
        ),
      )

      for (const state of confirmedStates) {
        expect(state.ctx._activePlayersNumMoves).toEqual({
          '0': 0,
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
        })
      }
    } finally {
      clients.forEach((client) => client.stop())
      await running.close()
    }
  }, 10000)

  it('reconnects the same credential after the game server restarts', async () => {
    const storage = new MemoryStorage()
    let running = await startAvalonServer({
      config: testConfig,
      db: storage,
      gameSeed: 'restart-replay-seed',
    })
    let client: AvalonClient | undefined

    try {
      const lobby = new LobbyClient({
        server: `http://127.0.0.1:${running.lobbyPort}`,
      })
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const player = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const createClient = () => Client({
        game: AvalonGame,
        numPlayers: 5,
        multiplayer: SocketIO({
          server: `http://127.0.0.1:${running.gamePort}`,
        }),
        matchID,
        playerID: player.playerID,
        credentials: player.playerCredentials,
      })

      client = createClient()
      client.start()
      await waitForClientState(client, (state) => state.isConnected)
      client.moves.startGame()
      const started = await waitForClientState(
        client,
        (state) => state.ctx.phase === 'identityRecognition',
      )
      const originalRole = (started.G as AvalonPlayerView).viewer.role

      client.stop()
      client = undefined
      await running.close()
      running = await startAvalonServer({
        config: testConfig,
        db: storage,
        gameSeed: 'restart-replay-seed',
      })

      client = createClient()
      client.start()
      const reconnected = await waitForClientState(
        client,
        (state) =>
          state.isConnected && state.ctx.phase === 'identityRecognition',
      )

      expect((reconnected.G as AvalonPlayerView).viewer.role).toBe(originalRole)
      expect(reconnected.G).not.toHaveProperty('secret')
      const validation = await fetch(
        `http://127.0.0.1:${running.lobbyPort}/rooms/avalon/${matchID}/players/${player.playerID}/session`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${player.playerCredentials}`,
          },
        },
      )
      expect(validation.status).toBe(204)
    } finally {
      client?.stop()
      await running.close()
    }
  }, 15000)
})
