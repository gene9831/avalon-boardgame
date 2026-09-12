import {
  getPlayerCountConfig,
  type AvalonPlayerView,
  type IdentityRecognitionStep,
  type PlayerID,
  type QuestCard,
  type Role,
  type TeamVote,
} from '@avalon/game'

import type { LobbyPlayer } from './lobby'
import { buildRoomPlayerPresentation, type FilteredSeatRole } from './room-player-presentation'
import { getDisplayedTeamVoteResult } from './room-game'
import { getSeatAvatarID } from './seat-avatar'
import type { RoomPlayerInteraction, RoomPlayerPresentation } from './room-screen-props'

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

export type QuestProgressNodeModel = Readonly<{
  questIndex: number
  teamSize: number | null
  failThreshold: number | null
  state: 'upcoming' | 'current' | 'success' | 'failure'
}>

export type RoomCenterModel =
  | Readonly<{ kind: 'loadingSummary'; message: string }>
  | Readonly<{ kind: 'lobbySummary'; occupied: number; total: number; ready: boolean }>
  | Readonly<{
      kind: 'questSummary'
      questIndex: number
      status: string | null
      detail?: string | null
      rule?: string | null
      statusTone?: 'neutral' | 'success' | 'failure'
      consecutiveRejectedTeams: number
    }>
  | Readonly<{
      kind: 'assassinationSummary'
      title: string
      status: string
      detail: string
      statusTone: 'neutral' | 'success' | 'failure'
    }>
  | Readonly<{
      kind: 'resultSummary'
      winner: 'good' | 'evil'
      reason: string
      questScore: string
    }>

export type RoomPhaseModel =
  | Readonly<{ kind: 'loading'; title: string; message: string }>
  | Readonly<{ kind: 'lobby'; title: '等待玩家'; occupied: number; total: number; isOwner: boolean; canStart: boolean; startPending: boolean }>
  | Readonly<{ kind: 'connectionRecovery'; title: '正在重新连接'; manualReconnectAvailable: boolean }>
  | Readonly<{ kind: 'identityRecognition'; title: '身份辨认'; confirmationLabel: string; confirmed: boolean; confirmedCount: number; participantCount: number; isParticipant: boolean }>
  | Readonly<{
      kind: 'teamProposal'
      title: '组建任务队伍' | '等待队长组队'
      requiredTeamSize: number
      selectedCount: number
      isLeader: boolean
      canSubmit: boolean
      isSubmitting: boolean
    }>
  | Readonly<{
      kind: 'teamVote'
      title: '表决任务队伍'
      selectedVote: TeamVote | null
      submittedVote: TeamVote | null
      canVote: boolean
      isSubmitting: boolean
    }>
  | Readonly<{
      kind: 'quest'
      title: '执行任务' | '等待任务结果'
      isOnTeam: boolean
      isEvil: boolean
      selectedCard: QuestCard | null
      submittedCard: QuestCard | null
      canSelect: boolean
      canConfirm: boolean
      isSubmitting: boolean
    }>
  | Readonly<{
      kind: 'questResult'
      title: '任务结算'
      succeeded: boolean
      successCount: number
      failCount: number
    }>
  | Readonly<{
      kind: 'assassination'
      title: '刺杀梅林' | '协助刺杀' | '等待刺杀'
      perspective: 'assassin' | 'evil' | 'good'
      targetName: string | null
      canSubmit: boolean
      isSubmitting: boolean
    }>
  | Readonly<{
      kind: 'assassinationResult'
      title: '刺杀结果'
      hit: boolean
      targetName: string
      targetRoleLabel: string
      winner: 'good' | 'evil'
    }>
  | Readonly<{
      kind: 'finished'
      title: '对局结束'
      message: string
      rolesRevealed: boolean
    }>

export interface RoomScreenActions {
  onActivatePlayer(playerID: PlayerID): void
  onStart(): void
  onReconnect(): void
  onConfirmIdentityRecognition(): void
  onSubmitTeam(): void
  onSelectTeamVote(vote: TeamVote): void
  onConfirmTeamVote(): void
  onSelectQuestCard(card: QuestCard): void
  onConfirmQuestCard(): void
  onAssassinate(): void
}

export type RoomStageOverlayModel =
  | Readonly<{ kind: 'none' }>
  | Readonly<{
      kind: 'identityRecognition'
      step: IdentityRecognitionStep
      curtainState: 'closed' | 'lowered' | 'raised'
      title: string
      role: Role | null
    }>

export type RoomUtilityModel = Readonly<{
  variant: 'loading' | 'lobby' | 'game'
  showRoomExit: boolean
  showIdentityKnowledge: boolean
  roleKnowledgeOpen: boolean
}>

export interface RoomScreenModel {
  mode: RoomScreenMode
  matchID: string
  numPlayers: number | null
  connected: boolean
  players: readonly RoomPlayerPresentation[]
  playerInteractionMode: RoomPlayerInteractionMode
  questProgress: readonly QuestProgressNodeModel[]
  center: RoomCenterModel
  phase: RoomPhaseModel
  stageOverlay: RoomStageOverlayModel
  utilities: RoomUtilityModel
}

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
  showRoundDecorations?: boolean
  showConnectionStatus?: boolean
  showRoleReveal?: boolean
  interactionMode?: RoomPlayerInteractionMode
  seatChangeTargetID?: PlayerID | null
}>): readonly RoomPlayerPresentation[] {
  const orderedPlayerIDs = Array.from(
    { length: input.numPlayers },
    (_, index) => String(index) as PlayerID,
  )
  const currentIndex = Math.max(0, orderedPlayerIDs.indexOf(input.currentPlayerID))
  const relativeOrder = [
    ...orderedPlayerIDs.slice(currentIndex),
    ...orderedPlayerIDs.slice(0, currentIndex),
  ]
  const settledVotes = input.game === null || input.showSettledTeamVoteDetails === false
    ? undefined
    : getDisplayedTeamVoteResult(input.game, input.phase)?.votes

  return relativeOrder.map((playerID, relativeSeatIndex) => {
    const seatIndex = Number(playerID)
    const lobbyPlayer = input.players.find(({ id }) => String(id) === playerID)
    const occupied = lobbyPlayer?.name != null
    const isCurrentPlayer = playerID === input.currentPlayerID
    const revealedRole = input.game?.revealedRoles?.[playerID]
    const privateRole = input.showPrivateRoleKnowledge && isCurrentPlayer
      ? input.game?.viewer.role ?? null
      : null
    const role: FilteredSeatRole = revealedRole !== undefined
      ? input.showRoleReveal === true
        ? { kind: 'settledReveal', role: revealedRole }
        : { kind: 'viewerVisible', role: revealedRole }
      : privateRole === null
        ? { kind: 'none' }
        : { kind: 'viewerVisible', role: privateRole }
    const isOwner = playerID === input.ownerPlayerID
    const isLeader = input.showRoundDecorations !== false && input.game?.leaderID === playerID
    const isQuestMember = input.showRoundDecorations !== false && input.game?.proposedTeam?.includes(playerID) === true
    const isSelected = input.selectedTeam.includes(playerID)
    const isSelectedTarget = input.selectedTarget === playerID
    const knownEvil =
      input.showKnownPlayerInfo &&
      input.game?.viewer.knownEvilPlayerIDs.includes(playerID) === true
    const knownMerlinCandidate =
      input.showKnownPlayerInfo &&
      input.game?.status !== 'finished' &&
      input.game !== null &&
      (input.game.viewer.knownMerlinCandidatePlayerIDs ?? []).includes(playerID)
    const voteStatus = input.showRoundDecorations === false
      ? null
      : settledVotes?.[playerID] ??
        (input.game?.submittedTeamVotePlayerIDs.includes(playerID) === true
          ? 'pending'
          : null)
    const interactionMode = input.interactionMode ?? 'none'
    let interaction: RoomPlayerInteraction
    switch (interactionMode) {
      case 'none':
        interaction = { kind: 'none' }
        break
      case 'changeSeat':
        interaction = {
          kind: 'changeSeat',
          disabled: !input.viewerConnected || occupied || input.seatChangeTargetID != null,
          pending: input.seatChangeTargetID === playerID,
        }
        break
      case 'selectTeam':
        interaction = { kind: 'selectTeam', disabled: !occupied, selected: isSelected }
        break
      case 'selectAssassinationTarget':
        interaction = {
          kind: 'selectAssassinationTarget',
          disabled: !occupied || isCurrentPlayer || knownEvil,
          selected: isSelectedTarget,
        }
        break
    }

    return buildRoomPlayerPresentation({
      playerID,
      relativeSeatIndex,
      seatNumber: seatIndex + 1,
      name: occupied ? lobbyPlayer.name! : '',
      avatarID: getSeatAvatarID(lobbyPlayer?.data, seatIndex),
      occupied,
      connected: occupied && (input.showConnectionStatus === false || (
        isCurrentPlayer
          ? input.viewerConnected && lobbyPlayer?.isConnected === true
          : lobbyPlayer?.isConnected === true
      )),
      isCurrentPlayer,
      role,
      isOwner,
      isLeader,
      isQuestMember,
      isSelected,
      isSelectedTarget,
      knownEvil,
      knownMerlinCandidate,
      voteStatus,
      recognition: { kind: 'none' },
      interaction,
    })
  })
}

export function buildQuestProgress(
  numPlayers: number | null,
  game: AvalonPlayerView | null,
  showCurrent = true,
): readonly QuestProgressNodeModel[] {
  const config = numPlayers === null ? null : getPlayerCountConfig(numPlayers)

  return Array.from({ length: 5 }, (_, questIndex) => {
    const result = game?.questHistory.find(
      (quest) => quest.questIndex === questIndex,
    )
    const isCurrent =
      showCurrent && game !== null && game.status !== 'finished' && game.questIndex === questIndex

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
