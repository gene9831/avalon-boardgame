import { randomUUID } from 'node:crypto'

import type { Server, StorageAPI } from 'boardgame.io'

import type { AvalonServerConfig } from './config'
import {
  listAvalonRoomSummaries,
  toAvalonRoomSummary,
} from './room-directory'
import type { MatchDeletionGuard } from './storage/deletion-safe'
import { secretMatches } from './secret'

type MatchQueue = { add<T>(task: () => Promise<T>): Promise<T> }
type SocketListener = (...args: never[]) => unknown
type SocketLike = {
  id: string
  conn?: { close(): void }
  disconnect(close?: boolean): void
  listeners(event: string): SocketListener[]
  on(event: string, listener: SocketListener): void
  removeListener(event: string, listener: SocketListener): void
}
type NamespaceLike = { on(event: string, listener: (socket: SocketLike) => void): void }

const BOARDGAME_SOCKET_EVENTS = ['update', 'sync', 'disconnect'] as const

function handleSocketRequestError(
  socket: SocketLike,
  event: string,
  error: unknown,
) {
  const normalizedError = error instanceof Error ? error : new Error(String(error))
  const code = (normalizedError as NodeJS.ErrnoException).code
  console.error('Socket.IO request failed', {
    event,
    code: code ?? 'socket_request_failed',
  })

  if (socket.conn !== undefined) {
    socket.conn.close()
  } else {
    socket.disconnect(true)
  }
}

function wrapSocketRequestListeners(socket: SocketLike) {
  for (const event of BOARDGAME_SOCKET_EVENTS) {
    for (const listener of socket.listeners(event)) {
      socket.removeListener(event, listener)
      socket.on(event, (...args: unknown[]) => {
        const invoke = listener as (...listenerArgs: unknown[]) => unknown
        try {
          return Promise.resolve(invoke.apply(socket, args)).catch((error: unknown) => {
            handleSocketRequestError(socket, event, error)
          })
        } catch (error) {
          handleSocketRequestError(socket, event, error)
        }
      })
    }
  }
}

export class AvalonSocketRegistry {
  private readonly sockets = new Map<string, { matchID: string; playerID: string; socket: SocketLike }>()

  attach(namespace: NamespaceLike) {
    namespace.on('connection', (socket) => {
      // boardgame.io registers its request listeners before this registry is attached.
      wrapSocketRequestListeners(socket)
      let tracked: { matchID: string; playerID: string } | undefined
      socket.on('sync', (matchID: string, playerID: string) => {
        tracked = { matchID, playerID }
        this.sockets.set(socket.id, { ...tracked, socket })
      })
      socket.on('disconnect', () => {
        this.sockets.delete(socket.id)
      })
    })
  }

  disconnectMatch(matchID: string) {
    this.disconnectWhere((entry) => entry.matchID === matchID)
  }

  disconnectPlayer(matchID: string, playerID: string) {
    this.disconnectWhere((entry) => entry.matchID === matchID && entry.playerID === playerID)
  }

  private disconnectWhere(predicate: (entry: { matchID: string; playerID: string }) => boolean) {
    for (const [socketID, entry] of this.sockets) {
      if (predicate(entry)) {
        this.sockets.delete(socketID)
        entry.socket.disconnect(true)
      }
    }
  }
}

interface AdminContext {
  config: AvalonServerConfig
  db: StorageAPI.Sync | StorageAPI.Async
  forceUpdateMetadata(
    matchID: string,
    update: (metadata: Server.MatchData) => void,
  ): Server.MatchData | undefined | Promise<Server.MatchData | undefined>
  deletionGuard: MatchDeletionGuard
  registry: AvalonSocketRegistry
  queues: { getMatchQueue(matchID: string): MatchQueue }
  unavailableMatchIDs: Set<string>
}

type RouteContext = {
  params: Record<string, string>
  status: number
  body: unknown
  get(name: string): string
  throw(status: number, message?: string): never
}

function authenticate(ctx: RouteContext, config: AvalonServerConfig) {
  if (!config.devToolsEnabled || config.devAdminToken === undefined) {
    ctx.throw(404)
  }
  const authorization = ctx.get('authorization')
  const providedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : ''
  if (!secretMatches(providedToken, config.devAdminToken)) ctx.throw(401)
}

async function fetchMatch(db: StorageAPI.Sync | StorageAPI.Async, matchID: string) {
  return (db as StorageAPI.Async).fetch(matchID, { metadata: true, state: true })
}

export function registerDevAdminRoutes(
  router: { get(path: string, handler: (ctx: RouteContext) => Promise<void>): void; delete(path: string, handler: (ctx: RouteContext) => Promise<void>): void },
  context: AdminContext,
) {
  router.get('/rooms/avalon', async (ctx) => {
    ctx.body = { rooms: await listAvalonRoomSummaries(context.db, context.unavailableMatchIDs) }
  })

  router.get('/dev/status', async (ctx) => {
    ctx.body = { enabled: context.config.devToolsEnabled }
  })

  router.get('/dev/rooms/:matchID', async (ctx) => {
    ctx.throw(404)
  })

  router.delete('/dev/rooms/:matchID', async (ctx) => {
    authenticate(ctx, context.config)
    const matchID = ctx.params.matchID
    await context.queues.getMatchQueue(matchID).add(async () => {
      context.deletionGuard.markMatchDeleted(matchID)
      context.registry.disconnectMatch(matchID)
      try {
        await context.db.wipe(matchID)
      } catch (error) {
        if (!String(error).toLowerCase().includes('not found')) throw error
      }
    })
    ctx.status = 204
  })

  router.delete('/dev/rooms/:matchID/players/:playerID', async (ctx) => {
    authenticate(ctx, context.config)
    const { matchID, playerID } = ctx.params
    const summary = await context.queues.getMatchQueue(matchID).add(async () => {
      const { metadata, state } = await fetchMatch(context.db, matchID)
      if (metadata === undefined || state === undefined) ctx.throw(404)
      if ((state.G as { status?: string }).status !== 'lobby') ctx.throw(409)
      const numericPlayerID = Number(playerID)
      const player = metadata.players[numericPlayerID]
      if (player === undefined || player.name === undefined) ctx.throw(409)
      const updatedMetadata = await context.forceUpdateMetadata(matchID, (currentMetadata) => {
        const updatedPlayer = currentMetadata.players[numericPlayerID]
        if (updatedPlayer === undefined || updatedPlayer.name === undefined) ctx.throw(409)
        delete updatedPlayer.name
        delete updatedPlayer.data
        updatedPlayer.isConnected = false
        updatedPlayer.credentials = randomUUID()
      })
      if (updatedMetadata === undefined) {
        ctx.throw(404)
        throw new Error('unreachable')
      }
      context.registry.disconnectPlayer(matchID, playerID)
      return toAvalonRoomSummary(matchID, updatedMetadata, state)
    })
    ctx.body = summary
  })
}
