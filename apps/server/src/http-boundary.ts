import { koaBody } from 'koa-body'
import type { StorageAPI } from 'boardgame.io'

import {
  AvalonCreateRoomRequestSchema,
  AvalonJoinRoomRequestSchema,
  AvalonMatchIDSchema,
  parseAvalonRoomDetail,
  type AvalonLobbyErrorCode,
} from '@avalon/game'

import {
  AvalonLobbyError,
  getPublicLobbyAuthority,
  type RoomLobbyService,
} from './room-lobby'

const HTTP_BODY_LIMIT = '16kb'

type Next = () => Promise<unknown>
type RouteMiddleware = (ctx: RouteContext, next: Next) => unknown
type RegisterRoute = (path: string, ...middleware: unknown[]) => unknown

interface RouteContext {
  body?: unknown
  params: Record<string, string>
  request: { body?: unknown }
  status: number
}

interface MutableRouter {
  get: RegisterRoute
  post: RegisterRoute
}

type ErrorCode =
  | AvalonLobbyErrorCode
  | 'conflict'
  | 'forbidden'
  | 'internal_error'
  | 'invalid_request'
  | 'not_found'
  | 'payload_too_large'
  | 'service_unavailable'
  | 'seat_unavailable'

const TEMPORARY_FAILURE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
])

const parseJSONBody = koaBody({
  formLimit: HTTP_BODY_LIMIT,
  jsonLimit: HTTP_BODY_LIMIT,
  multipart: false,
  text: false,
  textLimit: HTTP_BODY_LIMIT,
  urlencoded: false,
}) as unknown as RouteMiddleware

function errorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null) return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown }
  if (typeof candidate.status === 'number') return candidate.status
  return typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : ''
}

function safeErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return 'unexpected_error'
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code)
    ? code
    : 'unexpected_error'
}

function respondWithError(
  ctx: RouteContext,
  status: number,
  code: ErrorCode,
  message: string,
) {
  ctx.status = status
  ctx.body = { error: { code, message } }
}

export function respondWithRequestFailure(ctx: RouteContext, error: unknown) {
  if (error instanceof AvalonLobbyError) {
    respondWithError(ctx, error.status, error.code, error.message)
    return
  }
  const status = errorStatus(error)
  const message = errorMessage(error)

  if (status === 413 || message.toLowerCase().includes('entity too large')) {
    respondWithError(ctx, 413, 'payload_too_large', 'Request body exceeds 16 KiB')
    return
  }
  if (status === 404) {
    respondWithError(ctx, 404, 'not_found', 'Room not found')
    return
  }
  if (status === 409 && /^Player \d+ not available$/.test(message)) {
    respondWithError(ctx, 409, 'seat_unavailable', 'Seat is unavailable')
    return
  }
  if (status === 409 && message === 'Client has already joined this match') {
    respondWithError(ctx, 409, 'client_already_joined', 'Client has already joined this room')
    return
  }
  if (status === 409) {
    respondWithError(ctx, 409, 'conflict', 'Room state has changed')
    return
  }
  if (status === 403) {
    respondWithError(ctx, 403, 'forbidden', 'Request is not authorized')
    return
  }
  if (status === 400) {
    respondWithError(ctx, 400, 'invalid_request', 'Invalid Avalon request')
    return
  }

  const code = safeErrorCode(error)
  console.error('Avalon HTTP request failed', {
    event: 'lobby_request',
    code,
  })
  if (
    TEMPORARY_FAILURE_CODES.has(code) ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    respondWithError(
      ctx,
      503,
      'service_unavailable',
      'Service temporarily unavailable',
    )
    return
  }

  respondWithError(ctx, 500, 'internal_error', 'Internal server error')
}

function createValidatedBodyMiddleware(
  schema: typeof AvalonCreateRoomRequestSchema | typeof AvalonJoinRoomRequestSchema,
): RouteMiddleware {
  return async (ctx, next) => {
    try {
      await parseJSONBody(ctx, async () => undefined)
      const parsed = schema.safeParse(ctx.request.body)
      if (!parsed.success) {
        respondWithError(ctx, 400, 'invalid_request', 'Invalid Avalon request')
        return
      }
      ctx.request.body = parsed.data
      await next()
    } catch (error) {
      respondWithRequestFailure(ctx, error)
    }
  }
}

const createRoom: RouteMiddleware = createValidatedBodyMiddleware(
  AvalonCreateRoomRequestSchema,
)

const joinRoom: RouteMiddleware = async (ctx, next) => {
  if (!AvalonMatchIDSchema.safeParse(ctx.params.id).success) {
    respondWithError(ctx, 400, 'invalid_request', 'Invalid Avalon request')
    return
  }
  await createValidatedBodyMiddleware(AvalonJoinRoomRequestSchema)(ctx, next)
}

interface HTTPBoundaryDependencies {
  db: StorageAPI.Sync | StorageAPI.Async
  lobby: RoomLobbyService
}

function createRoomHandler(lobby: RoomLobbyService): RouteMiddleware {
  return async (ctx) => {
    ctx.body = await lobby.createRoomAndJoin(
      AvalonCreateRoomRequestSchema.parse(ctx.request.body),
    )
  }
}

function joinRoomHandler(lobby: RoomLobbyService): RouteMiddleware {
  return async (ctx) => {
    ctx.body = await lobby.joinRoom(
      ctx.params.id,
      AvalonJoinRoomRequestSchema.parse(ctx.request.body),
    )
  }
}

function roomDetailHandler(
  db: StorageAPI.Sync | StorageAPI.Async,
): RouteMiddleware {
  return async (ctx) => {
    try {
      const { metadata, state } = await (db as StorageAPI.Async).fetch(
        ctx.params.id,
        { metadata: true, state: true },
      )
      if (metadata === undefined || state === undefined) {
        throw new AvalonLobbyError(404, 'room_not_found', 'Room not found')
      }
      const authority = getPublicLobbyAuthority(state, metadata)
      ctx.body = parseAvalonRoomDetail({
        matchID: ctx.params.id,
        gameName: metadata.gameName,
        players: Object.values(metadata.players).map((player) => {
          const data = typeof player.data === 'object' && player.data !== null
            ? player.data as Record<string, unknown>
            : {}
          return {
            id: player.id,
            ...(player.name === undefined ? {} : { name: player.name }),
            ...(player.isConnected === true ? { isConnected: true } : {}),
            ...(data.avatarID === undefined && data.sessionID === undefined
              ? {}
              : {
                data: {
                  ...(data.avatarID === undefined ? {} : { avatarID: data.avatarID }),
                  ...(data.sessionID === undefined ? {} : { sessionID: data.sessionID }),
                },
              }),
          }
        }),
        setupData: { numPlayers: Object.keys(metadata.players).length },
        ...authority,
        ...(metadata.gameover === undefined ? {} : { gameover: true }),
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      })
    } catch (error) {
      respondWithRequestFailure(ctx, error)
    }
  }
}

const routeNotFound: RouteMiddleware = (ctx) => {
  respondWithError(ctx, 404, 'not_found', 'Route not found')
}

function onlyHandler(middleware: unknown[], path: string) {
  if (middleware.length !== 2) {
    throw new Error(`Unsupported boardgame.io Lobby route contract: ${path}`)
  }
  return middleware[1]
}

export function installAvalonHTTPBoundary(
  routerValue: unknown,
  dependencies: HTTPBoundaryDependencies,
) {
  const router = routerValue as MutableRouter
  const registerGet = router.get.bind(router)
  const registerPost = router.post.bind(router)

  router.get = ((path: string, ...middleware: unknown[]) => {
    if (path === '/games' || path === '/games/:name') {
      return registerGet(path, routeNotFound)
    }
    if (path === '/games/:name/:id') {
      if (middleware.length !== 1) {
        throw new Error(`Unsupported boardgame.io Lobby route contract: ${path}`)
      }
      return registerGet(path, async (ctx: RouteContext, next: Next) => {
        if (ctx.params.name !== 'avalon') {
          routeNotFound(ctx, next)
          return
        }
        if (!AvalonMatchIDSchema.safeParse(ctx.params.id).success) {
          respondWithError(ctx, 400, 'invalid_request', 'Invalid Avalon request')
          return
        }
        await roomDetailHandler(dependencies.db)(ctx, next)
      })
    }
    throw new Error(`Unsupported boardgame.io Lobby GET route: ${path}`)
  }) as RegisterRoute

  router.post = ((path: string, ...middleware: unknown[]) => {
    if (path === '/games/:name/create') {
      onlyHandler(middleware, path)
      return registerPost(path, async (ctx: RouteContext, next: Next) => {
        if (ctx.params.name !== 'avalon') {
          routeNotFound(ctx, next)
          return
        }
        await createRoom(ctx, next)
      }, createRoomHandler(dependencies.lobby))
    }
    if (path === '/games/:name/:id/join') {
      onlyHandler(middleware, path)
      return registerPost(path, async (ctx: RouteContext, next: Next) => {
        if (ctx.params.name !== 'avalon') {
          routeNotFound(ctx, next)
          return
        }
        await joinRoom(ctx, next)
      }, joinRoomHandler(dependencies.lobby))
    }
    if (
      path === '/games/:name/:id/leave' ||
      path === '/games/:name/:id/playAgain' ||
      path === '/games/:name/:id/rename' ||
      path === '/games/:name/:id/update'
    ) {
      return registerPost(path, routeNotFound)
    }
    throw new Error(`Unsupported boardgame.io Lobby POST route: ${path}`)
  }) as RegisterRoute
}
