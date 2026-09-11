import { useEffect, useMemo, useState } from 'react'
import type {
  AvalonResult,
  AvalonPlayerView,
  PlayerID,
  QuestCard,
  TeamVote,
} from '@avalon/game'

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
    } & LobbyPresentationState>

function playerName(room: AvalonMatch, playerID: PlayerID | null): string {
  if (playerID === null) return '等待队长'
  return room.players.find(({ id }) => String(id) === playerID)?.name ?? `玩家 ${Number(playerID) + 1}`
}

function finishedResultReason(room: AvalonMatch, result: AvalonResult): string {
  if (result.reason === 'five_rejections') return '连续五次否决，邪恶阵营获胜'
  if (result.reason === 'three_quests') {
    return result.winner === 'good'
      ? '正义阵营完成三次任务'
      : '邪恶阵营破坏了三次任务'
  }

  const target = result.targetID === undefined
    ? ''
    : `：${playerName(room, result.targetID)}`
  return result.winner === 'evil'
    ? `刺客命中梅林${target}`
    : `刺杀未命中梅林${target}`
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
    }
  }
  return {
    kind: 'questSummary',
    questIndex: game.questIndex,
    goodSuccesses: game.goodSuccesses,
    evilFailures: game.evilFailures,
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
    return {
      kind: 'teamProposal', title: '组建任务队伍', requiredTeamSize,
      selectedCount: input.selectedTeam.length, leaderName: playerName(room, game.leaderID),
      canSubmit: canSubmitTeam({ activeStage: input.activeStage, leaderID: game.leaderID,
        playerID: currentPlayerID, requiredTeamSize, selectedTeam: input.selectedTeam }),
    }
  }
  if (mode === 'teamVote') {
    return {
      kind: 'teamVote', title: '表决任务队伍',
      proposedTeamNames: (game.proposedTeam ?? []).map((id) => playerName(room, id)),
      submittedCount: game.submittedTeamVotePlayerIDs.length, total,
      submittedVote: game.viewer.submittedVote ?? null,
      canVote: input.activeStage === 'vote' && game.viewer.submittedVote === undefined,
    }
  }
  if (mode === 'quest') {
    const onTeam = game.proposedTeam?.includes(currentPlayerID) === true
    const canPlay = input.activeStage === 'quest' && onTeam && game.viewer.submittedQuestCard === undefined
    return {
      kind: 'quest', title: '执行任务',
      status: onTeam ? '请选择任务牌' : '等待任务队员提交',
      submittedCard: game.viewer.submittedQuestCard ?? null,
      canPlaySuccess: canPlay, canPlayFail: canPlay && game.viewer.loyalty === 'evil',
    }
  }
  if (mode === 'assassination') {
    const isAssassin = game.viewer.role === 'assassin'
    return {
      kind: 'assassination', title: '刺杀阶段', isAssassin,
      targetName: input.selectedTarget === null ? null : playerName(room, input.selectedTarget),
      canSubmit: isAssassin && input.activeStage === 'assassin' && input.selectedTarget !== null,
    }
  }
  return {
    kind: 'finished', title: '对局结束',
    summary: game.result === undefined
      ? '对局已结束'
      : finishedResultReason(room, game.result),
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
      : mode === 'assassination' && input.activeStage === 'assassin' && input.game.viewer.role === 'assassin'
        ? 'selectAssassinationTarget'
        : 'none'
  const numPlayers = roomPlayerCount(input.room)

  return {
    mode, matchID: input.matchID, numPlayers, connected: input.connected,
    players: buildRoomPlayers({
      players: input.room.players, numPlayers, currentPlayerID: input.currentPlayerID,
      phase: input.phase,
      viewerConnected: input.connected,
      ownerPlayerID: input.room.ownerPlayerID, game: input.game,
      selectedTeam: input.selectedTeam, selectedTarget: input.selectedTarget,
      showKnownPlayerInfo:
        input.roleKnowledgeOpen ||
        recognitionKnowledge ||
        mode === 'assassination',
      showPrivateRoleKnowledge,
    }),
    playerInteractionMode,
    questProgress: buildQuestProgress(numPlayers, input.game),
    center: buildCenter(mode, input.room, input.game),
    phase: buildPhase(mode, input),
    stageOverlay: buildOverlay(mode, input.game),
    utilities: {
      variant: mode === 'lobby' ? 'lobby' : 'game',
      showRoomExit: mode === 'lobby',
      showIdentityKnowledge: input.game.status === 'playing' && mode !== 'identityRecognition',
      roleKnowledgeOpen: input.roleKnowledgeOpen,
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
  onAssassinate: (targetID: PlayerID) => void
  onCastTeamVote: (vote: TeamVote) => void
  onChangeSeat: (targetID: PlayerID) => void
  onConfirmIdentityRecognition: () => void
  onPlayQuestCard: (card: QuestCard) => void
  onProposeTeam: (team: PlayerID[]) => void
  onStart: () => void
}

export function useRoomScreenController(input: UseRoomScreenControllerInput) {
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([])
  const [selectedTarget, setSelectedTarget] = useState<PlayerID | null>(null)
  const [roleKnowledgeOpen, setRoleKnowledgeOpen] = useState(
    () => loadGameClientSettings().roleKnowledgeOpen,
  )
  const phase = input.game === null ? 'loading' : input.game.status === 'lobby' ? 'lobby' : input.phase

  useEffect(() => setSelectedTeam([]), [input.game?.leaderID, input.game?.questIndex])
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
    })
  }, [input.activeStage, input.canStart, input.connected, input.currentPlayerID, input.game, input.manualReconnectAvailable, input.matchID, input.phase, input.room, input.roomExitBusy, input.startPending, roleKnowledgeOpen, selectedTarget, selectedTeam])

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
    onSubmitTeam: () => input.onProposeTeam(selectedTeam),
    onCastTeamVote: input.onCastTeamVote,
    onPlayQuestCard: input.onPlayQuestCard,
    onAssassinate: () => {
      if (selectedTarget !== null) input.onAssassinate(selectedTarget)
    },
  }

  const toggleRoleKnowledge = () => {
    const next = !roleKnowledgeOpen
    setRoleKnowledgeOpen(next)
    saveGameClientSettings({ roleKnowledgeOpen: next })
  }

  return { model, actions, toggleRoleKnowledge }
}
