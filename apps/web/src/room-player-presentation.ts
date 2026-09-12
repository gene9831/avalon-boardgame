import type { PlayerID, Role, TeamVote } from '@avalon/game'

import type { PlayerAvatarID } from './player-profile'
import type {
  RoomPlayerCaption,
  RoomPlayerInteraction,
  RoomPlayerMarker,
  RoomPlayerPresentation,
  RoomPlayerPortrait,
} from './room-screen-props'

export type FilteredSeatRole =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'viewerVisible'; role: Role }>
  | Readonly<{ kind: 'settledReveal'; role: Role }>

export type FilteredSeatRecognition =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'dimmed' }>
  | Extract<RoomPlayerCaption, { kind: 'recognition' }>

/**
 * Seat facts after playerView and the UI controller have applied visibility rules.
 * Role provenance is explicit so this pure presentation builder never receives an
 * unfiltered role map or infers another player's hidden role.
 */
export type FilteredSeatInput = Readonly<{
  playerID: PlayerID
  relativeSeatIndex: number
  seatNumber: number
  name: string
  occupied: boolean
  isCurrentPlayer: boolean
  avatarID: PlayerAvatarID
  connected: boolean
  role: FilteredSeatRole
  isOwner: boolean
  isLeader: boolean
  isQuestMember: boolean
  isSelected: boolean
  isSelectedTarget: boolean
  knownEvil: boolean
  knownMerlinCandidate: boolean
  voteStatus: 'pending' | TeamVote | null
  recognition: FilteredSeatRecognition
  interaction: RoomPlayerInteraction
}>

function assertNever(value: never): never {
  throw new Error(`Unexpected room player presentation variant: ${JSON.stringify(value)}`)
}

function buildPortrait(input: FilteredSeatInput): RoomPlayerPortrait {
  switch (input.role.kind) {
    case 'none':
      return { kind: 'playerAvatar', avatarID: input.avatarID, connected: input.connected }
    case 'viewerVisible':
    case 'settledReveal':
      return { kind: 'roleArtwork', role: input.role.role }
    default:
      return assertNever(input.role)
  }
}

function buildMarkers(input: FilteredSeatInput): readonly RoomPlayerMarker[] {
  const markers: RoomPlayerMarker[] = []
  if (input.isOwner) markers.push({ kind: 'owner' })
  if (input.isLeader) markers.push({ kind: 'leader' })
  if (input.isQuestMember) markers.push({ kind: 'questMember' })
  if (input.voteStatus !== null) markers.push({ kind: 'vote', status: input.voteStatus })
  if (input.knownEvil) markers.push({ kind: 'knownEvil' })
  if (input.knownMerlinCandidate) markers.push({ kind: 'merlinCandidate' })
  return markers
}

function buildCaption(input: FilteredSeatInput): RoomPlayerCaption {
  switch (input.recognition.kind) {
    case 'none':
    case 'dimmed':
      return { kind: 'none' }
    case 'recognition':
      return input.recognition
    default:
      return assertNever(input.recognition)
  }
}

function buildEmphasis(input: FilteredSeatInput): RoomPlayerPresentation['emphasis'] {
  if (input.recognition.kind === 'dimmed') return 'dimmed'
  if (input.isSelectedTarget) return 'target'
  if (input.isSelected) return 'selected'
  if (input.isQuestMember) return 'questMember'
  if (input.knownEvil) return 'knownEvil'
  return 'default'
}

export function buildRoomPlayerPresentation(
  input: FilteredSeatInput,
): RoomPlayerPresentation {
  const base = {
    playerID: input.playerID,
    relativeSeatIndex: input.relativeSeatIndex,
    seatNumber: input.seatNumber,
    name: input.name,
    occupied: input.occupied,
    isCurrentPlayer: input.isCurrentPlayer,
  } as const

  if (input.role.kind === 'settledReveal') {
    return {
      ...base,
      portrait: { kind: 'roleArtwork', role: input.role.role },
      markers: [],
      caption: { kind: 'role', role: input.role.role },
      emphasis: 'default',
      interaction: { kind: 'none' },
    }
  }

  return {
    ...base,
    portrait: buildPortrait(input),
    markers: buildMarkers(input),
    caption: buildCaption(input),
    emphasis: buildEmphasis(input),
    interaction: input.interaction,
  }
}
