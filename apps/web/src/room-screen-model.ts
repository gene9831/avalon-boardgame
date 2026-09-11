import {
  getPlayerCountConfig,
  type AvalonPlayerView,
  type PlayerID,
  type Role,
  type TeamVote,
} from '@avalon/game'

import type { LobbyPlayer } from './lobby'
import type { PlayerAvatarID } from './player-profile'
import { getSeatAvatarID } from './seat-avatar'

export type RoomScreenMode =
  | 'loading'
  | 'lobby'
  | 'identityRecognition'
  | 'teamProposal'
  | 'teamVote'
  | 'quest'
  | 'assassination'
  | 'finished'

export type RoomPlayerInteractionMode =
  | 'none'
  | 'changeSeat'
  | 'selectTeam'
  | 'selectAssassinationTarget'

export type RoomPlayerModel = Readonly<{
  playerID: PlayerID
  relativeSeatIndex: number
  seatNumber: number
  name: string
  avatarID: PlayerAvatarID
  occupied: boolean
  connected: boolean
  isCurrentPlayer: boolean
  isOwner: boolean
  isLeader: boolean
  isQuestMember: boolean
  isSelected: boolean
  isSelectedTarget: boolean
  knownEvil: boolean
  knownMerlinCandidate: boolean
  visibleRole: Role | null
  voteStatus: 'pending' | TeamVote | null
}>

export type QuestProgressNodeModel = Readonly<{
  questIndex: number
  teamSize: number | null
  failThreshold: number | null
  state: 'upcoming' | 'current' | 'success' | 'failure'
}>

export function buildRoomPlayers(input: Readonly<{
  players: readonly LobbyPlayer[]
  numPlayers: number
  currentPlayerID: PlayerID
  ownerPlayerID: PlayerID | null
  game: AvalonPlayerView | null
  selectedTeam: readonly PlayerID[]
  selectedTarget: PlayerID | null
  showKnownPlayerInfo: boolean
  showPrivateRoleKnowledge: boolean
}>): readonly RoomPlayerModel[] {
  const orderedPlayerIDs = Array.from(
    { length: input.numPlayers },
    (_, index) => String(index) as PlayerID,
  )
  const currentIndex = Math.max(0, orderedPlayerIDs.indexOf(input.currentPlayerID))
  const relativeOrder = [
    ...orderedPlayerIDs.slice(currentIndex),
    ...orderedPlayerIDs.slice(0, currentIndex),
  ]
  const settledVotes = input.game?.voteHistory.at(-1)?.votes

  return relativeOrder.map((playerID, relativeSeatIndex) => {
    const seatIndex = Number(playerID)
    const lobbyPlayer = input.players.find(({ id }) => String(id) === playerID)
    const occupied = lobbyPlayer?.name != null
    const isCurrentPlayer = playerID === input.currentPlayerID
    const revealedRole = input.game?.revealedRoles?.[playerID]
    const privateRole = input.showPrivateRoleKnowledge && isCurrentPlayer
      ? input.game?.viewer.role
      : null

    return {
      playerID,
      relativeSeatIndex,
      seatNumber: seatIndex + 1,
      name: occupied ? lobbyPlayer.name! : '',
      avatarID: getSeatAvatarID(lobbyPlayer?.data, seatIndex),
      occupied,
      connected: occupied && lobbyPlayer?.isConnected === true,
      isCurrentPlayer,
      isOwner: playerID === input.ownerPlayerID,
      isLeader: input.game?.leaderID === playerID,
      isQuestMember: input.game?.proposedTeam?.includes(playerID) === true,
      isSelected: input.selectedTeam.includes(playerID),
      isSelectedTarget: input.selectedTarget === playerID,
      knownEvil:
        input.showKnownPlayerInfo &&
        input.game?.viewer.knownEvilPlayerIDs.includes(playerID) === true,
      knownMerlinCandidate:
        input.showKnownPlayerInfo &&
        input.game?.status !== 'finished' &&
        input.game?.viewer.knownMerlinCandidatePlayerIDs.includes(playerID) === true,
      visibleRole: revealedRole ?? privateRole ?? null,
      voteStatus:
        settledVotes?.[playerID] ??
        (input.game?.submittedTeamVotePlayerIDs.includes(playerID) === true
          ? 'pending'
          : null),
    }
  })
}

export function buildQuestProgress(
  numPlayers: number | null,
  game: AvalonPlayerView | null,
): readonly QuestProgressNodeModel[] {
  const config = numPlayers === null ? null : getPlayerCountConfig(numPlayers)

  return Array.from({ length: 5 }, (_, questIndex) => {
    const result = game?.questHistory.find(
      (quest) => quest.questIndex === questIndex,
    )
    const isCurrent =
      game !== null && game.status !== 'finished' && game.questIndex === questIndex

    return {
      questIndex,
      teamSize: config?.questTeamSizes[questIndex] ?? null,
      failThreshold: config?.questFailThresholds[questIndex] ?? null,
      state: result === undefined
        ? isCurrent ? 'current' : 'upcoming'
        : result.succeeded ? 'success' : 'failure',
    }
  })
}
