import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'

import type { Server as BoardgameServerTypes, StorageAPI } from 'boardgame.io'
import { Server as createBoardgameServer } from 'boardgame.io/server'

import { AvalonGame } from '@avalon/game'

import { loadServerConfig, type AvalonServerConfig } from './config'
import { MemoryStorage } from './storage/memory'
import { PostgresStorage } from './storage/postgres'
import { AvalonSocketRegistry, registerDevAdminRoutes } from './dev-admin'
import { createDeletionSafeStorage } from './storage/deletion-safe'

type BoardgameServer = ReturnType<typeof createBoardgameServer>
type ServerHandles = Awaited<ReturnType<BoardgameServer['run']>>
type BoardgameGame = Parameters<typeof createBoardgameServer>[0]['games'][number]

const CLIENT_ID_DATA_KEY = 'clientID'

function readClientID(data: unknown) {
  if (typeof data !== 'object' || data === null) return undefined

  const clientID = (data as Record<string, unknown>)[CLIENT_ID_DATA_KEY]
  return typeof clientID === 'string' && clientID.length > 0
    ? clientID
    : undefined
}

function normalizePlayerName(name: unknown) {
  return typeof name === 'string' ? name.trim().toLocaleLowerCase() : ''
}

function createAvalonCredentialGenerator(
  db: StorageAPI.Sync | StorageAPI.Async,
): BoardgameServerTypes.GenerateCredentials {
  return async (ctx) => {
    const matchID = ctx.params.id
    const playerID = ctx.request.body?.playerID
    const playerName = normalizePlayerName(ctx.request.body?.playerName)
    const clientID = readClientID(ctx.request.body?.data)

    if (typeof matchID === 'string') {
      const { metadata } = await (db as StorageAPI.Async).fetch(matchID, {
        metadata: true,
      })
      const allPlayers = metadata === undefined ? [] : Object.values(metadata.players)
      const pendingPlayer = allPlayers.find(
        (player) => String(player.id) === String(playerID),
      )
      const players = allPlayers.filter(
        (player) => String(player.id) !== String(playerID),
      )
      const rejectJoin = (message: string): never => {
        if (pendingPlayer !== undefined) {
          delete pendingPlayer.name
          delete pendingPlayer.data
        }
        ctx.throw(409, message)
        throw new Error(message)
      }

      if (clientID && players.some((player) => readClientID(player.data) === clientID)) {
        rejectJoin('Client has already joined this match')
      }

      if (playerName && players.some((player) => normalizePlayerName(player.name) === playerName)) {
        rejectJoin('Player name is already used in this match')
      }
    }

    return randomUUID()
  }
}

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
  const rawDb = options.db ?? createDefaultStorage()
  const guardedStorage = rawDb.type() === 0
    ? createDeletionSafeStorage(rawDb as StorageAPI.Sync)
    : createDeletionSafeStorage(rawDb as StorageAPI.Async)
  const db = guardedStorage.storage as StorageAPI.Sync | StorageAPI.Async
  const boardgame = createBoardgameServer({
    games: [AvalonGame as unknown as BoardgameGame],
    db,
    generateCredentials: createAvalonCredentialGenerator(db),
    origins: config.origins,
    apiOrigins: config.origins,
  })

  const registry = new AvalonSocketRegistry()
  const app = boardgame.app as typeof boardgame.app & {
    _io?: { of(name: string): { on(event: string, listener: (socket: unknown) => void): void } }
  }
  const namespace = app._io?.of('avalon')
  if (namespace !== undefined) registry.attach(namespace as unknown as Parameters<typeof registry.attach>[0])
  registerDevAdminRoutes(boardgame.router, {
    config,
    db,
    deletionGuard: guardedStorage.deletionGuard,
    registry,
    queues: boardgame.transport,
    unavailableMatchIDs: guardedStorage.deletionGuard.unavailableMatchIDs,
  })

  return { boardgame, config, db: rawDb }
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
