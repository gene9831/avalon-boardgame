import { useEffect, useState } from 'react'
import type {
  AvalonPlayerView,
  PlayerID,
  QuestCard,
  Role,
  TeamVote,
} from '@avalon/game'

import { ConnectionRecoveryControl } from './ConnectionRecoveryControl'
import { IdentityRecognitionLayer } from './IdentityRecognitionLayer'
import type { LobbyPlayer } from './lobby'
import { QuestBoard } from './QuestBoard'
import {
  canSubmitTeam,
  getQuestTeamSize,
  ROLE_LABELS,
  toggleTeamMember,
} from './room-game'
import { buildRoundTableSeats, RoundTable, type RoundTableSeat } from './RoundTable'
import { PlayerProfileControl } from './PlayerProfileControl'
import { PlayerAvatar } from './player-avatars'
import type { PlayerProfile } from './player-profile'
import { RoomLogControl } from './RoomLogControl'
import type { RoomLogEntry } from './room-log'

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
  onPlayQuestCard: (card: QuestCard) => void
  onProposeTeam: (team: PlayerID[]) => void
  onReconnect: () => void
  onSaveProfile: (profile: PlayerProfile) => void
  phase: string
  playerID: PlayerID
  players: readonly LobbyPlayer[]
  profile: PlayerProfile
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
  onPlayQuestCard,
  onProposeTeam,
  onReconnect,
  onSaveProfile,
  phase,
  playerID,
  players,
  profile,
}: RoomGamePanelProps) {
  const playerIDs = Object.keys(game.players).sort((left, right) => Number(left) - Number(right))
  const seats = buildRoundTableSeats(players, playerIDs.length, playerID)
  const playerNames = Object.fromEntries(seats.map((seat) => [seat.playerID, seat.name]))
  const requiredTeamSize = getQuestTeamSize(playerIDs.length, game.questIndex)
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([])
  const [selectedTarget, setSelectedTarget] = useState<PlayerID | null>(null)
  const [showKnownPlayerInfo, setShowKnownPlayerInfo] = useState(false)
  const isLeader = game.leaderID === playerID
  const canSelectTeam = phase === 'teamProposal' && activeStage === 'leader' && isLeader
  const canSelectAssassinationTarget = phase === 'assassination' && activeStage === 'assassin' && game.viewer.role === 'assassin' && game.status === 'playing'
  const canSubmit = canSubmitTeam({ activeStage, leaderID: game.leaderID, playerID, requiredTeamSize, selectedTeam })
  const phaseLabel = game.status === 'finished' ? '游戏结束' : getPhaseLabel(phase)
  const identityRecognitionActive =
    phase === 'identityRecognition' && game.identityRecognition !== null
  const showRecognitionKnowledge =
    identityRecognitionActive &&
    game.viewer.identityRecognition?.isParticipant === true &&
    game.identityRecognition?.step !== 'roleReveal'

  useEffect(() => {
    setSelectedTeam([])
  }, [game.leaderID, game.questIndex])

  useEffect(() => {
    setSelectedTarget(null)
  }, [phase])

  const toggleSeat = (currentPlayerID: PlayerID) => {
    if (canSelectTeam) {
      setSelectedTeam((previous) => toggleTeamMember(previous, currentPlayerID, requiredTeamSize))
      return
    }

    if (canSelectAssassinationTarget && isEligibleAssassinationTarget(game, playerID, currentPlayerID)) {
      setSelectedTarget(currentPlayerID)
    }
  }

  const phaseAction = (
    <PhaseAction
      activeStage={activeStage}
      canSubmitTeam={canSubmit}
      game={game}
      onAssassinate={() => selectedTarget !== null && onAssassinate(selectedTarget)}
      onCastTeamVote={onCastTeamVote}
      onPlayQuestCard={onPlayQuestCard}
      onSubmitTeam={() => onProposeTeam(selectedTeam)}
      phase={phase}
      playerID={playerID}
      playerNames={playerNames}
      requiredTeamSize={requiredTeamSize}
      selectedTeam={selectedTeam}
      selectedTarget={selectedTarget}
    />
  )

  return (
    <section aria-label="阿瓦隆游戏圆桌" className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-2.5 shadow-2xl shadow-black/25 backdrop-blur sm:p-3 lg:p-4">
      <header className="round-table-header relative z-[80] flex shrink-0 items-center justify-between gap-2 px-1 pb-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button aria-label="返回主页" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-white/15 text-lg font-medium text-slate-200 transition hover:border-amber-300/60 hover:text-white" onClick={onBackHome} type="button">
            <span aria-hidden="true">←</span>
          </button>
          <div className="min-w-0">
            <p className="round-table-header-decoration text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-xs">Round table · {phaseLabel}</p>
            <h1 className="truncate text-sm font-semibold text-white sm:mt-0.5 sm:text-xl">房间 {matchID}</h1>
          </div>
        </div>
        <div className="mr-12 flex shrink-0 items-center gap-2">
          <ConnectionRecoveryControl connected={connected} manualReconnectAvailable={manualReconnectAvailable} onReconnect={onReconnect} />
          <RoomLogControl entries={logEntries} />
          <PlayerProfileControl locked onSave={onSaveProfile} profile={profile} />
        </div>
      </header>

      <div className="round-table-stage relative flex min-h-0 flex-1 items-center justify-center py-1">
        <RoundTable
          ariaLabel={`${playerIDs.length} 人游戏圆桌`}
          center={<QuestBoard game={game} numPlayers={playerIDs.length} phaseLabel={phaseLabel}>{phaseAction}</QuestBoard>}
          renderSeat={(seat) => (
            <GameSeat
              canSelect={canSelectTeam}
              canSelectAsTarget={canSelectAssassinationTarget && isEligibleAssassinationTarget(game, playerID, seat.playerID)}
              dense={playerIDs.length >= 7}
              game={game}
              onSelect={() => toggleSeat(seat.playerID)}
              seat={seat}
              selected={selectedTeam.includes(seat.playerID)}
              selectedAsTarget={selectedTarget === seat.playerID}
              showKnownPlayerInfo={showKnownPlayerInfo || showRecognitionKnowledge}
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
      </div>

      {!identityRecognitionActive && <button
        aria-label={showKnownPlayerInfo ? '隐藏已知角色信息' : '显示已知角色信息'}
        aria-pressed={showKnownPlayerInfo}
        className={`absolute bottom-2.5 left-2.5 z-40 grid min-h-11 min-w-11 place-items-center rounded-lg border shadow-lg backdrop-blur transition sm:bottom-3 sm:left-3 ${showKnownPlayerInfo ? 'border-rose-300/60 bg-rose-950/85 text-rose-100' : 'border-white/15 bg-slate-950/80 text-slate-300 hover:border-white/35'}`}
        onClick={() => setShowKnownPlayerInfo((visible) => !visible)}
        title={showKnownPlayerInfo ? '隐藏已知角色信息' : '显示已知角色信息'}
        type="button"
      >
        <EyeIcon hidden={!showKnownPlayerInfo} />
      </button>}
    </section>
  )
}

function PhaseAction({ activeStage, canSubmitTeam, game, onAssassinate, onCastTeamVote, onPlayQuestCard, onSubmitTeam, phase, playerID, playerNames, requiredTeamSize, selectedTeam, selectedTarget }: {
  activeStage: string | undefined
  canSubmitTeam: boolean
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
}) {
  if (game.status === 'finished' && game.result !== undefined) {
    return <GameResult game={game} playerNames={playerNames} />
  }

  if (phase === 'teamProposal') {
    const isLeader = game.leaderID === playerID
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="team-proposal-summary min-w-0">
          <p className="text-[clamp(0.6rem,1.8vw,0.75rem)] font-semibold text-cyan-100">选择 {requiredTeamSize} 名队员</p>
          <p className="phase-action-copy mt-0.5 hidden truncate text-[0.7rem] text-slate-300 sm:block">{isLeader && activeStage === 'leader' ? '点击头像选择' : `等待 ${getPlayerName(game, game.leaderID, playerNames)} 选队`}</p>
        </div>
        <button className="min-h-11 shrink-0 rounded-xl bg-cyan-200 px-2 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3" disabled={!canSubmitTeam} onClick={onSubmitTeam} type="button">提交 {selectedTeam.length}/{requiredTeamSize}</button>
      </div>
    )
  }

  if (phase === 'teamVote') {
    const submittedVote = game.viewer.submittedVote
    const canVote = activeStage === 'vote' && submittedVote === undefined
    return (
      <div>
        <p className="hidden text-xs text-slate-200 sm:block">提案队伍：{(game.proposedTeam ?? []).map((id) => getPlayerName(game, id, playerNames)).join('、')}</p>
        {submittedVote === undefined ? (
          <div className="phase-action-buttons mt-2 grid grid-cols-2 gap-2">
            <button className="min-h-11 rounded-lg bg-emerald-200 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canVote} onClick={() => onCastTeamVote('approve')} type="button"><span className="phase-action-full-label">同意队伍</span><span className="phase-action-compact-label">同意</span></button>
            <button className="min-h-11 rounded-lg bg-rose-200 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canVote} onClick={() => onCastTeamVote('reject')} type="button"><span className="phase-action-full-label">拒绝队伍</span><span className="phase-action-compact-label">拒绝</span></button>
          </div>
        ) : (
          <p className="text-center text-[0.6rem] text-amber-100 sm:mt-2 sm:text-xs"><span className="sm:hidden">已投票：{submittedVote === 'approve' ? '同意' : '拒绝'}，等待其他玩家</span><span className="hidden sm:inline">你已投票：{submittedVote === 'approve' ? '同意' : '拒绝'}。等待其他玩家。</span></p>
        )}
      </div>
    )
  }

  if (phase === 'quest') {
    const isQuestMember = game.proposedTeam?.includes(playerID) === true
    const submittedCard = game.viewer.submittedQuestCard
    const canPlay = isQuestMember && activeStage === 'quest' && submittedCard === undefined

    if (!isQuestMember) {
      return <p className="text-center text-[0.6rem] text-slate-200 sm:text-xs"><span className="sm:hidden">等待任务队员出牌</span><span className="hidden sm:inline">你未进入本次任务队伍，等待队员秘密出牌。</span></p>
    }

    if (submittedCard !== undefined) {
      return <p className="text-center text-[0.6rem] text-amber-100 sm:text-xs"><span className="sm:hidden">已提交 {submittedCard === 'success' ? 'Success' : 'Fail'}，等待结算</span><span className="hidden sm:inline">你已提交 {submittedCard === 'success' ? 'Success' : 'Fail'}，等待任务结算。</span></p>
    }

    return (
      <div>
        <p className="phase-action-copy hidden text-center text-xs text-slate-200 sm:block">从你的任务手牌中选择一张。所有牌将在提交完成后统一结算。</p>
        <div className={`phase-action-buttons mt-2 grid gap-2 ${game.viewer.loyalty === 'evil' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button className="min-h-11 rounded-lg border border-sky-100/30 bg-sky-300/90 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canPlay} onClick={() => onPlayQuestCard('success')} type="button"><span className="phase-action-full-label">让任务成功</span><span className="phase-action-compact-label">成功</span></button>
          {game.viewer.loyalty === 'evil' && (
            <button className="min-h-11 rounded-lg border border-rose-100/30 bg-rose-300/90 px-2 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canPlay} onClick={() => onPlayQuestCard('fail')} type="button"><span className="phase-action-full-label">让任务失败</span><span className="phase-action-compact-label">失败</span></button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'assassination') {
    if (game.viewer.role !== 'assassin' || activeStage !== 'assassin') {
      return <p className="text-center text-[0.6rem] text-rose-100 sm:text-xs"><span className="sm:hidden">等待刺客行动</span><span className="hidden sm:inline">三次任务已经成功，等待刺客决定最后的命运。</span></p>
    }

    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-rose-100">刺杀梅林</p>
          <p className="phase-action-copy mt-0.5 hidden truncate text-[0.7rem] text-slate-300 sm:block">{selectedTarget === null ? '点击圆桌上的正义阵营玩家选择目标' : `目标：${getPlayerName(game, selectedTarget, playerNames)}`}</p>
        </div>
        <button className="min-h-11 shrink-0 rounded-xl bg-rose-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={selectedTarget === null} onClick={onAssassinate} type="button">确认刺杀</button>
      </div>
    )
  }

  return <p className="text-center text-xs text-cyan-100">正在同步游戏状态。</p>
}

function GameSeat({ canSelect, canSelectAsTarget, dense, game, onSelect, seat, selected, selectedAsTarget, showKnownPlayerInfo }: {
  canSelect: boolean
  canSelectAsTarget: boolean
  dense: boolean
  game: AvalonPlayerView
  onSelect: () => void
  seat: RoundTableSeat
  selected: boolean
  selectedAsTarget: boolean
  showKnownPlayerInfo: boolean
}) {
  const isLeader = game.leaderID === seat.playerID
  const onQuestTeam = game.proposedTeam?.includes(seat.playerID) === true
  const knownEvil = showKnownPlayerInfo && game.viewer.knownEvilPlayerIDs.includes(seat.playerID)
  const revealedRole = game.revealedRoles?.[seat.playerID]
  const visibleRole = revealedRole ?? (seat.isCurrentPlayer ? game.viewer.role : null)
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
        : visibleRole !== null
          ? `${seat.name}，你的身份：${SHORT_ROLE_LABELS[visibleRole]}`
          : seat.name
  const seatStatuses = [
    isLeader ? '队长' : null,
    onQuestTeam ? '任务队员' : null,
    !seat.connected ? '已断线' : null,
    knownEvil ? '已知阵营信息：邪恶' : null,
  ].filter((status): status is string => status !== null)
  const seatLabel = [seatAction, ...seatStatuses].join('，')

  return (
    <button
      aria-label={seatLabel}
      aria-pressed={canSelect ? selected : canSelectAsTarget ? selectedAsTarget : undefined}
      className={`pointer-events-auto flex flex-col items-center border-0 bg-transparent p-0 text-center transition ${dense ? 'w-[clamp(3.1rem,14vw,6.5rem)]' : 'w-[clamp(4.2rem,17vw,8rem)]'} ${canSelect || canSelectAsTarget ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
      data-round-table-player
      disabled={!canSelect && !canSelectAsTarget}
      onClick={onSelect}
      type="button"
    >
      <div className="relative">
        {isLeader && <CrownIcon />}
        <div className={`${dense ? 'size-[clamp(2.5rem,9.5vw,4.5rem)]' : 'size-[clamp(3rem,12vw,5.5rem)]'} grid shrink-0 place-items-center overflow-hidden rounded-full border-2 text-[clamp(0.9rem,4vw,1.8rem)] font-semibold transition ${avatarClasses} ${!seat.connected ? 'grayscale opacity-45' : ''}`} data-round-table-avatar>
          <PlayerAvatar avatarID={seat.avatarID} className="size-full object-contain p-[12%]" />
        </div>
        {knownEvil && <KnownEvilEmblem />}
      </div>
      <div className={`mt-1 w-full rounded-md border px-1.5 py-0.5 shadow-lg ${selectedAsTarget ? 'border-rose-200/70 bg-rose-950/95' : selected || onQuestTeam ? 'border-cyan-200/70 bg-cyan-950/95' : seat.isCurrentPlayer ? 'border-amber-200/70 bg-amber-950/95' : 'border-white/15 bg-slate-950/90'}`} data-label-placement={seat.labelPlacement} data-round-table-nameplate title={`${seat.seatNumber}. ${seat.name}${revealedRole === undefined ? '' : ` · ${ROLE_LABELS[revealedRole]}`}`}>
        <p className="truncate text-[clamp(0.58rem,2.4vw,0.8rem)] font-medium leading-tight text-white">
          {seat.seatNumber}. {seat.name}
        </p>
        {visibleRole !== null && <p className="truncate text-[clamp(0.5rem,2vw,0.7rem)] font-semibold leading-tight text-amber-200" data-visible-role={visibleRole}>{SHORT_ROLE_LABELS[visibleRole]}</p>}
      </div>
    </button>
  )
}

function CrownIcon() {
  return (
    <svg aria-hidden="true" className="absolute -top-[clamp(0.85rem,3vw,1.35rem)] left-1/2 z-10 h-[clamp(1.25rem,4vw,2rem)] w-[clamp(1.6rem,5vw,2.5rem)] -translate-x-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" viewBox="0 0 40 28">
      <path d="M3 7l9 7 8-12 8 12 9-7-4 18H7L3 7z" fill="#fbbf24" stroke="#fef3c7" strokeWidth="1.5" />
    </svg>
  )
}

function KnownEvilEmblem() {
  return (
    <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 grid size-[clamp(1rem,3.5vw,1.5rem)] place-items-center rounded-full border border-rose-200/70 bg-rose-950 text-rose-100 shadow-lg" data-known-player-info>
      <svg className="h-2/3 w-2/3" viewBox="0 0 24 24">
        <path d="M12 3l8 4v5c0 4.8-3.3 8-8 9-4.7-1-8-4.2-8-9V7l8-4z" fill="currentColor" />
        <path d="M8 10l2.2 1.4L8.8 14M16 10l-2.2 1.4 1.4 2.6" fill="none" stroke="#4c0519" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
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
      {game.revealedRoles !== undefined && <p className="mt-2 text-[0.65rem] text-slate-300">所有角色已在圆桌座位上公开。</p>}
    </div>
  )
}

function isEligibleAssassinationTarget(
  game: AvalonPlayerView,
  playerID: PlayerID,
  targetID: PlayerID,
) {
  return targetID !== playerID && !game.viewer.knownEvilPlayerIDs.includes(targetID)
}

const SHORT_ROLE_LABELS: Record<Role, string> = {
  assassin: '刺客',
  loyal_servant: '忠臣',
  merlin: '梅林',
  minion: '爪牙',
}

function getPlayerName(game: AvalonPlayerView, playerID: PlayerID | null, playerNames: Readonly<Record<PlayerID, string>>) {
  if (playerID === null) return '队长'
  return playerNames[playerID] ?? game.players[playerID]?.name ?? `玩家 ${Number(playerID) + 1}`
}

function getPhaseLabel(phase: string) {
  switch (phase) {
    case 'teamProposal': return '队伍提案'
    case 'teamVote': return '队伍投票'
    case 'assassination': return '刺杀阶段'
    case 'quest': return '任务进行中'
    case 'identityRecognition': return '身份辨认'
    default: return phase
  }
}
