import { readFile, unlink, writeFile } from 'node:fs/promises'

import { Client, LobbyClient } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'

import { AvalonGame, type AvalonPlayerView } from '@avalon/game'

import { startAvalonServer } from '../../src/server'
import { PostgresStorage } from '../../src/storage/postgres'

interface ProbeState {
  matchID: string
  playerCredentials: string
  playerID: string
  role: string
}

const config = {
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
      reject(new Error('Timed out waiting for the PostgreSQL restart probe'))
    }, 10_000)

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

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required for the PostgreSQL restart probe')
  }
  return databaseUrl
}

async function prepare(statePath: string) {
  const databaseUrl = requireDatabaseUrl()
  const running = await startAvalonServer({
    config,
    db: new PostgresStorage({ connectionString: databaseUrl }),
    gameSeed: 'postgres-container-restart-seed',
  })
  let client: AvalonClient | undefined

  try {
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })
    const created = await lobby.createMatch('avalon', { numPlayers: 5 })
    const player = await lobby.joinMatch('avalon', created.matchID, {
      playerID: '0',
      playerName: 'Restart Probe',
    })
    if (player.playerCredentials === null) {
      throw new Error('Restart probe did not receive player credentials')
    }
    client = Client({
      game: AvalonGame,
      numPlayers: 5,
      multiplayer: SocketIO({
        server: `http://127.0.0.1:${running.gamePort}`,
      }),
      matchID: created.matchID,
      playerID: player.playerID,
      credentials: player.playerCredentials,
    })
    client.start()
    await waitForClientState(client, (state) => state.isConnected)
    client.moves.startGame()
    const started = await waitForClientState(
      client,
      (state) => state.ctx.phase === 'identityRecognition',
    )
    const role = (started.G as AvalonPlayerView).viewer.role
    if (role === null) throw new Error('Restart probe did not receive a role')

    const probeState: ProbeState = {
      matchID: created.matchID,
      playerCredentials: player.playerCredentials,
      playerID: player.playerID,
      role,
    }
    await writeFile(statePath, JSON.stringify(probeState), {
      encoding: 'utf8',
      mode: 0o600,
    })
  } finally {
    client?.stop()
    await running.close()
  }
}

async function verify(statePath: string) {
  const databaseUrl = requireDatabaseUrl()
  const probeState = JSON.parse(
    await readFile(statePath, 'utf8'),
  ) as ProbeState
  const running = await startAvalonServer({
    config,
    db: new PostgresStorage({ connectionString: databaseUrl }),
    gameSeed: 'postgres-container-restart-seed',
  })
  let client: AvalonClient | undefined

  try {
    client = Client({
      game: AvalonGame,
      numPlayers: 5,
      multiplayer: SocketIO({
        server: `http://127.0.0.1:${running.gamePort}`,
      }),
      matchID: probeState.matchID,
      playerID: probeState.playerID,
      credentials: probeState.playerCredentials,
    })
    client.start()
    const restored = await waitForClientState(
      client,
      (state) =>
        state.isConnected && state.ctx.phase === 'identityRecognition',
    )
    const restoredGame = restored.G as AvalonPlayerView
    const viewer = restoredGame.viewer
    if (viewer.role !== probeState.role) {
      throw new Error('Persisted role changed after PostgreSQL restarted')
    }
    if ('secret' in restoredGame) {
      throw new Error('Restart probe received authoritative secret state')
    }
  } finally {
    client?.stop()
    await running.close()

    const cleanup = new PostgresStorage({ connectionString: databaseUrl })
    await cleanup.connect()
    await cleanup.wipe(probeState.matchID)
    await cleanup.close()
    await unlink(statePath).catch(() => undefined)
  }
}

const [mode, statePath] = process.argv.slice(2)
if ((mode !== 'prepare' && mode !== 'verify') || statePath === undefined) {
  throw new Error('Usage: postgres-restart-probe <prepare|verify> <state-file>')
}

await (mode === 'prepare' ? prepare(statePath) : verify(statePath))
