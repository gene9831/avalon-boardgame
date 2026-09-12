import { useEffect, useState } from 'react'
import type {
  AvalonResult,
  AvalonPlayerView,
  PlayerID,
  QuestCard,
  TeamVote,
} from '@avalon/game'
import { getPlayerCountConfig } from '@avalon/game'

import {
  GAME_CLIENT_SETTINGS_KEY,
  loadGameClientSettings,
  saveGameClientSettings,
} from './game-client-settings'
import type { AvalonMatch } from './lobby'
import { canSubmitTeam, getDisplayedTeamVoteResult, getQuestTeamSize, toggleTeamMember } from './room-game'
import {
  buildQuestProgress,
  buildRoomPlayers,
  type RoomCenterModel,
  type RoomPhaseModel,
  type RoomPlayerInteractionMode,
  type RoomScreenMode,
  type RoomScreenModel,
  type RoomStageOverlayModel,
} from './room-screen-model'
import type {
  RoomActionsByKind,
  RoomAssassinationView,
  RoomIdentityClue,
  RoomScene,
} from './room-screen-props'

const RECOGNITION_COPY = {
  roleReveal: { title: '查看你的身份', confirmation: '我已确认身份' },
  evilRecognition: { title: '邪恶阵营，请睁眼并辨认同伴', confirmation: '我已辨认同伴' },
  merlinRecognition: { title: '梅林，请睁眼并辨认邪恶阵营', confirmation: '我已辨认邪恶阵营' },
  percivalRecognition: { title: '帕西维尔，请睁眼并辨认梅林候选', confirmation: '我已辨认梅林候选' },
} as const

function roomPlayerCount(room: AvalonMatch): number {
  return room.setupData?.numPlayers ?? room.players.length
}

function occupiedPlayerIDs(room: AvalonMatch): string[] {
  return room.players.filter(({ name }) => name != null).map(({ id }) => String(id))
}

type LobbyPresentationState = Readonly<{
  connected: boolean
  manualReconnectAvailable: boolean
  startPending: boolean
}>

type LobbyPresentationActions = Readonly<{
  onReconnect: () => void
}>

export type BuildRoomScreenModelInput =
  | Readonly<{ kind: 'loading'; matchID: string; numPlayers: null }>
  | Readonly<{
      kind: 'ready'
      matchID: string
      room: AvalonMatch
      game: AvalonPlayerView
      phase: string
      activeStage: string | undefined
      currentPlayerID: PlayerID
      selectedTeam: readonly PlayerID[]
      selectedTarget: PlayerID | null
      roleKnowledgeOpen: boolean
      canStart: boolean
      roomExitBusy: boolean
      teamSubmissionPending?: boolean
      selectedTeamVote?: TeamVote | null
      teamVoteSubmissionPending?: boolean
      selectedQuestCard?: QuestCard | null
      questCardSubmissionPending?: boolean
      showSettledTeamVoteDetails?: boolean
      assassinationSubmissionPending?: boolean
      identityRecognitionSubmissionPending?: boolean
      seatChangeTargetID?: PlayerID | null
    } & LobbyPresentationState>

export interface RoomSceneEventHandlers {
  onActivatePlayer(playerID: PlayerID): void
  onAssassinate(): void
  onConfirmIdentityRecognition(): void
  onConfirmQuestCard(): void
  onConfirmTeamVote(): void
  onReconnect(): void
  onSelectQuestCard(card: QuestCard): void
  onSelectTeamVote(vote: TeamVote): void
  onStart(): void
  onSubmitTeam(): void
}

export type RoomSceneBinding = {
  [Kind in RoomScene['kind']]: Readonly<{
    scene: Extract<RoomScene, { kind: Kind }>
    actions: RoomActionsByKind[Kind]
  }>
}[RoomScene['kind']]

function playerName(room: AvalonMatch, playerID: PlayerID | null): string {
  if (playerID === null) return '等待队长'
  return room.players.find(({ id }) => String(id) === playerID)?.name ?? `玩家 ${Number(playerID) + 1}`
}

function finishedResultReason(room: AvalonMatch, result: AvalonResult): string {
  if (result.reason === 'five_rejections') return '连续否决 5 支队伍'
  if (result.reason === 'three_quests') {
    return result.winner === 'good'
      ? '完成 3 次任务'
      : '破坏 3 次任务'
  }

  const target = result.targetID === undefined
    ? ''
    : `：${playerName(room, result.targetID)}`
  return result.winner === 'evil'
    ? `刺杀命中梅林${target}`
    : `刺杀未命中${target}`
}

function resolveMode(game: AvalonPlayerView, phase: string): RoomScreenMode {
  if (game.status === 'lobby') return 'lobby'
  if (game.status === 'finished') return 'finished'
  if (
    phase === 'identityRecognition' ||
    phase === 'teamProposal' ||
    phase === 'teamVote' ||
    phase === 'quest' ||
    phase === 'assassination'
  ) return phase
  return 'teamProposal'
}

function buildCenter(
  mode: RoomScreenMode,
  room: AvalonMatch,
  game: AvalonPlayerView,
  currentPlayerID: string,
): RoomCenterModel {
  if (mode === 'lobby') {
    const total = roomPlayerCount(room)
    const occupied = occupiedPlayerIDs(room).length
    return { kind: 'lobbySummary', occupied, total, ready: occupied === total }
  }
  if (mode === 'finished' && game.result !== undefined) {
    return {
      kind: 'resultSummary',
      winner: game.result.winner,
      reason: finishedResultReason(room, game.result),
      questScore: `任务 ${game.goodSuccesses} 成功 / ${game.evilFailures} 失败`,
    }
  }
  if (mode === 'assassination') {
    return {
      kind: 'assassinationSummary',
      title: '刺杀梅林',
      status: '正义阵营已完成 3 次任务',
      detail: '刺客命中梅林，邪恶阵营即可逆转',
      statusTone: 'neutral',
    }
  }
  const displayedVote = getDisplayedTeamVoteResult(game, mode)
  const approvedCount = displayedVote === undefined
    ? 0
    : Object.values(displayedVote.votes).filter((vote) => vote === 'approve').length
  const rejectedCount = displayedVote === undefined
    ? 0
    : Object.values(displayedVote.votes).filter((vote) => vote === 'reject').length
  const failThreshold = getPlayerCountConfig(roomPlayerCount(room)).questFailThresholds[game.questIndex] ?? 1

  return {
    kind: 'questSummary',
    questIndex: game.questIndex,
    status: mode === 'teamProposal'
      ? game.leaderID === currentPlayerID
        ? '由你组建本次任务队伍'
        : '等待队长选择任务队员'
      : mode === 'teamVote'
        ? `已确定 ${game.proposedTeam?.length ?? 0} 名任务队员`
        : mode === 'quest' && displayedVote?.approved === true
          ? `队伍表决通过 · ${approvedCount} 同意 / ${rejectedCount} 反对`
        : null,
    detail: mode === 'teamVote'
      ? '等待所有玩家投票'
      : mode === 'quest'
        ? `任务牌 ${game.submittedQuestCardCount} / ${game.proposedTeam?.length ?? 0}`
        : null,
    rule: mode === 'quest' && failThreshold > 1
      ? `任务失败需满 ${failThreshold} 张失败牌`
      : null,
    statusTone: 'neutral',
    consecutiveRejectedTeams: game.consecutiveRejectedTeams,
  }
}

function buildPhase(
  mode: RoomScreenMode,
  input: Extract<BuildRoomScreenModelInput, { kind: 'ready' }>,
): RoomPhaseModel {
  const { game, room, currentPlayerID } = input
  const total = roomPlayerCount(room)
  if (!input.connected) {
    return {
      kind: 'connectionRecovery',
      title: '正在重新连接',
      manualReconnectAvailable: input.manualReconnectAvailable,
    }
  }
  if (mode === 'lobby') {
    return {
      kind: 'lobby', title: '等待玩家', occupied: occupiedPlayerIDs(room).length, total,
      isOwner: room.ownerPlayerID === currentPlayerID, canStart: input.canStart, startPending: input.startPending,
    }
  }
  if (mode === 'identityRecognition') {
    const recognition = game.identityRecognition
    const viewer = game.viewer.identityRecognition
    const step = recognition?.step ?? 'roleReveal'
    return {
      kind: 'identityRecognition', title: '身份辨认', confirmationLabel: RECOGNITION_COPY[step].confirmation,
      confirmed: viewer?.confirmed === true, confirmedCount: recognition?.confirmedCount ?? 0,
      participantCount: recognition?.participantCount ?? 0, isParticipant: viewer?.isParticipant === true,
    }
  }
  if (mode === 'teamProposal') {
    const requiredTeamSize = getQuestTeamSize(total, game.questIndex)
    const isLeader = input.activeStage === 'leader' && game.leaderID === currentPlayerID
    const isSubmitting = isLeader && input.teamSubmissionPending === true
    return {
      kind: 'teamProposal', title: isLeader ? '组建任务队伍' : '等待队长组队',
      requiredTeamSize, selectedCount: input.selectedTeam.length, isLeader, isSubmitting,
      canSubmit: !isSubmitting && canSubmitTeam({
        activeStage: input.activeStage, leaderID: game.leaderID,
        playerID: currentPlayerID, requiredTeamSize, selectedTeam: input.selectedTeam,
      }),
    }
  }
  if (mode === 'teamVote') {
    const submittedVote = game.viewer.submittedVote ?? null
    const isSubmitting = submittedVote === null && input.teamVoteSubmissionPending === true
    return {
      kind: 'teamVote', title: '表决任务队伍',
      selectedVote: input.selectedTeamVote ?? null,
      submittedVote,
      canVote: input.activeStage === 'vote' && submittedVote === null && !isSubmitting,
      isSubmitting,
    }
  }
  if (mode === 'quest') {
    const onTeam = game.proposedTeam?.includes(currentPlayerID) === true
    const submittedCard = game.viewer.submittedQuestCard ?? null
    const isEvil = game.viewer.loyalty === 'evil'
    const isSubmitting = submittedCard === null && input.questCardSubmissionPending === true
    const canSelect = input.activeStage === 'quest' && onTeam && submittedCard === null && !isSubmitting
    const selectedCard = onTeam && submittedCard === null
      ? isEvil ? input.selectedQuestCard ?? null : 'success'
      : null
    return {
      kind: 'quest', title: onTeam && submittedCard === null ? '执行任务' : '等待任务结果',
      isOnTeam: onTeam, isEvil, selectedCard, submittedCard,
      canSelect, canConfirm: canSelect && selectedCard !== null, isSubmitting,
    }
  }
  if (mode === 'assassination') {
    const isAssassin = game.viewer.role === 'assassin'
    const perspective = isAssassin ? 'assassin' : game.viewer.loyalty === 'evil' ? 'evil' : 'good'
    const isSubmitting = isAssassin && input.assassinationSubmissionPending === true
    return {
      kind: 'assassination',
      title: perspective === 'assassin' ? '刺杀梅林' : perspective === 'evil' ? '协助刺杀' : '等待刺杀',
      perspective,
      targetName: isAssassin && input.selectedTarget !== null ? playerName(room, input.selectedTarget) : null,
      canSubmit: isAssassin && !isSubmitting && input.activeStage === 'assassin' && input.selectedTarget !== null,
      isSubmitting,
    }
  }
  return {
    kind: 'finished', title: '对局结束',
    message: '所有玩家身份已公开，可查看对局记录',
    rolesRevealed: game.revealedRoles !== undefined,
  }
}

function buildOverlay(
  mode: RoomScreenMode,
  game: AvalonPlayerView,
): RoomStageOverlayModel {
  if (mode !== 'identityRecognition' || game.identityRecognition === null) {
    return { kind: 'none' }
  }
  const viewer = game.viewer.identityRecognition
  const isParticipant = viewer?.isParticipant === true
  const step = game.identityRecognition.step
  return {
    kind: 'identityRecognition',
    step,
    curtainState: !isParticipant ? 'closed' : step === 'roleReveal' ? 'lowered' : 'raised',
    title: RECOGNITION_COPY[step].title,
    role: isParticipant && step === 'roleReveal' ? game.viewer.role : null,
  }
}

export function buildRoomScreenModel(input: BuildRoomScreenModelInput): RoomScreenModel {
  if (input.kind === 'loading') {
    return {
      mode: 'loading', matchID: input.matchID, numPlayers: null, connected: false, players: [],
      playerInteractionMode: 'none', questProgress: buildQuestProgress(null, null),
      center: { kind: 'loadingSummary', message: '正在准备游戏，请稍候。' },
      phase: { kind: 'loading', title: '正在进入房间', message: '正在同步房间状态。' },
      stageOverlay: { kind: 'none' },
      utilities: { variant: 'loading', showRoomExit: false, showIdentityKnowledge: false, roleKnowledgeOpen: false },
    }
  }

  const mode = resolveMode(input.game, input.phase)
  const recognitionKnowledge = mode === 'identityRecognition' &&
    input.game.viewer.identityRecognition?.isParticipant === true &&
    input.game.identityRecognition?.step !== 'roleReveal'
  const showPrivateRoleKnowledge = input.game.status === 'playing' && input.roleKnowledgeOpen
  const playerInteractionMode: RoomPlayerInteractionMode = mode === 'lobby'
    ? 'changeSeat'
    : mode === 'teamProposal' && input.activeStage === 'leader' && input.game.leaderID === input.currentPlayerID
      ? 'selectTeam'
      : mode === 'assassination' && input.activeStage === 'assassin' && input.game.viewer.role === 'assassin' && input.assassinationSubmissionPending !== true
        ? 'selectAssassinationTarget'
        : 'none'
  const numPlayers = roomPlayerCount(input.room)

  return {
    mode, matchID: input.matchID, numPlayers, connected: input.connected,
    players: buildRoomPlayers({
      players: input.room.players, numPlayers, currentPlayerID: input.currentPlayerID,
      phase: input.phase,
      viewerConnected: input.connected,
      ownerPlayerID: mode === 'finished' ? null : input.room.ownerPlayerID, game: input.game,
      selectedTeam: mode === 'finished' ? [] : input.selectedTeam,
      showKnownPlayerInfo:
        mode !== 'finished' && (
          input.roleKnowledgeOpen ||
          recognitionKnowledge ||
          mode === 'assassination'
        ),
      showPrivateRoleKnowledge: mode === 'finished' ? false : showPrivateRoleKnowledge,
      showSettledTeamVoteDetails: input.showSettledTeamVoteDetails,
      showRoundDecorations: mode !== 'assassination' && mode !== 'finished',
      showConnectionStatus: mode !== 'finished',
      showRoleReveal: mode === 'finished',
      interactionMode: playerInteractionMode,
      seatChangeTargetID: input.seatChangeTargetID,
      selectedTarget: mode !== 'finished' && (playerInteractionMode === 'selectAssassinationTarget' || input.assassinationSubmissionPending === true)
        ? input.selectedTarget
        : null,
    }),
    playerInteractionMode,
    questProgress: buildQuestProgress(numPlayers, input.game, mode !== 'assassination'),
    center: buildCenter(mode, input.room, input.game, input.currentPlayerID),
    phase: buildPhase(mode, input),
    stageOverlay: buildOverlay(mode, input.game),
    utilities: {
      variant: mode === 'lobby' ? 'lobby' : 'game',
      showRoomExit: mode === 'lobby' || mode === 'finished',
      showIdentityKnowledge: input.game.status === 'playing' && mode !== 'identityRecognition',
      roleKnowledgeOpen: mode === 'finished' ? false : input.roleKnowledgeOpen,
    },
  }
}

type ReadyRoomSceneInput = Extract<BuildRoomScreenModelInput, { kind: 'ready' }>

function identityClue(game: AvalonPlayerView): RoomIdentityClue {
  const recognition = game.identityRecognition
  const viewer = game.viewer
  if (recognition === null || viewer.identityRecognition?.isParticipant !== true) {
    return { kind: 'none', targetPlayerIDs: [] }
  }

  if (recognition.step === 'evilRecognition' && viewer.loyalty === 'evil') {
    return { kind: 'evilAllies', targetPlayerIDs: viewer.knownEvilPlayerIDs }
  }
  if (recognition.step === 'merlinRecognition' && viewer.role === 'merlin') {
    return { kind: 'merlinEvil', targetPlayerIDs: viewer.knownEvilPlayerIDs }
  }
  if (recognition.step === 'percivalRecognition' && viewer.role === 'percival') {
    const [first, second, extra] = viewer.knownMerlinCandidatePlayerIDs
    if (first !== undefined && second !== undefined && extra === undefined) {
      return { kind: 'percivalCandidates', targetPlayerIDs: [first, second] }
    }
  }
  return { kind: 'none', targetPlayerIDs: [] }
}

function buildProductionSceneBase(
  input: ReadyRoomSceneInput,
  interactionMode: RoomPlayerInteractionMode,
  options: Readonly<{
    showCurrentQuest?: boolean
    showPrivateRoleKnowledge?: boolean
    showRoleReveal?: boolean
    showRoundDecorations?: boolean
    showKnownPlayerInfo?: boolean
    showConnectionStatus?: boolean
    selectedTarget?: PlayerID | null
  }> = {},
) {
  const playerCount = roomPlayerCount(input.room)
  return {
    matchID: input.matchID,
    playerCount,
    players: buildRoomPlayers({
      players: input.room.players,
      numPlayers: playerCount,
      currentPlayerID: input.currentPlayerID,
      phase: input.phase,
      viewerConnected: input.connected,
      ownerPlayerID: options.showRoleReveal === true ? null : input.room.ownerPlayerID,
      game: input.game,
      selectedTeam: options.showRoleReveal === true ? [] : input.selectedTeam,
      selectedTarget: options.selectedTarget ?? null,
      showKnownPlayerInfo: options.showKnownPlayerInfo ?? false,
      showPrivateRoleKnowledge: options.showPrivateRoleKnowledge ?? false,
      showSettledTeamVoteDetails: input.showSettledTeamVoteDetails,
      showRoundDecorations: options.showRoundDecorations,
      showConnectionStatus: options.showConnectionStatus,
      showRoleReveal: options.showRoleReveal,
      interactionMode,
      seatChangeTargetID: input.seatChangeTargetID,
    }),
    questProgress: buildQuestProgress(
      playerCount,
      input.game,
      options.showCurrentQuest ?? true,
    ),
  }
}

/**
 * Maps one player-filtered live snapshot and local presentation state to the
 * exactly correlated scene/action pair consumed by the production RoomScreen.
 */
export function buildRoomSceneBinding(
  input: BuildRoomScreenModelInput,
  events: RoomSceneEventHandlers,
): RoomSceneBinding {
  if (input.kind === 'loading') {
    return {
      scene: {
        kind: 'loading',
        matchID: input.matchID,
        playerCount: null,
        players: [],
        questProgress: buildQuestProgress(null, null),
        message: '正在进入房间，请稍候。',
      },
      actions: null,
    }
  }

  if (!input.connected) {
    return {
      scene: {
        kind: 'connectionRecovery',
        ...buildProductionSceneBase(input, 'none'),
        manualReconnectAvailable: input.manualReconnectAvailable,
      },
      actions: { onReconnect: events.onReconnect },
    }
  }

  const mode = resolveMode(input.game, input.phase)
  if (mode === 'lobby') {
    return {
      scene: {
        kind: 'lobby',
        ...buildProductionSceneBase(input, 'changeSeat'),
        occupiedCount: occupiedPlayerIDs(input.room).length,
        seatCount: roomPlayerCount(input.room),
        viewer: input.room.ownerPlayerID === input.currentPlayerID ? 'owner' : 'player',
        canStart: input.canStart && !input.startPending,
        startRequestState: input.startPending ? 'pending' : 'idle',
      },
      actions: {
        onActivatePlayer: events.onActivatePlayer,
        onStart: events.onStart,
      },
    }
  }

  if (mode === 'identityRecognition') {
    const recognition = input.game.identityRecognition
    const viewer = input.game.viewer.identityRecognition
    const isParticipant = viewer?.isParticipant === true
    const isRoleReveal = recognition?.step === 'roleReveal'
    return {
      scene: {
        kind: 'identityRecognition',
        ...buildProductionSceneBase(input, 'none', {
          showPrivateRoleKnowledge: isParticipant && isRoleReveal,
          showRoundDecorations: false,
          showKnownPlayerInfo: false,
        }),
        clue: identityClue(input.game),
        view: !isParticipant || viewer?.confirmed === true ? 'waiting' : 'revealed',
        confirmedCount: recognition?.confirmedCount ?? 0,
        participantCount: recognition?.participantCount ?? 0,
        confirmRequestState: input.identityRecognitionSubmissionPending === true ? 'pending' : 'idle',
      },
      actions: {
        onReveal: () => undefined,
        onRevealComplete: () => undefined,
        onConfirm: events.onConfirmIdentityRecognition,
      },
    }
  }

  if (mode === 'teamProposal') {
    const playerCount = roomPlayerCount(input.room)
    const requiredTeamSize = getQuestTeamSize(playerCount, input.game.questIndex)
    const isLeader = input.activeStage === 'leader' && input.game.leaderID === input.currentPlayerID
    const isSubmitting = isLeader && input.teamSubmissionPending === true
    return {
      scene: {
        kind: 'teamProposal',
        ...buildProductionSceneBase(input, isLeader ? 'selectTeam' : 'none', {
          showPrivateRoleKnowledge: input.roleKnowledgeOpen,
          showKnownPlayerInfo: input.roleKnowledgeOpen,
        }),
        questIndex: input.game.questIndex,
        requiredTeamSize,
        selectedCount: input.selectedTeam.length,
        consecutiveRejectedTeams: input.game.consecutiveRejectedTeams,
        perspective: isLeader ? 'leader' : 'observer',
        canSubmit: !isSubmitting && canSubmitTeam({
          activeStage: input.activeStage,
          leaderID: input.game.leaderID,
          playerID: input.currentPlayerID,
          requiredTeamSize,
          selectedTeam: input.selectedTeam,
        }),
        submitRequestState: isSubmitting ? 'pending' : 'idle',
      },
      actions: {
        onActivatePlayer: events.onActivatePlayer,
        onSubmitTeam: events.onSubmitTeam,
      },
    }
  }

  if (mode === 'teamVote') {
    const submittedVote = input.game.viewer.submittedVote
    const isSubmitting = submittedVote === undefined && input.teamVoteSubmissionPending === true
    return {
      scene: {
        kind: 'teamVote',
        ...buildProductionSceneBase(input, 'none', {
          showPrivateRoleKnowledge: input.roleKnowledgeOpen,
          showKnownPlayerInfo: input.roleKnowledgeOpen,
        }),
        questIndex: input.game.questIndex,
        submittedCount: input.game.submittedTeamVotePlayerIDs.length,
        participantCount: roomPlayerCount(input.room),
        consecutiveRejectedTeams: input.game.consecutiveRejectedTeams,
        view: submittedVote === undefined
          ? {
              kind: 'choosing',
              selectedVote: input.selectedTeamVote ?? null,
              canChoose: input.activeStage === 'vote' && !isSubmitting,
              submitRequestState: isSubmitting ? 'pending' : 'idle',
            }
          : { kind: 'waiting', submittedVote },
      },
      actions: {
        onSelectVote: events.onSelectTeamVote,
        onConfirmVote: events.onConfirmTeamVote,
      },
    }
  }

  if (mode === 'quest') {
    const settledQuest = input.game.questHistory.find(
      ({ questIndex }) => questIndex === input.game.questIndex,
    )
    const proposedTeam = input.game.proposedTeam ?? []
    const onTeam = proposedTeam.includes(input.currentPlayerID)
    const submittedCard = input.game.viewer.submittedQuestCard
    const isSubmitting = submittedCard === undefined && input.questCardSubmissionPending === true
    const canChoose = input.activeStage === 'quest' && onTeam && submittedCard === undefined && !isSubmitting
    const alignment = input.game.viewer.loyalty === 'evil' ? 'evil' : 'good'
    return {
      scene: {
        kind: 'quest',
        ...buildProductionSceneBase(input, 'none', {
          showPrivateRoleKnowledge: input.roleKnowledgeOpen,
          showKnownPlayerInfo: input.roleKnowledgeOpen,
        }),
        questIndex: input.game.questIndex,
        requiredSubmissionCount: proposedTeam.length,
        submittedCount: input.game.submittedQuestCardCount,
        view: settledQuest !== undefined
          ? {
              kind: 'result',
              succeeded: settledQuest.succeeded,
              successCount: settledQuest.successCount,
              failCount: settledQuest.failCount,
            }
          : !onTeam || submittedCard !== undefined
            ? {
                kind: 'waiting',
                participation: onTeam ? 'member' : 'observer',
                submittedCard: submittedCard ?? null,
              }
            : {
                kind: 'choosing',
                alignment,
                selectedCard: alignment === 'good' ? 'success' : input.selectedQuestCard ?? null,
                canChoose,
                submitRequestState: isSubmitting ? 'pending' : 'idle',
              },
      },
      actions: {
        onSelectCard: events.onSelectQuestCard,
        onConfirmCard: events.onConfirmQuestCard,
      },
    }
  }

  if (mode === 'assassination') {
    const isAssassin = input.game.viewer.role === 'assassin'
    const isSubmitting = isAssassin && input.assassinationSubmissionPending === true
    const targetID = input.game.result?.reason === 'assassination'
      ? input.game.result.targetID
      : undefined
    const targetRole = targetID === undefined ? undefined : input.game.revealedRoles?.[targetID]
    const resultView: Extract<RoomAssassinationView, { kind: 'result' }> | null =
      targetID !== undefined && targetRole !== undefined && input.game.result !== undefined
      ? {
          kind: 'result',
          targetPlayerID: targetID,
          targetRole,
          hit: targetRole === 'merlin',
          winner: input.game.result.winner,
        }
      : null
    const canSelectTarget = isAssassin && input.activeStage === 'assassin' && !isSubmitting
    return {
      scene: {
        kind: 'assassination',
        ...buildProductionSceneBase(input, canSelectTarget ? 'selectAssassinationTarget' : 'none', {
          showCurrentQuest: false,
          showPrivateRoleKnowledge: input.roleKnowledgeOpen,
          showRoundDecorations: false,
          showKnownPlayerInfo: true,
          selectedTarget: isAssassin ? input.selectedTarget : null,
        }),
        view: resultView ?? (isAssassin
          ? {
              kind: 'selecting',
              targetPlayerID: input.selectedTarget,
              canSubmit: canSelectTarget && input.selectedTarget !== null,
              submitRequestState: isSubmitting ? 'pending' : 'idle',
            }
          : {
              kind: 'observing',
              perspective: input.game.viewer.loyalty === 'evil' ? 'evil' : 'good',
            }),
      },
      actions: {
        onActivatePlayer: events.onActivatePlayer,
        onAssassinate: events.onAssassinate,
      },
    }
  }

  if (input.game.result === undefined) {
    throw new Error('Finished room is missing its settled result')
  }
  return {
    scene: {
      kind: 'gameResult',
      ...buildProductionSceneBase(input, 'none', {
        showCurrentQuest: false,
        showPrivateRoleKnowledge: false,
        showRoleReveal: true,
        showRoundDecorations: false,
        showKnownPlayerInfo: false,
        showConnectionStatus: false,
      }),
      winner: input.game.result.winner,
      reason: finishedResultReason(input.room, input.game.result),
      questScore: `任务 ${input.game.goodSuccesses} 成功 / ${input.game.evilFailures} 失败`,
    },
    actions: null,
  }
}

export interface UseRoomScreenControllerInput extends LobbyPresentationState, LobbyPresentationActions {
  activeStage: string | undefined
  canStart: boolean
  game: AvalonPlayerView | null
  matchID: string
  phase: string
  room: AvalonMatch | null
  currentPlayerID: PlayerID
  roomExitBusy: boolean
  seatChangeTargetID: PlayerID | null
  onAssassinate: (targetID: PlayerID) => void
  onCastTeamVote: (vote: TeamVote) => void
  onChangeSeat: (targetID: PlayerID) => void
  onConfirmIdentityRecognition: () => void
  onPlayQuestCard: (card: QuestCard) => void
  onProposeTeam: (team: PlayerID[]) => void
  onTeamSubmissionError?: (error: unknown) => void
  onTeamVoteSubmissionError?: (error: unknown) => void
  onQuestCardSubmissionError?: (error: unknown) => void
  onAssassinationSubmissionError?: (error: unknown) => void
  onIdentityRecognitionSubmissionError?: (error: unknown) => void
  onStart: () => void
}

export function useRoomScreenController(input: UseRoomScreenControllerInput) {
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([])
  const [teamSubmissionPending, setTeamSubmissionPending] = useState(false)
  const [selectedTeamVote, setSelectedTeamVote] = useState<TeamVote | null>(null)
  const [teamVoteSubmissionPending, setTeamVoteSubmissionPending] = useState(false)
  const [selectedQuestCard, setSelectedQuestCard] = useState<QuestCard | null>(null)
  const [questCardSubmissionPending, setQuestCardSubmissionPending] = useState(false)
  const [identityRecognitionSubmissionPending, setIdentityRecognitionSubmissionPending] = useState(false)
  const [assassinationSubmissionPending, setAssassinationSubmissionPending] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<PlayerID | null>(null)
  const [roleKnowledgeOpen, setRoleKnowledgeOpen] = useState(
    () => loadGameClientSettings().roleKnowledgeOpen,
  )
  const phase = input.game === null ? 'loading' : input.game.status === 'lobby' ? 'lobby' : input.phase

  useEffect(() => {
    setSelectedTeam([])
    setTeamSubmissionPending(false)
  }, [input.game?.leaderID, input.game?.questIndex])
  useEffect(() => {
    if (phase === 'teamProposal') return
    setSelectedTeam([])
    setTeamSubmissionPending(false)
  }, [phase])
  useEffect(() => {
    if (phase === 'teamVote') return
    setSelectedTeamVote(null)
    setTeamVoteSubmissionPending(false)
  }, [phase])
  useEffect(() => {
    if (input.game?.viewer.submittedVote === undefined) return
    setTeamVoteSubmissionPending(false)
  }, [input.game?.viewer.submittedVote])
  useEffect(() => {
    setSelectedQuestCard(null)
    setQuestCardSubmissionPending(false)
  }, [input.game?.questIndex])
  useEffect(() => {
    if (phase === 'quest') return
    setSelectedQuestCard(null)
    setQuestCardSubmissionPending(false)
  }, [phase])
  useEffect(() => {
    if (input.game?.viewer.submittedQuestCard === undefined) return
    setQuestCardSubmissionPending(false)
  }, [input.game?.viewer.submittedQuestCard])
  useEffect(() => {
    if (phase !== 'identityRecognition') {
      setIdentityRecognitionSubmissionPending(false)
      return
    }
    if (input.game?.viewer.identityRecognition?.confirmed === true) {
      setIdentityRecognitionSubmissionPending(false)
    }
  }, [input.game?.viewer.identityRecognition?.confirmed, phase])
  useEffect(() => {
    setIdentityRecognitionSubmissionPending(false)
  }, [input.game?.identityRecognition?.step])
  useEffect(() => {
    const synchronizeRoleKnowledge = (event: StorageEvent) => {
      if (event.key === GAME_CLIENT_SETTINGS_KEY) {
        setRoleKnowledgeOpen(loadGameClientSettings().roleKnowledgeOpen)
      }
    }
    window.addEventListener('storage', synchronizeRoleKnowledge)
    return () => window.removeEventListener('storage', synchronizeRoleKnowledge)
  }, [])
  useEffect(() => {
    if (phase !== 'assassination') setSelectedTarget(null)
  }, [phase])
  useEffect(() => {
    if (phase === 'assassination') return
    setAssassinationSubmissionPending(false)
  }, [phase])

  const events: RoomSceneEventHandlers = {
    onActivatePlayer: (playerID) => {
      if (phase === 'lobby' && input.connected) input.onChangeSeat(playerID)
      if (
        phase === 'teamProposal' &&
        input.game !== null &&
        input.activeStage === 'leader' &&
        input.game.leaderID === input.currentPlayerID &&
        !teamSubmissionPending
      ) {
        const requiredTeamSize = getQuestTeamSize(
          input.room === null ? 5 : roomPlayerCount(input.room),
          input.game.questIndex,
        )
        setSelectedTeam((previous) => toggleTeamMember(previous, playerID, requiredTeamSize))
      }
      if (
        phase === 'assassination' &&
        input.game?.viewer.role === 'assassin' &&
        input.activeStage === 'assassin' &&
        !assassinationSubmissionPending
      ) setSelectedTarget(playerID)
    },
    onStart: input.onStart,
    onReconnect: input.onReconnect,
    onConfirmIdentityRecognition: () => {
      if (
        phase !== 'identityRecognition' ||
        input.game?.viewer.identityRecognition?.isParticipant !== true ||
        input.game.viewer.identityRecognition.confirmed ||
        identityRecognitionSubmissionPending
      ) return
      setIdentityRecognitionSubmissionPending(true)
      try {
        input.onConfirmIdentityRecognition()
      } catch (error) {
        setIdentityRecognitionSubmissionPending(false)
        input.onIdentityRecognitionSubmissionError?.(error)
      }
    },
    onSubmitTeam: () => {
      if (input.room === null || input.game === null) return
      const requiredTeamSize = getQuestTeamSize(roomPlayerCount(input.room), input.game.questIndex)
      if (teamSubmissionPending || !canSubmitTeam({
        activeStage: input.activeStage,
        leaderID: input.game.leaderID,
        playerID: input.currentPlayerID,
        requiredTeamSize,
        selectedTeam,
      })) return
      setTeamSubmissionPending(true)
      try {
        input.onProposeTeam(selectedTeam)
      } catch (error) {
        setTeamSubmissionPending(false)
        input.onTeamSubmissionError?.(error)
      }
    },
    onSelectTeamVote: (vote) => {
      if (
        phase === 'teamVote' &&
        input.activeStage === 'vote' &&
        input.game?.viewer.submittedVote === undefined &&
        !teamVoteSubmissionPending
      ) setSelectedTeamVote(vote)
    },
    onConfirmTeamVote: () => {
      if (
        phase !== 'teamVote' ||
        input.activeStage !== 'vote' ||
        input.game?.viewer.submittedVote !== undefined ||
        teamVoteSubmissionPending ||
        selectedTeamVote === null
      ) return
      setTeamVoteSubmissionPending(true)
      try {
        input.onCastTeamVote(selectedTeamVote)
      } catch (error) {
        setTeamVoteSubmissionPending(false)
        input.onTeamVoteSubmissionError?.(error)
      }
    },
    onSelectQuestCard: (card) => {
      if (
        phase !== 'quest' ||
        input.activeStage !== 'quest' ||
        input.game?.viewer.loyalty !== 'evil' ||
        input.game.viewer.submittedQuestCard !== undefined ||
        questCardSubmissionPending
      ) return
      setSelectedQuestCard(card)
    },
    onConfirmQuestCard: () => {
      if (
        phase !== 'quest' ||
        input.activeStage !== 'quest' ||
        input.game === null ||
        !input.game.proposedTeam?.includes(input.currentPlayerID) ||
        input.game.viewer.submittedQuestCard !== undefined ||
        questCardSubmissionPending
      ) return
      const selectedCard = input.game.viewer.loyalty === 'evil' ? selectedQuestCard : 'success'
      if (selectedCard === null) return
      setQuestCardSubmissionPending(true)
      try {
        input.onPlayQuestCard(selectedCard)
      } catch (error) {
        setQuestCardSubmissionPending(false)
        input.onQuestCardSubmissionError?.(error)
      }
    },
    onAssassinate: () => {
      if (
        phase !== 'assassination' ||
        input.activeStage !== 'assassin' ||
        input.game?.viewer.role !== 'assassin' ||
        assassinationSubmissionPending ||
        selectedTarget === null
      ) return
      setAssassinationSubmissionPending(true)
      try {
        input.onAssassinate(selectedTarget)
      } catch (error) {
        setAssassinationSubmissionPending(false)
        input.onAssassinationSubmissionError?.(error)
      }
    },
  }

  const binding = input.room === null || input.game === null
    ? buildRoomSceneBinding(
        { kind: 'loading', matchID: input.matchID, numPlayers: null },
        events,
      )
    : buildRoomSceneBinding({
        kind: 'ready', matchID: input.matchID, room: input.room, game: input.game,
        phase: input.game.status === 'lobby' ? 'lobby' : input.phase,
        activeStage: input.activeStage, currentPlayerID: input.currentPlayerID,
        selectedTeam, selectedTarget, roleKnowledgeOpen, canStart: input.canStart,
        roomExitBusy: input.roomExitBusy, connected: input.connected,
        manualReconnectAvailable: input.manualReconnectAvailable,
        startPending: input.startPending,
        teamSubmissionPending,
        selectedTeamVote,
        teamVoteSubmissionPending,
        selectedQuestCard,
        questCardSubmissionPending,
        assassinationSubmissionPending,
        identityRecognitionSubmissionPending,
        seatChangeTargetID: input.seatChangeTargetID,
      }, events)

  const toggleRoleKnowledge = () => {
    const next = !roleKnowledgeOpen
    setRoleKnowledgeOpen(next)
    saveGameClientSettings({ roleKnowledgeOpen: next })
  }

  return { binding, roleKnowledgeOpen, toggleRoleKnowledge }
}
