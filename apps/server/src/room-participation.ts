import { koaBody } from 'koa-body'

import {
  AvalonMatchIDSchema,
  AvalonSeatChangeRequestSchema,
  AvalonSeatIDSchema,
} from '@avalon/game'

import { respondWithRequestFailure } from './http-boundary'
import {
  AvalonLobbyError,
  type RoomLobbyService,
} from './room-lobby'
import { readBearerCredential } from './session-validation'

type RouteContext = {
  body?: unknown
  params: Record<string, string>
  request: { body?: unknown }
  status: number
  get(name: string): string
}

type RouteHandler = (ctx: RouteContext) => Promise<void>

interface RoomParticipationContext {
  lobby: RoomLobbyService
}

const parseJSONBody = koaBody({
  formLimit: '16kb',
  jsonLimit: '16kb',
  multipart: false,
  text: false,
  textLimit: '16kb',
  urlencoded: false,
}) as unknown as RouteHandler

function invalidRequest() {
  return new AvalonLobbyError(400, 'invalid_request', 'Invalid Avalon request')
}

function validatedPath(ctx: RouteContext) {
  const matchID = AvalonMatchIDSchema.safeParse(ctx.params.matchID)
  const playerID = AvalonSeatIDSchema.safeParse(ctx.params.playerID)
  if (!matchID.success || !playerID.success) throw invalidRequest()
  return { matchID: matchID.data, playerID: playerID.data }
}

function credential(ctx: RouteContext) {
  return readBearerCredential(ctx.get('authorization'))
}

async function handle(
  ctx: RouteContext,
  action: () => Promise<void>,
) {
  try {
    await action()
  } catch (error) {
    respondWithRequestFailure(ctx, error)
  }
}

export function registerRoomParticipationRoutes(
  router: {
    delete(path: string, handler: RouteHandler): void
    post?(path: string, ...middleware: RouteHandler[]): void
  },
  context: RoomParticipationContext,
) {
  router.post?.(
    '/rooms/avalon/:matchID/players/:playerID/seat',
    parseJSONBody,
    async (ctx) => handle(ctx, async () => {
      const { matchID, playerID } = validatedPath(ctx)
      const parsed = AvalonSeatChangeRequestSchema.safeParse(ctx.request.body)
      if (!parsed.success) throw invalidRequest()
      ctx.body = await context.lobby.changeSeat(
        matchID,
        playerID,
        credential(ctx),
        parsed.data.targetPlayerID,
      )
      ctx.status = 200
    }),
  )

  router.post?.(
    '/rooms/avalon/:matchID/players/:playerID/prepare-start',
    async (ctx) => handle(ctx, async () => {
      const { matchID, playerID } = validatedPath(ctx)
      await context.lobby.prepareStart(matchID, playerID, credential(ctx))
      ctx.status = 204
    }),
  )

  router.delete('/rooms/avalon/:matchID/players/:playerID', async (ctx) =>
    handle(ctx, async () => {
      const { matchID, playerID } = validatedPath(ctx)
      await context.lobby.leaveRoom(matchID, playerID, credential(ctx))
      ctx.status = 204
    }),
  )

  router.delete('/rooms/avalon/:matchID', async (ctx) =>
    handle(ctx, async () => {
      const matchID = AvalonMatchIDSchema.safeParse(ctx.params.matchID)
      if (!matchID.success) throw invalidRequest()
      await context.lobby.dissolveRoom(
        matchID.data,
        '',
        credential(ctx),
      )
      ctx.status = 204
    }),
  )
}
