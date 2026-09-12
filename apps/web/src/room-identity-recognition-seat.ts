import type { PlayerID } from '@avalon/game'

import type { RoomIdentityRecognitionPresentation } from './RoomIdentityRecognition'
import type { RoomPlayerPresentation } from './room-screen-props'

export type RoomPlayerSeatRecognition =
  | Readonly<{ state: 'dimmed' }>
  | Readonly<{ state: 'self'; label: '你' }>
  | Readonly<{
      state: 'target'
      label: '同伴' | '邪恶' | '候选人'
      tone: 'ally' | 'evil' | 'candidate'
    }>

const TARGET_MARKERS = {
  'evil-allies': { label: '同伴', state: 'target', tone: 'ally' },
  'merlin-evil': { label: '邪恶', state: 'target', tone: 'evil' },
  'percival-candidates': { label: '候选人', state: 'target', tone: 'candidate' },
} as const satisfies Record<
  Exclude<RoomIdentityRecognitionPresentation['scene']['type'], 'none'>,
  RoomPlayerSeatRecognition
>

export function getRoomIdentityRecognitionSeat(
  presentation: RoomIdentityRecognitionPresentation,
  playerID: PlayerID,
  isCurrentPlayer: boolean,
): RoomPlayerSeatRecognition | undefined {
  if (presentation.state === 'waiting') return undefined
  if (isCurrentPlayer) return { label: '你', state: 'self' }

  const cluesVisible = presentation.state === 'revealing' ||
    presentation.state === 'revealed' ||
    presentation.state === 'confirming'
  if (
    cluesVisible &&
    presentation.scene.type !== 'none' &&
    presentation.scene.targetPlayerIDs.includes(playerID)
  ) {
    return TARGET_MARKERS[presentation.scene.type]
  }

  return { state: 'dimmed' }
}

export function applyRoomIdentityRecognitionSeat(
  presentation: RoomIdentityRecognitionPresentation,
  player: RoomPlayerPresentation,
): RoomPlayerPresentation {
  const recognition = getRoomIdentityRecognitionSeat(
    presentation,
    player.playerID,
    player.isCurrentPlayer,
  )
  if (recognition === undefined) return player
  if (recognition.state === 'dimmed') {
    return { ...player, caption: { kind: 'none' }, emphasis: 'dimmed' }
  }
  return {
    ...player,
    caption: {
      kind: 'recognition',
      label: recognition.label,
      tone: recognition.state === 'self' ? 'self' : recognition.tone,
    },
  }
}
