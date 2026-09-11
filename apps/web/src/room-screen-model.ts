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
import type { PlayerAvatarID } from './player-profile'
import { getDisplayedTeamVoteResult } from './room-game'
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

export type RoomCenterModel =
  | Readonly<{ kind: 'loadingSummary'; message: string }>
  | Readonly<{ kind: 'lobbySummary'; occupied: number; total: number; ready: boolean }>
  | Readonly<{ kind: 'questSummary'; questIndex: number; goodSuccesses: number; evilFailures: number; consecutiveRejectedTeams: number }>
  | Readonly<{ kind: 'resultSummary'; winner: 'good' | 'evil'; reason: string }>

export type RoomPhaseModel =
  | Readonly<{ kind: 'loading'; title: string; message: string }>
  | Readonly<{ kind: 'lobby'; title: '等待玩家'; occupied: number; total: number; isOwner: boolean; canStart: boolean; startPending: boolean }>
  | Readonly<{ kind: 'connectionRecovery'; title: '正在重新连接'; manualReconnectAvailable: boolean }>
  | Readonly<{ kind: 'identityRecognition'; title: '身份辨认'; confirmationLabel: string; confirmed: boolean; confirmedCount: number; participantCount: number; isParticipant: boolean }>
  | Readonly<{ kind: 'teamProposal'; title: '组建任务队伍'; requiredTeamSize: number; selectedCount: number; leaderName: string; canSubmit: boolean }>
  | Readonly<{ kind: 'teamVote'; title: '表决任务队伍'; proposedTeamNames: readonly string[]; submittedCount: number; total: number; submittedVote: TeamVote | null; canVote: boolean }>
  | Readonly<{ kind: 'quest'; title: '执行任务'; status: string; submittedCard: QuestCard | null; canPlaySuccess: boolean; canPlayFail: boolean }>
  | Readonly<{ kind: 'assassination'; title: '刺杀阶段'; isAssassin: boolean; targetName: string | null; canSubmit: boolean }>
  | Readonly<{ kind: 'finished'; title: '对局结束'; summary: string; rolesRevealed: boolean }>

export interface RoomScreenActions {
  onActivatePlayer(playerID: PlayerID): void
  onStart(): void
  onReconnect(): void
  onConfirmIdentityRecognition(): void
  onSubmitTeam(): void
  onCastTeamVote(vote: TeamVote): void
  onPlayQuestCard(card: QuestCard): void
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
  players: readonly RoomPlayerModel[]
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
  const settledVotes = input.game === null
    ? undefined
    : getDisplayedTeamVoteResult(input.game, input.phase)?.votes

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
      connected: occupied && (
        isCurrentPlayer
          ? input.viewerConnected && lobbyPlayer?.isConnected === true
          : lobbyPlayer?.isConnected === true
      ),
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
        input.game !== null &&
        (input.game.viewer.knownMerlinCandidatePlayerIDs ?? []).includes(playerID),
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
