import { BadgeCheck, CircleCheck, CircleX, House } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  resolveRoomShellMetrics,
  solveRoundTableStageLayout,
  type PlayerSeatLayout,
} from '@avalon/ui-layout'
import type {
  AvalonPlayerView,
  PlayerID,
  QuestCard,
  TeamVote,
  TeamVoteResult,
} from '@avalon/game'

import { ConnectionRecoveryControl } from './ConnectionRecoveryControl'
import { HelpTrigger } from './HelpTrigger'
import {
  GAME_CLIENT_SETTINGS_KEY,
  loadGameClientSettings,
  saveGameClientSettings,
} from './game-client-settings'
import { IdentityRecognitionLayer } from './IdentityRecognitionLayer'
import type { LobbyPlayer } from './lobby'
import { QuestProgressTrack } from './QuestProgressTrack'
import { RoleAvatar } from './RoleCard'
import {
  canSubmitTeam,
  getDisplayedTeamVoteResult,
  getPhaseLabel,
  getQuestTeamSize,
  ROLE_LABELS,
  toggleTeamMember,
} from './room-game'
import { buildRoundTableSeats, type RoundTableSeat } from './RoundTable'
import { PlayerAvatar } from './player-avatars'
import type { PlayerProfile } from './player-profile'
import { RoomGameShell } from './RoomGameShell'
import { RoomLogControl } from './RoomLogControl'
import { RoundTableQuestSummary } from './RoundTableQuestSummary'
import { SolvedRoundTableStage } from './SolvedRoundTableStage'
import type { RoomLogEntry } from './room-log'
import { useObservedContentSize } from './useObservedContentSize'

interface RoomGamePanelProps {
  activeStage: string | undefined
  connected: boolean
  game: AvalonPlayerView
  manualReconnectAvailable: boolean
  logEntries: readonly RoomLogEntry[]
  matchID: string
  onAssassinate: (targetID: PlayerID) => void
  onBackHome: () => void
  onCastTeamVote: (vote: TeamVote) => void
  onConfirmIdentityRecognition: () => void
  onOpenHelp: () => void
  onPlayQuestCard: (card: QuestCard) => void
  onProposeTeam: (team: PlayerID[]) => void
  onReconnect: () => void
  onSaveProfile: (profile: PlayerProfile) => void
  phase: string
  playerID: PlayerID
  players: readonly LobbyPlayer[]
  profile: PlayerProfile
  ownerPlayerID: string | null
}

export function RoomGamePanel({
  activeStage,
  connected,
  game,
  manualReconnectAvailable,
  logEntries,
  matchID,
  onAssassinate,
  onBackHome,
  onCastTeamVote,
  onConfirmIdentityRecognition,
  onOpenHelp,
  onPlayQuestCard,
  onProposeTeam,
  onReconnect,
  phase,
  playerID,
  players,
  ownerPlayerID,
}: RoomGamePanelProps) {
  const playerIDs = Object.keys(game.players).sort((left, right) => Number(left) - Number(right))
  const seats = buildRoundTableSeats(players, playerIDs.length, playerID, ownerPlayerID)
  const playerNames = Object.fromEntries(seats.map((seat) => [seat.playerID, seat.name]))
  const requiredTeamSize = getQuestTeamSize(playerIDs.length, game.questIndex)
  const displayedTeamVoteResult = getDisplayedTeamVoteResult(game, phase)
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([])
  const [selectedTarget, setSelectedTarget] = useState<PlayerID | null>(null)
  const [showRoleKnowledge, setShowRoleKnowledge] = useState(
    () => loadGameClientSettings().roleKnowledgeOpen,
  )
  const isLeader = game.leaderID === playerID
  const canSelectTeam = phase === 'teamProposal' && activeStage === 'leader' && isLeader
  const canSelectAssassinationTarget = phase === 'assassination' && activeStage === 'assassin' && game.viewer.role === 'assassin' && game.status === 'playing'
  const canSubmit = canSubmitTeam({ activeStage, leaderID: game.leaderID, playerID, requiredTeamSize, selectedTeam })
  const phaseLabel = game.status === 'finished' ? '对局结束' : getPhaseLabel(phase)
  const identityRecognitionActive =
    phase === 'identityRecognition' && game.identityRecognition !== null
  const showRecognitionKnowledge =
    identityRecognitionActive &&
    game.viewer.identityRecognition?.isParticipant === true &&
    game.identityRecognition?.step !== 'roleReveal'
  const showPrivateRoleKnowledge = game.status === 'playing' && showRoleKnowledge
  const canvasSize = useObservedContentSize<HTMLElement>()
  const stageSize = useObservedContentSize<HTMLDivElement>()
  const layoutMetrics = useMemo(
    () => canvasSize.size === null ? null : resolveRoomShellMetrics(canvasSize.size),
    [canvasSize.size],
  )
  const stageLayout = useMemo(
    () => stageSize.size === null
      ? null
      : solveRoundTableStageLayout({
          maxStageWidth: stageSize.size.width,
          maxStageHeight: stageSize.size.height,
          playerCount: playerIDs.length,
        }),
    [playerIDs.length, stageSize.size],
  )

  useEffect(() => {
    setSelectedTeam([])
  }, [game.leaderID, game.questIndex])

  useEffect(() => {
    setSelectedTarget(null)
  }, [phase])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== GAME_CLIENT_SETTINGS_KEY) return
      setShowRoleKnowledge(loadGameClientSettings().roleKnowledgeOpen)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const toggleRoleKnowledge = () => {
    const nextValue = !showRoleKnowledge
    setShowRoleKnowledge(nextValue)
    saveGameClientSettings({ roleKnowledgeOpen: nextValue })
  }

  const toggleSeat = (currentPlayerID: PlayerID) => {
    if (canSelectTeam) {
      setSelectedTeam((previous) => toggleTeamMember(previous, currentPlayerID, requiredTeamSize))
      return
    }

    if (canSelectAssassinationTarget && isEligibleAssassinationTarget(game, playerID, currentPlayerID)) {
      setSelectedTarget(currentPlayerID)
    }
  }

  const phasePanelContent = getPhasePanelContent({
    activeStage,
    canSubmitTeam: canSubmit,
    displayedTeamVoteResult,
    game,
    onAssassinate: () => selectedTarget !== null && onAssassinate(selectedTarget),
    onCastTeamVote,
    onPlayQuestCard,
    onSubmitTeam: () => onProposeTeam(selectedTeam),
    phase,
    playerID,
    playerNames,
    requiredTeamSize,
    selectedTarget,
    selectedTeam,
  })

  const roleKnowledgeControl = !identityRecognitionActive && game.status === 'playing' ? (
    <button
      aria-controls="current-player-avatar"
      aria-label={showRoleKnowledge ? '隐藏我的身份与已知信息' : '查看我的身份与已知信息'}
      aria-pressed={showRoleKnowledge}
      className={`grid min-h-11 min-w-11 place-items-center rounded-lg border shadow-lg backdrop-blur transition ${showRoleKnowledge ? 'border-rose-300/60 bg-rose-950/85 text-rose-100' : 'border-white/15 bg-slate-950/80 text-slate-300 hover:border-white/35'}`}
      onClick={toggleRoleKnowledge}
      title={showRoleKnowledge ? '隐藏我的身份与已知信息' : '查看我的身份与已知信息'}
      type="button"
    >
      <EyeIcon hidden={!showRoleKnowledge} />
    </button>
  ) : null

  return (
    <RoomGameShell
      backAction={(
        <button aria-label="返回主页" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-lg font-medium text-slate-200 transition hover:text-white" onClick={onBackHome} type="button">
          <span aria-hidden="true">←</span>
        </button>
      )}
      canvasRef={canvasSize.ref}
      layoutMetrics={layoutMetrics}
      phaseAction={phasePanelContent.action}
      phaseMiddle={phasePanelContent.middle}
      phaseTitle={<p className="truncate text-sm font-semibold text-amber-100">{phaseLabel}</p>}
      phaseTools={roleKnowledgeControl}
      questProgress={<QuestProgressTrack game={game} numPlayers={playerIDs.length} />}
      roomStatus={(
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white">房间 {matchID.slice(0, 7)}</h1>
        </div>
      )}
      stage={(
        <>
          <SolvedRoundTableStage
            ariaLabel={`${playerIDs.length} 人游戏圆桌`}
            center={<RoundTableQuestSummary game={game} />}
            layout={stageLayout}
            measuredSize={stageSize.size}
            renderSeat={(seat, seatLayout) => (
              <GameSeat
                canSelect={canSelectTeam}
                canSelectAsTarget={canSelectAssassinationTarget && isEligibleAssassinationTarget(game, playerID, seat.playerID)}
                displayedTeamVoteResult={displayedTeamVoteResult}
                game={game}
                layout={seatLayout}
                onSelect={() => toggleSeat(seat.playerID)}
                seat={seat}
                selected={selectedTeam.includes(seat.playerID)}
                selectedAsTarget={selectedTarget === seat.playerID}
                showKnownPlayerInfo={showPrivateRoleKnowledge || showRecognitionKnowledge}
                showPrivateRoleKnowledge={showPrivateRoleKnowledge}
              />
            )}
            seats={seats}
          />
          {identityRecognitionActive && (
            <IdentityRecognitionLayer
              game={game}
              key={game.identityRecognition?.step}
              onConfirm={onConfirmIdentityRecognition}
            />
          )}
        </>
      )}
      stageRef={stageSize.ref}
      utilityActions={(
        <div className="flex items-center justify-end gap-1">
          <ConnectionRecoveryControl connected={connected} manualReconnectAvailable={manualReconnectAvailable} onReconnect={onReconnect} />
          <HelpTrigger onOpen={onOpenHelp} variant="icon" />
          <RoomLogControl entries={logEntries} />
        </div>
      )}
    />
  )
}

type PhasePanelContent = Readonly<{
  action: ReactNode
  middle: ReactNode
}>

function getPhasePanelContent({ activeStage, canSubmitTeam, displayedTeamVoteResult, game, onAssassinate, onCastTeamVote, onPlayQuestCard, onSubmitTeam, phase, playerID, playerNames, requiredTeamSize, selectedTeam, selectedTarget }: {
  activeStage: string | undefined
  canSubmitTeam: boolean
  displayedTeamVoteResult: TeamVoteResult | undefined
  game: AvalonPlayerView
  onAssassinate: () => void
  onCastTeamVote: (vote: TeamVote) => void
  onPlayQuestCard: (card: QuestCard) => void
  onSubmitTeam: () => void
  phase: string
  playerID: PlayerID
  playerNames: Readonly<Record<PlayerID, string>>
  requiredTeamSize: number
  selectedTeam: readonly PlayerID[]
  selectedTarget: PlayerID | null
}): PhasePanelContent {
  if (game.status === 'finished' && game.result !== undefined) {
    return {
      action: (
        <div className="text-center text-xs text-slate-300">
          {displayedTeamVoteResult !== undefined && <TeamVoteResultSummary result={displayedTeamVoteResult} />}
          {game.revealedRoles !== undefined && <p>所有玩家的角色已公开。</p>}
        </div>
      ),
      middle: <GameResult game={game} playerNames={playerNames} />,
    }
  }

  const voteResultSummary = displayedTeamVoteResult === undefined
    ? null
    : <TeamVoteResultSummary result={displayedTeamVoteResult} />

  if (phase === 'teamProposal') {
    const isLeader = game.leaderID === playerID
    return {
      action: (
        <button aria-label={`确认队伍 ${selectedTeam.length}/${requiredTeamSize}`} className="min-h-11 w-full rounded-xl bg-cyan-200 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canSubmitTeam} onClick={onSubmitTeam} type="button">
          <span className="min-[360px]:hidden">确认 {selectedTeam.length}/{requiredTeamSize}</span>
          <span className="hidden min-[360px]:inline">确认队伍 {selectedTeam.length}/{requiredTeamSize}</span>
        </button>
      ),
      middle: (
        <div className="min-w-0">
          {voteResultSummary}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-cyan-100">选择 {requiredTeamSize} 名任务队员</p>
            <p className="phase-action-copy truncate text-xs text-slate-300">{isLeader && activeStage === 'leader' ? '选择圆桌上的玩家' : `等待 ${getPlayerName(game, game.leaderID, playerNames)} 组建任务队伍`}</p>
          </div>
        </div>
      ),
    }
  }

  if (phase === 'teamVote') {
    const submittedVote = game.viewer.submittedVote
    const canVote = activeStage === 'vote' && submittedVote === undefined
    return {
      action: submittedVote === undefined ? (
        <div className="phase-action-buttons grid grid-cols-2 gap-2">
          <button aria-label="赞成队伍" className="min-h-11 rounded-lg bg-emerald-200 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canVote} onClick={() => onCastTeamVote('approve')} type="button"><span className="phase-action-full-label">赞成队伍</span><span className="phase-action-compact-label">赞成</span></button>
          <button aria-label="反对队伍" className="min-h-11 rounded-lg bg-rose-200 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canVote} onClick={() => onCastTeamVote('reject')} type="button"><span className="phase-action-full-label">反对队伍</span><span className="phase-action-compact-label">反对</span></button>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-200">你已选择：{submittedVote === 'approve' ? '赞成' : '反对'}</p>
      ),
      middle: (
        <div>
          <p className="truncate text-xs text-slate-200">提案队伍：{(game.proposedTeam ?? []).map((id) => getPlayerName(game, id, playerNames)).join('、')}</p>
        <p aria-live="polite" className="text-center text-xs font-semibold text-amber-100" role="status">
          {game.submittedTeamVotePlayerIDs.length}/{Object.keys(game.players).length} 已投票
        </p>
        </div>
      ),
    }
  }

  if (phase === 'quest') {
    const isQuestMember = game.proposedTeam?.includes(playerID) === true
    const submittedCard = game.viewer.submittedQuestCard
    const canPlay = isQuestMember && activeStage === 'quest' && submittedCard === undefined

    const questStatus = !isQuestMember
      ? '等待任务队员提交任务牌'
      : submittedCard !== undefined
        ? `你已提交${submittedCard === 'success' ? '成功' : '失败'}，等待任务结算。`
        : '从你的任务手牌中选择一张；所有任务牌将在提交完成后统一结算。'

    return {
      action: canPlay ? (
        <div className={`phase-action-buttons grid gap-2 ${game.viewer.loyalty === 'evil' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button aria-label="让任务成功" className="min-h-11 rounded-lg border border-sky-100/30 bg-sky-300/90 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" onClick={() => onPlayQuestCard('success')} type="button"><span className="phase-action-full-label">让任务成功</span><span className="phase-action-compact-label">成功</span></button>
          {game.viewer.loyalty === 'evil' && (
            <button aria-label="让任务失败" className="min-h-11 rounded-lg border border-rose-100/30 bg-rose-300/90 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" onClick={() => onPlayQuestCard('fail')} type="button"><span className="phase-action-full-label">让任务失败</span><span className="phase-action-compact-label">失败</span></button>
          )}
        </div>
      ) : null,
      middle: (
        <div>
          {voteResultSummary}
          <p className={`truncate text-center text-xs ${submittedCard === undefined ? 'text-slate-200' : 'text-amber-100'}`}>{questStatus}</p>
        </div>
      ),
    }
  }

  if (phase === 'assassination') {
    if (game.viewer.role !== 'assassin' || activeStage !== 'assassin') {
      return {
        action: null,
        middle: <p className="text-center text-xs text-rose-100"><span className="sm:hidden">等待刺客行动</span><span className="hidden sm:inline">三次任务已经成功，等待刺客决定最后的命运。</span></p>,
      }
    }

    return {
      action: <button className="min-h-11 w-full rounded-xl bg-rose-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={selectedTarget === null} onClick={onAssassinate} type="button">确认目标</button>,
      middle: (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-rose-100">刺杀梅林</p>
          <p className="phase-action-copy mt-0.5 truncate text-xs text-slate-300">{selectedTarget === null ? '选择一名正义阵营玩家作为刺杀目标' : `目标：${getPlayerName(game, selectedTarget, playerNames)}`}</p>
        </div>
      ),
    }
  }

  if (phase === 'identityRecognition') {
    return { action: null, middle: null }
  }

  return {
    action: null,
    middle: <p className="text-center text-xs text-cyan-100">正在同步游戏状态。</p>,
  }
}

function GameSeat({ canSelect, canSelectAsTarget, displayedTeamVoteResult, game, layout, onSelect, seat, selected, selectedAsTarget, showKnownPlayerInfo, showPrivateRoleKnowledge }: {
  canSelect: boolean
  canSelectAsTarget: boolean
  displayedTeamVoteResult: TeamVoteResult | undefined
  game: AvalonPlayerView
  layout: PlayerSeatLayout
  onSelect: () => void
  seat: RoundTableSeat
  selected: boolean
  selectedAsTarget: boolean
  showKnownPlayerInfo: boolean
  showPrivateRoleKnowledge: boolean
}) {
  const isLeader = game.leaderID === seat.playerID
  const onQuestTeam = game.proposedTeam?.includes(seat.playerID) === true
  const knownEvil = showKnownPlayerInfo && game.viewer.knownEvilPlayerIDs.includes(seat.playerID)
  const knownMerlinCandidate = showKnownPlayerInfo &&
    game.status !== 'finished' &&
    (game.viewer.knownMerlinCandidatePlayerIDs ?? []).includes(seat.playerID)
  const revealedRole = game.revealedRoles?.[seat.playerID]
  const privateRole = showPrivateRoleKnowledge && seat.isCurrentPlayer
    ? game.viewer.role
    : null
  const avatarRole = game.status === 'finished'
    ? revealedRole ?? null
    : privateRole
  const visibleRole = revealedRole ?? null
  const teamVoteStatus = displayedTeamVoteResult?.votes[seat.playerID]
    ?? (game.submittedTeamVotePlayerIDs.includes(seat.playerID) ? 'pending' : undefined)
  const teamVoteStatusLabel = teamVoteStatus === 'approve'
    ? '赞成'
    : teamVoteStatus === 'reject'
      ? '反对'
      : teamVoteStatus === 'pending'
        ? '已投票'
        : null
  const avatarClasses = selectedAsTarget
    ? 'border-rose-200 bg-rose-950 text-rose-50 shadow-[0_0_26px_rgba(251,113,133,0.7)]'
    : selected || onQuestTeam
      ? 'border-cyan-100 bg-cyan-950 text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.7)]'
      : knownEvil
        ? 'border-rose-700 bg-gradient-to-br from-rose-950 to-slate-950 text-rose-100 shadow-[0_0_24px_rgba(127,29,29,0.65)]'
    : seat.isCurrentPlayer
      ? 'border-amber-200 bg-[#efe3c6] text-amber-50 shadow-[0_0_22px_rgba(251,191,36,0.4)]'
      : 'border-[#d8c69f]/70 bg-[#efe3c6] text-slate-900'
  const seatAction = canSelect
    ? `选择 ${seat.name} 加入任务队伍`
    : canSelectAsTarget
      ? `选择 ${seat.name} 作为刺杀目标`
      : revealedRole !== undefined
        ? `${seat.name} · ${ROLE_LABELS[revealedRole]}`
        : seat.name
  const seatStatuses = [
    isLeader ? '队长' : null,
    onQuestTeam ? '任务队员' : null,
    !seat.connected ? '已断线' : null,
    knownEvil ? '已知阵营信息：邪恶' : null,
    knownMerlinCandidate ? 'Merlin 候选' : null,
    teamVoteStatusLabel,
  ].filter((status): status is string => status !== null)
  const seatLabel = [seatAction, ...seatStatuses].join('，')
  const localRect = (rect: PlayerSeatLayout['avatarRect']): CSSProperties => ({
    left: rect.x - layout.playerSeatBounds.x,
    top: rect.y - layout.playerSeatBounds.y,
    width: rect.width,
    height: rect.height,
  })

  return (
    <button
      aria-label={seatLabel}
      aria-pressed={canSelect
        ? selected
        : canSelectAsTarget
          ? selectedAsTarget
          : undefined}
      className={`game-seat-button pointer-events-none relative size-full border-0 bg-transparent p-0 text-center ${canSelect || canSelectAsTarget ? 'cursor-pointer' : 'cursor-default'}`}
      data-round-table-player
      data-player-id={seat.playerID}
      disabled={!canSelect && !canSelectAsTarget}
      onClick={onSelect}
      type="button"
    >
      <div className="game-seat-avatar-hit pointer-events-auto absolute" style={localRect(layout.avatarRect)}>
        {isLeader && <CrownIcon />}
        {seat.isOwner && <span aria-label="房间拥有者" className="seat-owner-badge pointer-events-none absolute -left-1 -top-1 z-20 grid size-5 place-items-center rounded-full bg-amber-300 text-slate-950 shadow-lg"><House aria-hidden="true" className="size-3" /></span>}
        <div
          className={`relative grid size-full min-h-0 min-w-0 max-h-full max-w-full shrink-0 place-items-center overflow-hidden rounded-full border-2 font-semibold transition ${avatarClasses} ${!seat.connected ? 'grayscale opacity-45' : ''}`}
          data-round-table-avatar
          id={seat.isCurrentPlayer ? 'current-player-avatar' : undefined}
        >
          {avatarRole === null
            ? <PlayerAvatar avatarID={seat.avatarID} className="size-full object-contain p-[12%]" />
            : <RoleAvatar className="size-full object-cover" role={avatarRole} />}
        </div>
        {knownEvil && <KnownEvilEmblem />}
        {knownMerlinCandidate && <MerlinCandidateBadge />}
      </div>
      <div className="game-seat-name-hit pointer-events-auto absolute" data-label-placement={seat.labelPlacement} style={localRect(layout.nameRect)}>
        <div className="relative size-full" data-round-table-label-anchor>
          <div className={`grid size-full items-center rounded-md border px-1 shadow-lg ${selectedAsTarget ? 'border-rose-200/70 bg-rose-950/95' : selected || onQuestTeam ? 'border-cyan-200/70 bg-cyan-950/95' : seat.isCurrentPlayer ? 'border-amber-200/70 bg-amber-950/95' : 'border-white/15 bg-slate-950/90'}`} data-round-table-nameplate title={`${seat.seatNumber}. ${seat.name}${revealedRole === undefined ? '' : ` · ${ROLE_LABELS[revealedRole]}`}`}>
            <p className="truncate text-[0.7rem] font-medium leading-tight text-white">
              {seat.seatNumber}. {seat.name}
            </p>
            {visibleRole !== null && <p className="truncate text-[0.6rem] font-semibold leading-tight text-amber-200" data-visible-role={visibleRole}>{ROLE_LABELS[visibleRole]}</p>}
          </div>
          {teamVoteStatus !== undefined && (
            <TeamVoteStatusIcon
              side={seat.labelPlacement === 'right' ? 'left' : 'right'}
              status={teamVoteStatus}
            />
          )}
          {privateRole !== null && (
            <p
              className="pointer-events-none absolute left-1/2 top-[calc(100%+0.125rem)] w-max max-w-[calc(100%+2rem)] -translate-x-1/2 truncate rounded bg-slate-950/90 px-1 py-px text-[clamp(0.48rem,1.8vw,0.65rem)] font-bold leading-tight text-amber-200 shadow-lg"
              data-current-role-label={privateRole}
            >
              {ROLE_LABELS[privateRole]}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

function TeamVoteStatusIcon({ side, status }: {
  side: 'left' | 'right'
  status: TeamVote | 'pending'
}) {
  const label = status === 'approve'
    ? '赞成'
    : status === 'reject'
      ? '反对'
      : '已投票'
  const colorClasses = status === 'approve'
    ? 'text-emerald-200'
    : status === 'reject'
      ? 'text-rose-200'
      : 'text-slate-200'

  return (
    <span
      aria-hidden="true"
      className={`team-vote-indicator pointer-events-none absolute top-1/2 grid size-[clamp(0.9rem,3vw,1.2rem)] -translate-y-1/2 place-items-center ${side === 'left' ? 'right-[calc(100%+0.25rem)]' : 'left-[calc(100%+0.25rem)]'} ${colorClasses}`}
      data-team-vote-status={status}
      title={label}
    >
      {status === 'pending' ? (
        <BadgeCheck className="size-full" strokeWidth={2.25} />
      ) : status === 'approve' ? (
        <CircleCheck className="size-full" strokeWidth={2.25} />
      ) : (
        <CircleX className="size-full" strokeWidth={2.25} />
      )}
    </span>
  )
}

function CrownIcon() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -top-[clamp(0.85rem,3vw,1.35rem)] left-1/2 z-10 h-[clamp(1.25rem,4vw,2rem)] w-[clamp(1.6rem,5vw,2.5rem)] -translate-x-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" viewBox="0 0 40 28">
      <path d="M3 7l9 7 8-12 8 12 9-7-4 18H7L3 7z" fill="#fbbf24" stroke="#fef3c7" strokeWidth="1.5" />
    </svg>
  )
}

function KnownEvilEmblem() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid size-[clamp(1rem,3.5vw,1.5rem)] place-items-center rounded-full border border-rose-200/70 bg-rose-950 text-rose-100 shadow-lg" data-known-player-info>
      <svg className="h-2/3 w-2/3" viewBox="0 0 24 24">
        <path d="M12 3l8 4v5c0 4.8-3.3 8-8 9-4.7-1-8-4.2-8-9V7l8-4z" fill="currentColor" />
        <path d="M8 10l2.2 1.4L8.8 14M16 10l-2.2 1.4 1.4 2.6" fill="none" stroke="#4c0519" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    </span>
  )
}

function MerlinCandidateBadge() {
  return (
    <span aria-label="Merlin 候选" className="knowledge-badge knowledge-badge--merlin-candidate pointer-events-none">
      <span aria-hidden="true">?</span>
    </span>
  )
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      {hidden && <path d="M4 4l16 16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />}
    </svg>
  )
}

function GameResult({ game, playerNames }: { game: AvalonPlayerView; playerNames: Readonly<Record<PlayerID, string>> }) {
  const result = game.result
  if (result === undefined) return null

  const reason = result.reason === 'five_rejections'
    ? '连续五次队伍提案被否决'
    : result.reason === 'three_quests'
      ? '邪恶阵营破坏了三次任务'
      : result.winner === 'evil'
        ? '刺客命中了梅林'
        : '刺杀未命中梅林'
  return (
    <div className="text-center">
      <p className={`font-serif text-lg font-bold ${result.winner === 'good' ? 'text-sky-100' : 'text-rose-100'}`}>
        {result.winner === 'good' ? '正义阵营获胜' : '邪恶阵营获胜'}
      </p>
      <p className="mt-1 text-xs text-amber-50/75">
        {reason}{result.targetID === undefined ? '' : ` · 目标 ${getPlayerName(game, result.targetID, playerNames)}`}
      </p>
    </div>
  )
}

function TeamVoteResultSummary({ result }: { result: TeamVoteResult }) {
  const approvalCount = Object.values(result.votes).filter(
    (vote) => vote === 'approve',
  ).length
  const rejectionCount = Object.keys(result.votes).length - approvalCount

  return (
    <p
      aria-live="polite"
      className={`team-vote-result-summary mb-1 text-center text-xs font-semibold ${result.approved ? 'text-emerald-200' : 'text-rose-200'}`}
      role="status"
    >
      <span className="team-vote-result-full">队伍{result.approved ? '通过' : '否决'} · {approvalCount} 赞成 / {rejectionCount} 反对</span>
      <span className="team-vote-result-compact">{result.approved ? '通过' : '否决'} · {approvalCount}赞成 / {rejectionCount}反对</span>
    </p>
  )
}

function isEligibleAssassinationTarget(
  game: AvalonPlayerView,
  playerID: PlayerID,
  targetID: PlayerID,
) {
  return targetID !== playerID && !game.viewer.knownEvilPlayerIDs.includes(targetID)
}

function getPlayerName(game: AvalonPlayerView, playerID: PlayerID | null, playerNames: Readonly<Record<PlayerID, string>>) {
  if (playerID === null) return '队长'
  return playerNames[playerID] ?? game.players[playerID]?.name ?? `玩家 ${Number(playerID) + 1}`
}
