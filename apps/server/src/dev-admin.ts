import { randomUUID } from 'node:crypto'

import type { Server, StorageAPI } from 'boardgame.io'

import type { AvalonServerConfig } from './config'
import {
  listAvalonRoomSummaries,
  toAvalonRoomSummary,
} from './room-directory'

type MatchQueue = { add<T>(task: () => Promise<T>): Promise<T> }
type SocketLike = { id: string; disconnect(close?: boolean): void; on(event: string, listener: (...args: any[]) => void): void }
type NamespaceLike = { on(event: string, listener: (socket: SocketLike) => void): void }

export class AvalonSocketRegistry {
  private readonly sockets = new Map<string, { matchID: string; playerID: string; socket: SocketLike }>()

  attach(namespace: NamespaceLike) {
    namespace.on('connection', (socket) => {
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
  if (authorization !== `Bearer ${config.devAdminToken}`) ctx.throw(401)
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
      context.unavailableMatchIDs.add(matchID)
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
      const updatedMetadata: Server.MatchData = structuredClone(metadata)
      const updatedPlayer = updatedMetadata.players[numericPlayerID]
      delete updatedPlayer.name
      delete updatedPlayer.data
      updatedPlayer.isConnected = false
      updatedPlayer.credentials = randomUUID()
      await context.db.setMetadata(matchID, updatedMetadata)
      context.registry.disconnectPlayer(matchID, playerID)
      return toAvalonRoomSummary(matchID, updatedMetadata, state)
    })
    ctx.body = summary
  })
}
