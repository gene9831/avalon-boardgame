import { z } from 'zod'

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

export const AvalonCreateRoomRequestSchema = z.object({
  numPlayers: z.number().int().min(5).max(10),
}).strict()

export const AvalonJoinRoomRequestSchema = z.object({
  playerID: AvalonSeatIDSchema,
  playerName: AvalonPlayerNameSchema,
  data: z.object({
    avatarID: AvalonPlayerAvatarIDSchema,
    clientID: AvalonClientIDSchema,
    sessionID: AvalonPublicSessionIDSchema,
  }).strict(),
}).strict()

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
  gameover: z.boolean().optional(),
  createdAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
})

export type AvalonMatchID = z.infer<typeof AvalonMatchIDSchema>
export type AvalonSeatID = z.infer<typeof AvalonSeatIDSchema>
export type AvalonPlayerAvatarID = z.infer<typeof AvalonPlayerAvatarIDSchema>
export type AvalonCreateRoomRequest = z.infer<typeof AvalonCreateRoomRequestSchema>
export type AvalonJoinRoomRequest = z.infer<typeof AvalonJoinRoomRequestSchema>
export type AvalonRoomDetail = z.infer<typeof AvalonRoomDetailSchema>

export function parseAvalonCreateRoomRequest(value: unknown) {
  return AvalonCreateRoomRequestSchema.parse(value)
}

export function parseAvalonJoinRoomRequest(value: unknown) {
  return AvalonJoinRoomRequestSchema.parse(value)
}

export function parseAvalonRoomDetail(value: unknown) {
  return AvalonRoomDetailSchema.parse(value)
}
