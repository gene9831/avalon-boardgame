import type { StorageAPI } from 'boardgame.io'

import { secretMatches } from './secret'

type RouteContext = {
  params: Record<string, string>
  status: number
  get(name: string): string
  throw(status: number, message?: string): never
}

export function readBearerCredential(authorization: string) {
  const prefix = 'Bearer '
  return authorization.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : ''
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
      !secretMatches(credential, player.credentials)
    ) {
      ctx.throw(403)
    }

    ctx.status = 204
  })
}
