import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'

import type { Server as BoardgameServerTypes, StorageAPI } from 'boardgame.io'
import { Server as createBoardgameServer } from 'boardgame.io/server'

import { createAvalonGame } from '@avalon/game'

import { loadServerConfig, type AvalonServerConfig } from './config'
import { MemoryStorage } from './storage/memory'
import { PostgresStorage } from './storage/postgres'
import { AvalonSocketRegistry, registerDevAdminRoutes } from './dev-admin'
import { registerRoomParticipationRoutes } from './room-participation'
import { registerRoomSessionValidationRoute } from './session-validation'
import { createDeletionSafeStorage } from './storage/deletion-safe'
import {
  hasAtomicLobbyStorage,
  type AtomicLobbyStorage,
} from './storage/lobby-storage'
import { secretMatches } from './secret'
import { installAvalonHTTPBoundary } from './http-boundary'
import { AvalonSocketIO } from './socket-transport'

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

function prepareAvalonMetadata(metadata: BoardgameServerTypes.MatchData) {
  for (const player of Object.values(metadata.players)) {
    if (typeof player.name === 'string') player.name = player.name.trim()
  }
}

function lobbyConflict(message: string) {
  return Object.assign(new Error(message), {
    expose: true,
    status: 409,
    statusCode: 409,
  })
}

function getStaleJoinError(
  currentMetadata: BoardgameServerTypes.MatchData,
  staleMetadata: BoardgameServerTypes.MatchData,
) {
  for (const stalePlayer of Object.values(staleMetadata.players)) {
    const currentPlayer = currentMetadata.players[stalePlayer.id]
    if (
      typeof stalePlayer.credentials !== 'string' ||
      stalePlayer.credentials === currentPlayer?.credentials
    ) continue

    if (currentPlayer?.name) {
      return lobbyConflict(`Player ${stalePlayer.id} not available`)
    }

    const otherCurrentPlayers = Object.values(currentMetadata.players).filter(
      (player) => player.id !== stalePlayer.id,
    )
    const staleClientID = readClientID(stalePlayer.data)
    if (
      staleClientID &&
      otherCurrentPlayers.some(
        (player) => readClientID(player.data) === staleClientID,
      )
    ) {
      return lobbyConflict('Client has already joined this match')
    }

    return lobbyConflict('Room metadata changed; refresh and retry')
  }

  return undefined
}

function createAvalonCredentialGenerator(
  db: StorageAPI.Sync | StorageAPI.Async,
): BoardgameServerTypes.GenerateCredentials {
  return async (ctx) => {
    const matchID = ctx.params.id
    const playerID = ctx.request.body?.playerID
    const submittedPlayerName = ctx.request.body?.playerName
    const trimmedPlayerName = typeof submittedPlayerName === 'string'
      ? submittedPlayerName.trim()
      : ''
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
      const rejectJoin = (status: number, message: string): never => {
        if (pendingPlayer !== undefined) {
          delete pendingPlayer.name
          delete pendingPlayer.data
        }
        ctx.throw(status, message)
        throw new Error(message)
      }

      if (trimmedPlayerName.length === 0 || trimmedPlayerName.length > 24) {
        rejectJoin(400, 'Player name must contain 1 to 24 characters')
      }

      if (clientID && players.some((player) => readClientID(player.data) === clientID)) {
        rejectJoin(409, 'Client has already joined this match')
      }
    }

    return randomUUID()
  }
}

export interface AvalonServerOptions {
  config?: AvalonServerConfig
  db?: StorageAPI.Sync | StorageAPI.Async
  gameSeed?: string | number
  identityRecognitionDeadlineEnabled?: boolean
  identityRecognitionNow?: () => number
  identityRecognitionStepMs?: number
  serverInstanceID?: string
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

function createTrackedStorage(
  storage: StorageAPI.Sync | StorageAPI.Async,
) {
  if (storage.type() === 0) {
    return {
      storage: storage as StorageAPI.Sync,
      waitForIdle: async () => undefined,
    }
  }

  const asyncStorage = storage as StorageAPI.Async
  let activeOperations = 0
  let activityVersion = 0
  const idleWaiters = new Set<() => void>()
  const track = async <T>(operation: () => Promise<T>) => {
    activeOperations += 1
    activityVersion += 1
    try {
      return await operation()
    } finally {
      activeOperations -= 1
      activityVersion += 1
      if (activeOperations === 0) {
        for (const resolve of idleWaiters) resolve()
        idleWaiters.clear()
      }
    }
  }
  const waitUntilCurrentlyIdle = () => activeOperations === 0
    ? Promise.resolve()
    : new Promise<void>((resolve) => idleWaiters.add(resolve))
  const waitForIdle = async () => {
    while (true) {
      await waitUntilCurrentlyIdle()
      const observedVersion = activityVersion
      await new Promise<void>((resolve) => setImmediate(resolve))
      if (
        activeOperations === 0 &&
        activityVersion === observedVersion
      ) return
    }
  }
  const trackedStorage: StorageAPI.Async & Partial<AtomicLobbyStorage> = {
    type: () => 1,
    connect: () => track(() => asyncStorage.connect()),
    createMatch: (matchID, options) =>
      track(() => asyncStorage.createMatch(matchID, options)),
    setState: (matchID, state, deltalog) =>
      track(() => asyncStorage.setState(matchID, state, deltalog)),
    setMetadata: (matchID, metadata) =>
      track(() => asyncStorage.setMetadata(matchID, metadata)),
    fetch: (matchID, options) =>
      track(() => asyncStorage.fetch(matchID, options)),
    wipe: (matchID) => track(() => asyncStorage.wipe(matchID)),
    listMatches: (options) =>
      track(() => asyncStorage.listMatches(options)),
  }
  if (hasAtomicLobbyStorage(asyncStorage)) {
    trackedStorage.mutateLobbyMatch = (matchID, mutate) =>
      track(() => asyncStorage.mutateLobbyMatch(matchID, mutate))
  }
  return { storage: trackedStorage, waitForIdle }
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
  const trackedStorage = createTrackedStorage(rawDb)
  const guardedStorageOptions = {
    prepareMetadata: prepareAvalonMetadata,
    getStaleMetadataError: getStaleJoinError,
  }
  const guardedStorage = trackedStorage.storage.type() === 0
    ? createDeletionSafeStorage(
      trackedStorage.storage as StorageAPI.Sync,
      guardedStorageOptions,
    )
    : createDeletionSafeStorage(
      trackedStorage.storage as StorageAPI.Async,
      guardedStorageOptions,
    )
  const db = guardedStorage.storage as StorageAPI.Sync | StorageAPI.Async
  const boardgame = createBoardgameServer({
    games: [
      createAvalonGame({
        identityRecognitionDeadlineEnabled:
          options.identityRecognitionDeadlineEnabled,
        identityRecognitionStepMs: options.identityRecognitionStepMs,
        now: options.identityRecognitionNow,
        seed: options.gameSeed ?? config.testGameSeed,
        serverInstanceID: options.serverInstanceID ?? randomUUID(),
      }) as unknown as BoardgameGame,
    ],
    db,
    transport: new AvalonSocketIO(),
    authenticateCredentials: (credentials, playerMetadata) =>
      secretMatches(credentials, playerMetadata?.credentials),
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
    forceUpdateMetadata: guardedStorage.forceUpdateMetadata,
    deletionGuard: guardedStorage.deletionGuard,
    registry,
    queues: boardgame.transport,
    unavailableMatchIDs: guardedStorage.deletionGuard.unavailableMatchIDs,
  })
  registerRoomParticipationRoutes(boardgame.router, {
    db,
    forceUpdateMetadata: guardedStorage.forceUpdateMetadata,
    deletionGuard: guardedStorage.deletionGuard,
    registry,
    queues: boardgame.transport,
  })
  registerRoomSessionValidationRoute(boardgame.router, db)
  installAvalonHTTPBoundary(boardgame.router)

  return {
    boardgame,
    config,
    db: rawDb,
    waitForStorageIdle: trackedStorage.waitForIdle,
  }
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
  const { boardgame, config, db, waitForStorageIdle } = createAvalonServer(options)
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

      const serverClosePromises = [servers.apiServer, servers.appServer]
        .filter((server) => server !== undefined && server.listening)
        .map((server) => new Promise<void>((resolve) => {
          server.once('close', resolve)
        }))
      boardgame.kill(servers)
      const closableStorage = db as ClosableStorage
      closePromise = Promise.all(serverClosePromises)
        .then(waitForStorageIdle)
        .then(() => closableStorage.close?.())
        .then(() => undefined)
      await closePromise
    },
  }
}
