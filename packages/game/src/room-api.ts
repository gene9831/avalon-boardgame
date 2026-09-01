import { z } from 'zod'

import {
  DEFAULT_ROLE_CONFIGURATION,
} from './types'

const URL_SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/

export const AVALON_PLAYER_AVATAR_IDS = [
  'assassin',
  'loyal-servant',
  'merlin',
  'minion-of-mordred',
  'mordred',
  'morgana',
  'oberon',
  'percival',
] as const

export const AvalonMatchIDSchema = z.string()
  .min(1)
  .max(128)
  .regex(URL_SAFE_ID_PATTERN)

export const AvalonSeatIDSchema = z.enum([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
])

export const AvalonClientIDSchema = z.string()
  .min(1)
  .max(128)
  .regex(URL_SAFE_ID_PATTERN)

export const AvalonPublicSessionIDSchema = z.string()
  .min(1)
  .max(128)
  .regex(URL_SAFE_ID_PATTERN)

export const AvalonPlayerAvatarIDSchema = z.enum(AVALON_PLAYER_AVATAR_IDS)

export const AvalonPlayerNameSchema = z.string()
  .transform((name) => name.trim().normalize('NFC'))
  .pipe(
    z.string()
      .min(1)
      .max(24)
      .refine((name) => !CONTROL_CHARACTER_PATTERN.test(name)),
  )

export const AvalonRoleConfigurationSchema = z.object({
  percivalMorgana: z.boolean(),
}).strict()

const AvalonRoomProfileSchema = z.object({
  playerName: AvalonPlayerNameSchema,
  data: z.object({
    avatarID: AvalonPlayerAvatarIDSchema,
    clientID: AvalonClientIDSchema,
    sessionID: AvalonPublicSessionIDSchema,
  }).strict(),
})

export const AvalonCreateRoomRequestSchema = AvalonRoomProfileSchema.extend({
  numPlayers: z.number().int().min(5).max(10),
  roleConfiguration: AvalonRoleConfigurationSchema.default(
    DEFAULT_ROLE_CONFIGURATION,
  ),
}).strict()

export const AvalonJoinRoomRequestSchema = AvalonRoomProfileSchema.strict()

export const AvalonSeatChangeRequestSchema = z.object({
  targetPlayerID: AvalonSeatIDSchema,
}).strict()

export const AvalonRoomSessionResponseSchema = z.object({
  matchID: AvalonMatchIDSchema,
  playerID: AvalonSeatIDSchema,
  playerCredentials: z.string().min(1),
}).strict()

export const AVALON_LOBBY_ERROR_CODES = [
  'room_full',
  'room_not_joinable',
  'room_not_found',
  'client_already_joined',
  'seat_unavailable',
  'invalid_seat_session',
  'not_room_owner',
  'owner_must_dissolve',
] as const

const AvalonRoomDetailPlayerSchema = z.object({
  id: z.number().int().min(0).max(9),
  name: z.string().optional(),
  isConnected: z.boolean().optional(),
  data: z.object({
    avatarID: AvalonPlayerAvatarIDSchema.optional(),
    sessionID: AvalonPublicSessionIDSchema.optional(),
  }).optional(),
})

export const AvalonRoomDetailSchema = z.object({
  matchID: AvalonMatchIDSchema,
  gameName: z.literal('avalon'),
  players: z.array(AvalonRoomDetailPlayerSchema).min(5).max(10),
  setupData: z.object({
    numPlayers: z.number().int().min(5).max(10),
  }),
  authorityVersion: z.literal(1),
  ownerPlayerID: AvalonSeatIDSchema.nullable(),
  occupiedPlayerIDs: z.array(AvalonSeatIDSchema),
  roleConfiguration: AvalonRoleConfigurationSchema,
  gameover: z.boolean().optional(),
  createdAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
}).superRefine((room, context) => {
  const issue = getAvalonRoomAuthorityIssue(room)

  if (issue !== null) {
    context.addIssue({
      code: 'custom',
      message: issue,
      path: ['ownerPlayerID'],
    })
  }
})

export type AvalonMatchID = z.infer<typeof AvalonMatchIDSchema>
export type AvalonSeatID = z.infer<typeof AvalonSeatIDSchema>
export type AvalonPlayerAvatarID = z.infer<typeof AvalonPlayerAvatarIDSchema>
export type AvalonCreateRoomRequest = z.infer<typeof AvalonCreateRoomRequestSchema>
export type AvalonJoinRoomRequest = z.infer<typeof AvalonJoinRoomRequestSchema>
export type AvalonSeatChangeRequest = z.infer<typeof AvalonSeatChangeRequestSchema>
export type AvalonRoomSessionResponse = z.infer<
  typeof AvalonRoomSessionResponseSchema
>
export type AvalonLobbyErrorCode = typeof AVALON_LOBBY_ERROR_CODES[number]
export type AvalonRoomDetail = z.infer<typeof AvalonRoomDetailSchema>

export function getAvalonRoomAuthorityIssue(
  room: Pick<AvalonRoomDetail, 'ownerPlayerID' | 'occupiedPlayerIDs'>,
  ownerlessAllowed = true,
): string | null {
  if (room.ownerPlayerID === null) {
    if (!ownerlessAllowed) {
      return 'Ownerless rooms must be in the lobby'
    }

    return room.occupiedPlayerIDs.includes('0')
      ? 'Ownerless legacy rooms must leave seat 0 empty'
      : null
  }

  return room.occupiedPlayerIDs.includes(room.ownerPlayerID)
    ? null
    : 'Room owner must occupy the owner seat'
}

export function parseAvalonCreateRoomRequest(value: unknown) {
  return AvalonCreateRoomRequestSchema.parse(value)
}

export function parseAvalonJoinRoomRequest(value: unknown) {
  return AvalonJoinRoomRequestSchema.parse(value)
}

export function parseAvalonSeatChangeRequest(value: unknown) {
  return AvalonSeatChangeRequestSchema.parse(value)
}

export function parseAvalonRoomSessionResponse(value: unknown) {
  return AvalonRoomSessionResponseSchema.parse(value)
}

export function parseAvalonRoomDetail(value: unknown) {
  return AvalonRoomDetailSchema.parse(value)
}
