import type { PlayerID } from '@avalon/game'

import type {
  RoomIdentityClue,
  RoomIdentityRecognitionScene,
  RoomPlayerPresentation,
} from './room-screen-props'

export type RoomPlayerSeatRecognition =
  | Readonly<{ state: 'dimmed' }>
  | Readonly<{
      state: 'target'
      label: '同伴' | '邪恶' | '梅林候选'
      tone: 'ally' | 'evil' | 'candidate'
    }>

const TARGET_MARKERS = {
  evilAllies: { label: '同伴', state: 'target', tone: 'ally' },
  merlinEvil: { label: '邪恶', state: 'target', tone: 'evil' },
  percivalCandidates: { label: '梅林候选', state: 'target', tone: 'candidate' },
} as const satisfies Record<RoomIdentityClue['kind'], RoomPlayerSeatRecognition>

type RecognitionSeatScene = Pick<RoomIdentityRecognitionScene, 'presentation'>

export function getRoomIdentityRecognitionSeat(
  scene: RecognitionSeatScene,
  playerID: PlayerID,
  isCurrentPlayer: boolean,
): RoomPlayerSeatRecognition | undefined {
  const presentation = scene.presentation
  if (presentation.kind !== 'clue') return undefined
  if (isCurrentPlayer) return undefined

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
      tone: recognition.tone,
    },
    emphasis: 'target',
    interaction: { kind: 'none' },
    markers: [],
  }
}
