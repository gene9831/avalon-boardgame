import { z } from 'zod'

export const AvalonRoomStatusSchema = z.enum([
  'lobby',
  'playing',
  'finished',
])

export const AvalonRoomPlayerSummarySchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().optional(),
  isConnected: z.boolean(),
})

export const AvalonRoomSummarySchema = z.object({
  matchID: z.string().min(1),
  status: AvalonRoomStatusSchema,
  players: z.array(AvalonRoomPlayerSummarySchema),
  createdAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
}).superRefine((room, context) => {
  const playerIDs = new Set<number>()

  room.players.forEach((player, index) => {
    if (playerIDs.has(player.id)) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate player ID',
        path: ['players', index, 'id'],
      })
    }
    playerIDs.add(player.id)
  })
})

export const AvalonRoomDirectoryResponseSchema = z.object({
  rooms: z.array(AvalonRoomSummarySchema),
}).superRefine((directory, context) => {
  const matchIDs = new Set<string>()

  directory.rooms.forEach((room, index) => {
    if (matchIDs.has(room.matchID)) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate match ID',
        path: ['rooms', index, 'matchID'],
      })
    }
    matchIDs.add(room.matchID)
  })
})

export type AvalonRoomStatus = z.infer<typeof AvalonRoomStatusSchema>
export type AvalonRoomPlayerSummary = z.infer<
  typeof AvalonRoomPlayerSummarySchema
>
export type AvalonRoomSummary = z.infer<typeof AvalonRoomSummarySchema>
export type AvalonRoomDirectoryResponse = z.infer<
  typeof AvalonRoomDirectoryResponseSchema
>

export function parseAvalonRoomDirectoryResponse(
  value: unknown,
): AvalonRoomDirectoryResponse {
  return AvalonRoomDirectoryResponseSchema.parse(value)
}
