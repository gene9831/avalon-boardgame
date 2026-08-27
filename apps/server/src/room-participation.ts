import { randomUUID } from 'node:crypto'

import type { Server, State, StorageAPI } from 'boardgame.io'

import { AvalonSocketRegistry } from './dev-admin'
import { secretMatches } from './secret'
import { readBearerCredential } from './session-validation'
import type { MatchDeletionGuard } from './storage/deletion-safe'

type MatchQueue = { add<T>(task: () => Promise<T>): Promise<T> }

type RouteContext = {
  params: Record<string, string>
  status: number
  get(name: string): string
  throw(status: number, message?: string): never
}

interface RoomParticipationContext {
  db: StorageAPI.Sync | StorageAPI.Async
  forceUpdateMetadata(
    matchID: string,
    update: (metadata: Server.MatchData) => void,
  ): Server.MatchData | undefined | Promise<Server.MatchData | undefined>
  deletionGuard: MatchDeletionGuard
  registry: AvalonSocketRegistry
  queues: { getMatchQueue(matchID: string): MatchQueue }
}

async function fetchMatch(db: StorageAPI.Sync | StorageAPI.Async, matchID: string) {
  return (db as StorageAPI.Async).fetch(matchID, { metadata: true, state: true })
}

function getCredential(ctx: RouteContext) {
  return readBearerCredential(ctx.get('authorization'))
}

function normalizePlayerID(ctx: RouteContext, playerID: string) {
  const numericPlayerID = Number(playerID)
  if (!Number.isInteger(numericPlayerID) || numericPlayerID < 0) ctx.throw(403)
  return String(numericPlayerID)
}

function getPlayer(
  metadata: Server.MatchData,
  playerID: string,
) {
  const numericPlayerID = Number(playerID)
  return Number.isInteger(numericPlayerID)
    ? metadata.players[numericPlayerID]
    : undefined
}

function authenticatePlayer(
  ctx: RouteContext,
  metadata: Server.MatchData,
  playerID: string,
  credential: string,
) {
  const player = getPlayer(metadata, playerID)
  if (
    player === undefined ||
    player.name === undefined ||
    !secretMatches(credential, player.credentials)
  ) {
    ctx.throw(403)
  }
  return player
}

function requireWaitingRoom(ctx: RouteContext, state: State) {
  if ((state.G as { status?: string }).status !== 'lobby') ctx.throw(409)
}

export function registerRoomParticipationRoutes(
  router: {
    delete(path: string, handler: (ctx: RouteContext) => Promise<void>): void
  },
  context: RoomParticipationContext,
) {
  router.delete('/rooms/avalon/:matchID/players/:playerID', async (ctx) => {
    const { matchID, playerID } = ctx.params
    const normalizedPlayerID = normalizePlayerID(ctx, playerID)
    const credential = getCredential(ctx)

    await context.queues.getMatchQueue(matchID).add(async () => {
      const { metadata, state } = await fetchMatch(context.db, matchID)
      if (metadata === undefined || state === undefined) ctx.throw(404)
      requireWaitingRoom(ctx, state)
      authenticatePlayer(ctx, metadata, normalizedPlayerID, credential)
      if (normalizedPlayerID === '0') ctx.throw(409)

      const updatedMetadata = await context.forceUpdateMetadata(matchID, (currentMetadata) => {
        const player = authenticatePlayer(ctx, currentMetadata, normalizedPlayerID, credential)
        delete player.name
        delete player.data
        player.isConnected = false
        player.credentials = randomUUID()
      })
      if (updatedMetadata === undefined) ctx.throw(404)
      context.registry.disconnectPlayer(matchID, normalizedPlayerID)
    })

    ctx.status = 204
  })

  router.delete('/rooms/avalon/:matchID', async (ctx) => {
    const { matchID } = ctx.params
    const credential = getCredential(ctx)

    await context.queues.getMatchQueue(matchID).add(async () => {
      const { metadata, state } = await fetchMatch(context.db, matchID)
      if (metadata === undefined || state === undefined) ctx.throw(404)
      requireWaitingRoom(ctx, state)
      authenticatePlayer(ctx, metadata, '0', credential)

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
}
