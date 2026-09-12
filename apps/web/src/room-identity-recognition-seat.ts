import type { PlayerID } from '@avalon/game'

import type { RoomIdentityRecognitionPresentation } from './RoomIdentityRecognition'
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
} as const satisfies Record<Exclude<RoomIdentityClue['kind'], 'none'>, RoomPlayerSeatRecognition>

type RecognitionSeatScene = Pick<RoomIdentityRecognitionScene, 'clue' | 'view'>

export function getRoomIdentityRecognitionSeat(
  scene: RecognitionSeatScene,
  playerID: PlayerID,
  isCurrentPlayer: boolean,
): RoomPlayerSeatRecognition | undefined {
  if (scene.view === 'waiting') return undefined
  if (isCurrentPlayer) return { label: '你', state: 'self' }

  const cluesVisible = scene.view === 'revealing' || scene.view === 'revealed'
  if (
    cluesVisible &&
    scene.clue.kind !== 'none' &&
    scene.clue.targetPlayerIDs.includes(playerID)
  ) {
    return TARGET_MARKERS[scene.clue.kind]
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
      caption: { kind: 'none' },
      emphasis: 'default',
      interaction: { kind: 'none' },
      markers: [],
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

/** Temporary adapter for the pre-Task-6 RoomScreen entry path. */
export function applyLegacyRoomIdentityRecognitionSeat(
  presentation: RoomIdentityRecognitionPresentation,
  player: RoomPlayerPresentation,
): RoomPlayerPresentation {
  const clue = (() => {
    switch (presentation.scene.type) {
      case 'evil-allies': return { kind: 'evilAllies', targetPlayerIDs: presentation.scene.targetPlayerIDs } as const
      case 'merlin-evil': return { kind: 'merlinEvil', targetPlayerIDs: presentation.scene.targetPlayerIDs } as const
      case 'percival-candidates': return { kind: 'percivalCandidates', targetPlayerIDs: presentation.scene.targetPlayerIDs } as const
      case 'none': return { kind: 'none', targetPlayerIDs: presentation.scene.targetPlayerIDs } as const
    }
  })()
  const view = presentation.state === 'confirming' ? 'revealed' : presentation.state
  return applyRoomIdentityRecognitionSeat({ clue, view }, player)
}
