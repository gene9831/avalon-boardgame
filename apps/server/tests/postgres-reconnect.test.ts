import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'
import { describe, expect, it } from 'vitest'

import { AvalonGame, type AvalonPlayerView } from '@avalon/game'

import { startAvalonServer } from '../src/server'
import { PostgresStorage } from '../src/storage/postgres'
import { AvalonTestLobbyClient as LobbyClient } from './support/lobby-client'

const envFile = new URL('../.env.local', import.meta.url)
if (existsSync(envFile)) loadEnvFile(envFile)

const databaseUrl = process.env.DATABASE_URL
if (
  process.env.AVALON_REQUIRE_POSTGRES_TESTS === '1' &&
  databaseUrl === undefined
) {
  throw new Error('DATABASE_URL is required for PostgreSQL integration tests')
}
const describeDatabase = databaseUrl === undefined ? describe.skip : describe
const testConfig = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: false,
}

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
      reject(new Error('Timed out waiting for PostgreSQL reconnect state'))
    }, 5000)

    const finish = (state: AvalonClientState) => {
      clearTimeout(timeout)
      unsubscribe()
      resolve(state)
    }

    unsubscribe = client.subscribe((state) => {
      if (state !== null && predicate(state)) finish(state)
    })
    const current = client.getState()
    if (current !== null && predicate(current)) finish(current)
  })
}

describeDatabase('PostgreSQL credential reconnection', () => {
  it('restores a persisted match after the game server restarts', async () => {
    let running = await startAvalonServer({
      config: testConfig,
      db: new PostgresStorage({ connectionString: databaseUrl }),
      gameSeed: 'postgres-restart-seed',
    })
    let client: AvalonClient | undefined
    let matchID: string | undefined

    try {
      const lobby = new LobbyClient({
        server: `http://127.0.0.1:${running.lobbyPort}`,
      })
      const created = await lobby.createMatch('avalon', { numPlayers: 5 })
      const activeMatchID = created.matchID
      matchID = activeMatchID
      const player = await lobby.joinMatch('avalon', activeMatchID, {
        playerID: '0',
        playerName: 'Persistent Alice',
      })
      await Promise.all(
        Array.from({ length: 4 }, (_, index) => lobby.joinMatch(
          'avalon',
          activeMatchID,
          {
            playerID: String(index + 1),
            playerName: `Persistent Player ${index + 2}`,
          },
        )),
      )
      const connect = () => Client({
        game: AvalonGame,
        numPlayers: 5,
        multiplayer: SocketIO({
          server: `http://127.0.0.1:${running.gamePort}`,
        }),
        matchID: matchID as string,
        playerID: player.playerID,
        credentials: player.playerCredentials,
      })

      client = connect()
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
        db: new PostgresStorage({ connectionString: databaseUrl }),
        gameSeed: 'postgres-restart-seed',
      })

      client = connect()
      client.start()
      const restored = await waitForClientState(
        client,
        (state) =>
          state.isConnected && state.ctx.phase === 'identityRecognition',
      )

      expect((restored.G as AvalonPlayerView).viewer.role).toBe(originalRole)
      expect(restored.G).not.toHaveProperty('secret')
    } finally {
      client?.stop()
      await running.close()

      if (matchID !== undefined) {
        const cleanup = new PostgresStorage({ connectionString: databaseUrl })
        await cleanup.connect()
        await cleanup.wipe(matchID)
        await cleanup.close()
      }
    }
  }, 20000)
})
