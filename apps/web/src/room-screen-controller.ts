import { useEffect, useMemo, useState } from 'react'
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
  type RoomScreenActions,
  type RoomScreenMode,
  type RoomScreenModel,
  type RoomStageOverlayModel,
} from './room-screen-model'

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
      seatChangeTargetID?: PlayerID | null
    } & LobbyPresentationState>

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
  onStart: () => void
}

export function useRoomScreenController(input: UseRoomScreenControllerInput) {
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([])
  const [teamSubmissionPending, setTeamSubmissionPending] = useState(false)
  const [selectedTeamVote, setSelectedTeamVote] = useState<TeamVote | null>(null)
  const [teamVoteSubmissionPending, setTeamVoteSubmissionPending] = useState(false)
  const [selectedQuestCard, setSelectedQuestCard] = useState<QuestCard | null>(null)
  const [questCardSubmissionPending, setQuestCardSubmissionPending] = useState(false)
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

  const model = useMemo(() => {
    if (input.room === null || input.game === null) {
      return buildRoomScreenModel({ kind: 'loading', matchID: input.matchID, numPlayers: null })
    }
    return buildRoomScreenModel({
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
      seatChangeTargetID: input.seatChangeTargetID,
    })
  }, [assassinationSubmissionPending, input.activeStage, input.canStart, input.connected, input.currentPlayerID, input.game, input.manualReconnectAvailable, input.matchID, input.phase, input.room, input.roomExitBusy, input.seatChangeTargetID, input.startPending, questCardSubmissionPending, roleKnowledgeOpen, selectedQuestCard, selectedTarget, selectedTeam, selectedTeamVote, teamSubmissionPending, teamVoteSubmissionPending])

  const actions: RoomScreenActions = {
    onActivatePlayer: (playerID) => {
      if (model.playerInteractionMode === 'changeSeat') input.onChangeSeat(playerID)
      if (model.playerInteractionMode === 'selectTeam' && model.phase.kind === 'teamProposal') {
        const requiredTeamSize = model.phase.requiredTeamSize
        setSelectedTeam((previous) => toggleTeamMember(previous, playerID, requiredTeamSize))
      }
      if (model.playerInteractionMode === 'selectAssassinationTarget') setSelectedTarget(playerID)
    },
    onStart: input.onStart,
    onReconnect: input.onReconnect,
    onConfirmIdentityRecognition: input.onConfirmIdentityRecognition,
    onSubmitTeam: () => {
      if (model.phase.kind !== 'teamProposal' || !model.phase.canSubmit) return
      setTeamSubmissionPending(true)
      try {
        input.onProposeTeam(selectedTeam)
      } catch (error) {
        setTeamSubmissionPending(false)
        input.onTeamSubmissionError?.(error)
      }
    },
    onSelectTeamVote: (vote) => {
      if (model.phase.kind === 'teamVote' && model.phase.canVote) setSelectedTeamVote(vote)
    },
    onConfirmTeamVote: () => {
      if (
        model.phase.kind !== 'teamVote' ||
        !model.phase.canVote ||
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
      if (model.phase.kind !== 'quest' || !model.phase.canSelect || !model.phase.isEvil) return
      setSelectedQuestCard(card)
    },
    onConfirmQuestCard: () => {
      if (model.phase.kind !== 'quest' || !model.phase.canConfirm || model.phase.selectedCard === null) return
      setQuestCardSubmissionPending(true)
      try {
        input.onPlayQuestCard(model.phase.selectedCard)
      } catch (error) {
        setQuestCardSubmissionPending(false)
        input.onQuestCardSubmissionError?.(error)
      }
    },
    onAssassinate: () => {
      if (model.phase.kind !== 'assassination' || !model.phase.canSubmit || selectedTarget === null) return
      setAssassinationSubmissionPending(true)
      try {
        input.onAssassinate(selectedTarget)
      } catch (error) {
        setAssassinationSubmissionPending(false)
        input.onAssassinationSubmissionError?.(error)
      }
    },
  }

  const toggleRoleKnowledge = () => {
    const next = !roleKnowledgeOpen
    setRoleKnowledgeOpen(next)
    saveGameClientSettings({ roleKnowledgeOpen: next })
  }

  return { model, actions, toggleRoleKnowledge }
}
