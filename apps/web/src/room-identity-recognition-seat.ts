import type { PlayerID } from '@avalon/game'

import type {
  RoomIdentityClue,
  RoomIdentityRecognitionScene,
  RoomPlayerPresentation,
} from './room-screen-props'

export type RoomPlayerSeatRecognition =
  | Readonly<{ state: 'dimmed' }>
  | Readonly<{ state: 'self'; label: '你' }>
  | Readonly<{
      state: 'target'
      label: '同伴' | '邪恶' | '候选人'
      tone: 'ally' | 'evil' | 'candidate'
    }>

const TARGET_MARKERS = {
  evilAllies: { label: '同伴', state: 'target', tone: 'ally' },
  merlinEvil: { label: '邪恶', state: 'target', tone: 'evil' },
  percivalCandidates: { label: '候选人', state: 'target', tone: 'candidate' },
} as const satisfies Record<RoomIdentityClue['kind'], RoomPlayerSeatRecognition>

type RecognitionSeatScene = Pick<RoomIdentityRecognitionScene, 'presentation'>

export function getRoomIdentityRecognitionSeat(
  scene: RecognitionSeatScene,
  playerID: PlayerID,
  isCurrentPlayer: boolean,
): RoomPlayerSeatRecognition | undefined {
  const presentation = scene.presentation
  if (presentation.kind !== 'clue') return undefined
  if (isCurrentPlayer) return { label: '你', state: 'self' }

  const cluesVisible = presentation.view === 'revealing' || presentation.view === 'revealed'
  if (
    cluesVisible &&
    presentation.clue.targetPlayerIDs.includes(playerID)
  ) {
    return TARGET_MARKERS[presentation.clue.kind]
  }

  return { state: 'dimmed' }
}

export function applyRoomIdentityRecognitionSeat(
  scene: RecognitionSeatScene,
  player: RoomPlayerPresentation,
): RoomPlayerPresentation {
  const recognition = getRoomIdentityRecognitionSeat(scene, player.playerID, player.isCurrentPlayer)
  if (recognition === undefined) {
    return {
      ...player,
      interaction: { kind: 'none' },
    }
  }
  if (recognition.state === 'dimmed') {
    return {
      ...player,
      caption: { kind: 'none' },
      emphasis: 'dimmed',
      interaction: { kind: 'none' },
      markers: [],
    }
  }
  return {
    ...player,
    caption: {
      kind: 'recognition',
      label: recognition.label,
      tone: recognition.state === 'self' ? 'self' : recognition.tone,
    },
    emphasis: recognition.state === 'target' ? 'target' : 'default',
    interaction: { kind: 'none' },
    markers: [],
  }
}
