import { timingSafeEqual } from 'node:crypto'

import type { StorageAPI } from 'boardgame.io'

type RouteContext = {
  params: Record<string, string>
  status: number
  get(name: string): string
  throw(status: number, message?: string): never
}

function readBearerCredential(authorization: string) {
  const prefix = 'Bearer '
  return authorization.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : ''
}

function credentialsMatch(provided: string, stored: string | undefined) {
  if (provided.length === 0 || stored === undefined) return false

  const providedBytes = Buffer.from(provided)
  const storedBytes = Buffer.from(stored)
  return providedBytes.length === storedBytes.length && timingSafeEqual(providedBytes, storedBytes)
}

export function registerRoomSessionValidationRoute(
  router: {
    post(path: string, handler: (ctx: RouteContext) => Promise<void>): void
  },
  db: StorageAPI.Sync | StorageAPI.Async,
) {
  router.post('/rooms/avalon/:matchID/players/:playerID/session', async (ctx) => {
    const { matchID, playerID } = ctx.params
    const { metadata } = await (db as StorageAPI.Async).fetch(matchID, {
      metadata: true,
    })
    if (metadata === undefined) ctx.throw(404)

    const numericPlayerID = Number(playerID)
    const player = Number.isInteger(numericPlayerID)
      ? metadata.players[numericPlayerID]
      : undefined
    const credential = readBearerCredential(ctx.get('authorization'))
    if (
      player === undefined ||
      player.name === undefined ||
      !credentialsMatch(credential, player.credentials)
    ) {
      ctx.throw(403)
    }

    ctx.status = 204
  })
}
