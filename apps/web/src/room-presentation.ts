import { getPlayerCountConfig, type AvalonPlayerView, type PlayerID } from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import { getDisplayedTeamVoteResult } from './room-game'
import { buildRoomPlayerPresentation, type FilteredSeatRole } from './room-player-presentation'
import type { RoomPlayerInteraction, RoomPlayerPresentation } from './room-screen-props'
import { getSeatAvatarID } from './seat-avatar'
import type { RoomTeamToken } from './RoomTeamTokens'

export type RoomPlayerInteractionMode =
  | 'none'
  | 'changeSeat'
  | 'selectTeam'
  | 'selectAssassinationTarget'

export type QuestProgressNode = Readonly<{
  questIndex: number
  teamSize: number | null
  failThreshold: number | null
  state: 'upcoming' | 'current' | 'success' | 'failure'
}>

/** Builds selected-team display tokens from lobby seats, never from role presentation. */
export function buildRoomTeamTokens(
  room: AvalonMatch,
  playerIDs: readonly PlayerID[],
): readonly RoomTeamToken[] {
  const selectedPlayerIDs = new Set(playerIDs)

  return room.players
    .filter((player) => selectedPlayerIDs.has(String(player.id) as PlayerID) && player.name !== undefined)
    .map((player) => ({
      playerID: String(player.id) as PlayerID,
      seatNumber: player.id + 1,
      name: player.name!,
      avatarID: getSeatAvatarID(player.data, player.id),
    }))
    .sort((left, right) => left.seatNumber - right.seatNumber)
}

/** Builds display-only seat data from the player-filtered room snapshot. */
export function buildRoomPlayers(input: Readonly<{
  players: readonly LobbyPlayer[]
  numPlayers: number
  currentPlayerID: PlayerID
  phase: string
  viewerConnected: boolean
  ownerPlayerID: PlayerID | null
  game: AvalonPlayerView | null
  selectedTeam: readonly PlayerID[]
  selectedTarget: PlayerID | null
  showKnownPlayerInfo: boolean
  showPrivateRoleKnowledge: boolean
  showSettledTeamVoteDetails?: boolean
  settledVotes?: Readonly<Record<PlayerID, 'approve' | 'reject'>>
  resolvedQuestTeam?: readonly PlayerID[]
  publicRevealedRolePlayerIDs?: readonly PlayerID[]
  showRoundDecorations?: boolean
  showLeader?: boolean
  showConnectionStatus?: boolean
  showRoleReveal?: boolean
  interactionMode?: RoomPlayerInteractionMode
  seatChangeTargetID?: PlayerID | null
}>): readonly RoomPlayerPresentation[] {
  const orderedPlayerIDs = Array.from({ length: input.numPlayers }, (_, index) => String(index) as PlayerID)
  const currentIndex = Math.max(0, orderedPlayerIDs.indexOf(input.currentPlayerID))
  const relativeOrder = [...orderedPlayerIDs.slice(currentIndex), ...orderedPlayerIDs.slice(0, currentIndex)]
  const settledVotes = input.settledVotes ?? (input.game === null || input.showSettledTeamVoteDetails === false
    ? undefined
    : getDisplayedTeamVoteResult(input.game, input.phase)?.votes)

  return relativeOrder.map((playerID, relativeSeatIndex) => {
    const seatIndex = Number(playerID)
    const lobbyPlayer = input.players.find(({ id }) => String(id) === playerID)
    const occupied = lobbyPlayer?.name != null
    const isCurrentPlayer = playerID === input.currentPlayerID
    const revealedRole = input.game?.revealedRoles?.[playerID]
    const publiclyRevealed = input.publicRevealedRolePlayerIDs === undefined || input.publicRevealedRolePlayerIDs.includes(playerID)
    const privateRole = input.showPrivateRoleKnowledge && isCurrentPlayer ? input.game?.viewer.role ?? null : null
    const role: FilteredSeatRole = revealedRole !== undefined && publiclyRevealed
      ? input.showRoleReveal === true ? { kind: 'settledReveal', role: revealedRole } : { kind: 'viewerVisible', role: revealedRole }
      : privateRole === null ? { kind: 'none' } : { kind: 'viewerVisible', role: privateRole }
    const knownEvil = input.showKnownPlayerInfo && input.game?.viewer.knownEvilPlayerIDs.includes(playerID) === true
    const knownMerlinCandidate = input.showKnownPlayerInfo && input.game?.status !== 'finished' && input.game !== null && (input.game.viewer.knownMerlinCandidatePlayerIDs ?? []).includes(playerID)
    const voteStatus = input.showRoundDecorations === false ? null : settledVotes?.[playerID] ?? (input.game?.submittedTeamVotePlayerIDs.includes(playerID) === true ? 'pending' : null)
    const interactionMode = input.interactionMode ?? 'none'
    let interaction: RoomPlayerInteraction
    switch (interactionMode) {
      case 'none': interaction = { kind: 'none' }; break
      case 'changeSeat': interaction = { kind: 'changeSeat', disabled: !input.viewerConnected || occupied || input.seatChangeTargetID != null, pending: input.seatChangeTargetID === playerID }; break
      case 'selectTeam': interaction = { kind: 'selectTeam', disabled: !occupied, selected: input.selectedTeam.includes(playerID) }; break
      case 'selectAssassinationTarget': interaction = { kind: 'selectAssassinationTarget', disabled: !occupied || isCurrentPlayer || knownEvil, selected: input.selectedTarget === playerID }; break
    }

    return buildRoomPlayerPresentation({
      playerID, relativeSeatIndex, seatNumber: seatIndex + 1, name: occupied ? lobbyPlayer.name! : '',
      avatarID: getSeatAvatarID(lobbyPlayer?.data, seatIndex), occupied,
      connected: occupied && (input.showConnectionStatus === false || (isCurrentPlayer ? input.viewerConnected && lobbyPlayer?.isConnected === true : lobbyPlayer?.isConnected === true)),
      isCurrentPlayer, role, isOwner: playerID === input.ownerPlayerID,
      isLeader: input.showRoundDecorations !== false && input.showLeader !== false && input.game?.leaderID === playerID,
      isQuestMember: input.showRoundDecorations !== false && (input.resolvedQuestTeam ?? input.game?.proposedTeam ?? []).includes(playerID),
      isSelected: input.selectedTeam.includes(playerID), isSelectedTarget: input.selectedTarget === playerID,
      knownEvil, knownMerlinCandidate, voteStatus, recognition: { kind: 'none' }, interaction,
    })
  })
}

/** Builds the five public quest progress nodes without reimplementing game rules. */
export function buildQuestProgress(
  numPlayers: number | null,
  game: AvalonPlayerView | null,
  showCurrent = true,
): readonly QuestProgressNode[] {
  const config = numPlayers === null ? null : getPlayerCountConfig(numPlayers)
  return Array.from({ length: 5 }, (_, questIndex) => {
    const result = game?.questHistory.find((quest) => quest.questIndex === questIndex)
    const isCurrent = showCurrent && game !== null && game.status !== 'finished' && game.questIndex === questIndex
    return {
      questIndex,
      teamSize: config?.questTeamSizes[questIndex] ?? null,
      failThreshold: config?.questFailThresholds[questIndex] ?? null,
      state: result === undefined ? isCurrent ? 'current' : 'upcoming' : result.succeeded ? 'success' : 'failure',
    }
  })
}
