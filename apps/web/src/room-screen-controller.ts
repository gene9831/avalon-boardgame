import { useEffect, useRef, useState } from 'react'
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
import { canSubmitTeam, getQuestTeamSize, toggleTeamMember } from './room-game'
import {
  buildQuestProgress,
  buildRoomPlayers,
  buildRoomTeamTokens,
  type RoomPlayerInteractionMode,
} from './room-presentation'
import type {
  RoomActionsByKind,
  RoomAssassinationView,
  RoomIdentityClue,
  RoomIdentityRecognitionPresentation,
  RoomScene,
} from './room-screen-props'
import {
  establishSettlementBaseline,
  findNewSettlements,
  type RoomSettlement,
} from './room-settlement'
import {
  browserSettlementReadStorage,
  hasReadSettlement,
  markSettlementRead,
  type SettlementReadStorage,
} from './settlement-read'

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

export type BuildRoomSceneInput =
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
      teamSubmissionPending?: boolean
      selectedTeamVote?: TeamVote | null
      teamVoteSubmissionPending?: boolean
      selectedQuestCard?: QuestCard | null
      questCardSubmissionPending?: boolean
      showSettledTeamVoteDetails?: boolean
      assassinationSubmissionPending?: boolean
      identityRecognitionSubmissionPending?: boolean
      seatChangeTargetID?: PlayerID | null
      activeSettlement?: RoomSettlement | null
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
  onContinue?(): void
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

function resolveSceneKind(game: AvalonPlayerView, phase: string): Exclude<RoomScene['kind'], 'loading' | 'connectionRecovery' | 'identityConfirmation'> {
  if (game.status === 'lobby') return 'lobby'
  if (game.status === 'finished') return 'gameResult'
  if (
    phase === 'identityRecognition' ||
    phase === 'teamProposal' ||
    phase === 'teamVote' ||
    phase === 'quest' ||
    phase === 'assassination'
  ) return phase
  return 'teamProposal'
}

type ReadyRoomSceneInput = Extract<BuildRoomSceneInput, { kind: 'ready' }>

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
    showLeader?: boolean
    showKnownPlayerInfo?: boolean
    showConnectionStatus?: boolean
    selectedTarget?: PlayerID | null
    settledVotes?: Readonly<Record<PlayerID, TeamVote>>
    resolvedQuestTeam?: readonly PlayerID[]
    publicRevealedRolePlayerIDs?: readonly PlayerID[]
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
      settledVotes: options.settledVotes,
      resolvedQuestTeam: options.resolvedQuestTeam,
      publicRevealedRolePlayerIDs: options.publicRevealedRolePlayerIDs,
      showRoundDecorations: options.showRoundDecorations,
      showLeader: options.showLeader,
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
  input: BuildRoomSceneInput,
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

  const activeSettlement = input.activeSettlement ?? null
  if (activeSettlement?.kind === 'teamVote') {
    return {
      scene: {
        kind: 'teamVote',
        ...buildProductionSceneBase(input, 'none', {
          showLeader: false,
          settledVotes: activeSettlement.votes,
          resolvedQuestTeam: activeSettlement.team,
        }),
        questIndex: activeSettlement.questIndex,
        submittedCount: Object.keys(activeSettlement.votes).length,
        participantCount: roomPlayerCount(input.room),
        consecutiveRejectedTeams: input.game.consecutiveRejectedTeams,
        teamTokens: buildRoomTeamTokens(input.room, activeSettlement.team),
        view: {
          kind: 'result', approved: activeSettlement.approved,
          approvalCount: activeSettlement.approvalCount, rejectionCount: activeSettlement.rejectionCount,
          continueIntent: activeSettlement.continueIntent,
        },
      },
      actions: { onContinue: events.onContinue ?? (() => undefined) } as unknown as RoomActionsByKind['teamVote'],
    }
  }
  if (activeSettlement?.kind === 'quest') {
    return {
      scene: {
        kind: 'quest',
        ...buildProductionSceneBase(input, 'none', {
          resolvedQuestTeam: activeSettlement.team,
        }),
        questIndex: activeSettlement.questIndex,
        requiredSubmissionCount: activeSettlement.team.length,
        submittedCount: activeSettlement.team.length,
        view: {
          kind: 'result', succeeded: activeSettlement.succeeded,
          successCount: activeSettlement.successCount, failCount: activeSettlement.failCount,
          failThreshold: activeSettlement.failThreshold, continueIntent: activeSettlement.continueIntent,
        },
      },
      actions: { onContinue: events.onContinue ?? (() => undefined) } as unknown as RoomActionsByKind['quest'],
    }
  }
  if (activeSettlement?.kind === 'assassination') {
    return {
      scene: {
        kind: 'assassination',
        ...buildProductionSceneBase(input, 'none', {
          showCurrentQuest: false,
          showRoundDecorations: false,
          publicRevealedRolePlayerIDs: [activeSettlement.targetPlayerID],
        }),
        view: {
          kind: 'result', targetPlayerID: activeSettlement.targetPlayerID,
          targetRole: activeSettlement.targetRole, hit: activeSettlement.hit,
          winner: activeSettlement.winner, continueIntent: activeSettlement.continueIntent,
        },
      },
      actions: { onContinue: events.onContinue ?? (() => undefined) } as unknown as RoomActionsByKind['assassination'],
    }
  }

  const mode = resolveSceneKind(input.game, input.phase)
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
    const confirmRequestState = input.identityRecognitionSubmissionPending === true ? 'pending' : 'idle'
    let presentation: RoomIdentityRecognitionPresentation
    if (!isParticipant) {
      presentation = { kind: 'observer' }
    } else if (recognition?.step === 'roleReveal') {
      presentation = input.game.viewer.role === null
        ? { kind: 'observer' }
        : {
            kind: 'roleReveal',
            role: input.game.viewer.role,
            view: viewer.confirmed ? 'waiting' : 'revealed',
            confirmRequestState,
          }
    } else {
      presentation = {
        kind: 'clue',
        clue: identityClue(input.game),
        view: viewer?.confirmed === true ? 'waiting' : 'revealed',
        confirmRequestState,
      }
    }
    return {
      scene: {
        kind: 'identityRecognition',
        ...buildProductionSceneBase(input, 'none', {
          showRoundDecorations: false,
          showKnownPlayerInfo: false,
        }),
        presentation,
        confirmedCount: recognition?.confirmedCount ?? 0,
        participantCount: recognition?.participantCount ?? 0,
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
        teamTokens: isLeader ? buildRoomTeamTokens(input.room, input.selectedTeam) : [],
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
        teamTokens: buildRoomTeamTokens(input.room, input.game.proposedTeam ?? []),
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
              failThreshold: getPlayerCountConfig(roomPlayerCount(input.room)).questFailThresholds[settledQuest.questIndex] ?? 1,
              continueIntent: 'continue',
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
          continueIntent: 'gameResult',
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
  settlementReadStorage?: SettlementReadStorage | null
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
  const [activeSettlement, setActiveSettlement] = useState<RoomSettlement | null>(null)
  const [settlementQueue, setSettlementQueue] = useState<readonly RoomSettlement[]>([])
  const baselineRef = useRef<Readonly<{ matchID: string; baseline: ReturnType<typeof establishSettlementBaseline> }> | null>(null)
  const settlementStorage = input.settlementReadStorage ?? browserSettlementReadStorage()
  const phase = input.game === null ? 'loading' : input.game.status === 'lobby' ? 'lobby' : input.phase

  useEffect(() => {
    if (baselineRef.current?.matchID === input.matchID) return
    baselineRef.current = null
    setActiveSettlement(null)
    setSettlementQueue([])
  }, [input.matchID])

  useEffect(() => {
    if (!input.connected || input.game === null || input.room === null) return
    const observed = baselineRef.current
    if (observed === null || observed.matchID !== input.matchID) {
      baselineRef.current = { matchID: input.matchID, baseline: establishSettlementBaseline(input.game) }
      return
    }
    const appended = findNewSettlements(input.game, observed.baseline)
    baselineRef.current = { matchID: input.matchID, baseline: establishSettlementBaseline(input.game) }
    const unread = appended.filter((settlement) => !hasReadSettlement(settlementStorage, input.matchID, settlement.key))
    if (unread.length === 0) return
    setSettlementQueue((currentQueue) => {
      const known = new Set(currentQueue.map((settlement) => settlement.key))
      const additions = unread.filter((settlement) => settlement.key !== activeSettlement?.key && !known.has(settlement.key))
      return additions.length === 0 ? currentQueue : [...currentQueue, ...additions]
    })
  }, [input.connected, input.game, input.matchID, input.room, settlementStorage, activeSettlement?.key])

  useEffect(() => {
    if (activeSettlement !== null || settlementQueue.length === 0) return
    const [next, ...remaining] = settlementQueue
    setSettlementQueue(remaining)
    setActiveSettlement(next)
    markSettlementRead(settlementStorage, input.matchID, next!.key)
  }, [activeSettlement, input.matchID, settlementQueue, settlementStorage])

  useEffect(() => {
    if (input.connected) return
    setIdentityRecognitionSubmissionPending(false)
    setTeamSubmissionPending(false)
    setTeamVoteSubmissionPending(false)
    setQuestCardSubmissionPending(false)
    setAssassinationSubmissionPending(false)
  }, [input.connected])

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
    onContinue: () => setActiveSettlement(null),
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
        connected: input.connected,
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
        activeSettlement,
      }, events)

  const toggleRoleKnowledge = () => {
    const next = !roleKnowledgeOpen
    setRoleKnowledgeOpen(next)
    saveGameClientSettings({ roleKnowledgeOpen: next })
  }

  return { binding, roleKnowledgeOpen, toggleRoleKnowledge }
}
