import type { AddressInfo } from 'node:net'

import type { StorageAPI } from 'boardgame.io'
import { Server as createBoardgameServer } from 'boardgame.io/server'

import { AvalonGame } from '@avalon/game'

import { loadServerConfig, type AvalonServerConfig } from './config'
import { MemoryStorage } from './storage/memory'
import { PostgresStorage } from './storage/postgres'

type BoardgameServer = ReturnType<typeof createBoardgameServer>
type ServerHandles = Awaited<ReturnType<BoardgameServer['run']>>
type BoardgameGame = Parameters<typeof createBoardgameServer>[0]['games'][number]

export interface AvalonServerOptions {
  config?: AvalonServerConfig
  db?: StorageAPI.Sync | StorageAPI.Async
}

export interface RunningAvalonServer {
  config: AvalonServerConfig
  boardgame: BoardgameServer
  servers: ServerHandles
  gamePort: number
  lobbyPort: number
  close: () => Promise<void>
}

type ClosableStorage = (StorageAPI.Sync | StorageAPI.Async) & {
  close?: () => Promise<void> | void
}

function getPort(server: NonNullable<ServerHandles['appServer']>) {
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Avalon server must listen on a TCP port')
  }

  return (address as AddressInfo).port
}

export function createAvalonServer(options: AvalonServerOptions = {}) {
  const config = options.config ?? loadServerConfig()
  const db = options.db ?? createDefaultStorage()
  const boardgame = createBoardgameServer({
    games: [AvalonGame as unknown as BoardgameGame],
    db,
    origins: config.origins,
    apiOrigins: config.origins,
  })

  return { boardgame, config, db }
}

function createDefaultStorage(
  env: NodeJS.ProcessEnv = process.env,
): StorageAPI.Sync | StorageAPI.Async {
  const connectionString = env.DATABASE_URL
  const storageMode = env.AVALON_STORAGE

  if (storageMode === 'memory') return new MemoryStorage()

  if (
    storageMode !== undefined &&
    storageMode !== 'postgres'
  ) {
    throw new Error('AVALON_STORAGE must be either postgres or memory')
  }

  if (connectionString !== undefined && connectionString.trim() !== '') {
    return new PostgresStorage({ connectionString })
  }

  if (storageMode === 'postgres') {
    throw new Error('DATABASE_URL is required when AVALON_STORAGE=postgres')
  }

  if (env.NODE_ENV === 'test') return new MemoryStorage()

  throw new Error(
    'DATABASE_URL is required outside tests; set AVALON_STORAGE=memory only for local ephemeral development',
  )
}

export async function startAvalonServer(
  options: AvalonServerOptions = {},
): Promise<RunningAvalonServer> {
  const { boardgame, config, db } = createAvalonServer(options)
  const servers = await boardgame.run({
    port: config.gamePort,
    lobbyConfig: { apiPort: config.lobbyPort },
  })
  let closePromise: Promise<void> | undefined

  return {
    boardgame,
    config,
    servers,
    gamePort: getPort(servers.appServer),
    lobbyPort: getPort(servers.apiServer ?? servers.appServer),
    close: async () => {
      if (closePromise !== undefined) return closePromise

      boardgame.kill(servers)
      const closeStorage = (db as ClosableStorage).close
      closePromise = Promise.resolve(closeStorage?.()).then(() => undefined)
      await closePromise
    },
  }
}
