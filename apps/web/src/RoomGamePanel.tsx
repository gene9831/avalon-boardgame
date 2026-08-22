import { useEffect, useState, type CSSProperties } from 'react'
import type { AvalonPlayerView, PlayerID, QuestCard, TeamVote } from '@avalon/game'

import type { LobbyPlayer } from './lobby'
import { QuestBoard } from './QuestBoard'
import {
  canSubmitTeam,
  getQuestTeamSize,
  LOYALTY_LABELS,
  ROLE_LABELS,
  toggleTeamMember,
} from './room-game'
import { buildRoundTableSeats, type RoundTableSeat } from './RoomLobbyPanel'

interface RoomGamePanelProps {
  activeStage: string | undefined
  connected: boolean
  game: AvalonPlayerView
  matchID: string
  onAssassinate: (targetID: PlayerID) => void
  onBackHome: () => void
  onCastTeamVote: (vote: TeamVote) => void
  onPlayQuestCard: (card: QuestCard) => void
  onProposeTeam: (team: PlayerID[]) => void
  onReconnect: () => void
  phase: string
  playerID: PlayerID
  players: readonly LobbyPlayer[]
}

export function RoomGamePanel({
  activeStage,
  connected,
  game,
  matchID,
  onAssassinate,
  onBackHome,
  onCastTeamVote,
  onPlayQuestCard,
  onProposeTeam,
  onReconnect,
  phase,
  playerID,
  players,
}: RoomGamePanelProps) {
  const playerIDs = Object.keys(game.players).sort((left, right) => Number(left) - Number(right))
  const seats = buildRoundTableSeats(players, playerIDs.length, playerID)
  const playerNames = Object.fromEntries(seats.map((seat) => [seat.playerID, seat.name]))
  const requiredTeamSize = getQuestTeamSize(playerIDs.length, game.questIndex)
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([])
  const [selectedTarget, setSelectedTarget] = useState<PlayerID | null>(null)
  const isLeader = game.leaderID === playerID
  const canSelectTeam = phase === 'teamProposal' && activeStage === 'leader' && isLeader
  const canSelectAssassinationTarget = phase === 'assassination' && activeStage === 'assassin' && game.viewer.role === 'assassin' && game.status === 'playing'
  const canSubmit = canSubmitTeam({ activeStage, leaderID: game.leaderID, playerID, requiredTeamSize, selectedTeam })
  const phaseLabel = game.status === 'finished' ? '游戏结束' : getPhaseLabel(phase)

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
    <section aria-label="阿瓦隆游戏圆桌" className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-2.5 shadow-2xl shadow-black/25 backdrop-blur sm:p-3 lg:p-4">
      <header className="flex shrink-0 items-center justify-between gap-2 px-1 pb-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-xs">Round table · {phaseLabel}</p>
          <h1 className="mt-0.5 truncate text-base font-semibold text-white sm:text-xl">房间 {matchID}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button aria-label="返回主页" className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-300/60 hover:text-white" onClick={onBackHome} type="button">
            <span aria-hidden="true" className="sm:hidden">←</span>
            <span className="hidden sm:inline">返回主页</span>
          </button>
          <ConnectionBadge connected={connected} />
        </div>
      </header>

      <div className="hidden min-h-0 flex-1 lg:block">
        <div className="relative h-full overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(ellipse_at_center,_rgba(66,48,28,0.56),_rgba(10,22,31,0.92)_70%)] shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]">
          <div className="absolute left-1/2 top-1/2 h-[66%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-amber-300/20 bg-[radial-gradient(ellipse_at_center,_rgba(91,65,35,0.34),_rgba(15,23,42,0.45)_70%)] shadow-[0_0_70px_rgba(245,158,11,0.08)]" />
          <div className="absolute left-1/2 top-1/2 z-10 w-[min(35vw,30rem)] -translate-x-1/2 -translate-y-1/2">
            <QuestBoard game={game} numPlayers={playerIDs.length} phaseLabel={phaseLabel}>{phaseAction}</QuestBoard>
          </div>
          <div className="pointer-events-none absolute inset-x-0 inset-y-0 z-20">
            {seats.map((seat) => (
              <GameSeat
                canSelect={canSelectTeam}
                canSelectAsTarget={canSelectAssassinationTarget && isEligibleAssassinationTarget(game, playerID, seat.playerID)}
                className="absolute w-36"
                game={game}
                key={seat.playerID}
                onSelect={() => toggleSeat(seat.playerID)}
                seat={seat}
                selected={selectedTeam.includes(seat.playerID)}
                selectedAsTarget={selectedTarget === seat.playerID}
                style={{ left: `${seat.left}%`, top: `${seat.top}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-amber-300/15 bg-slate-950/35 p-2 lg:hidden">
        <QuestBoard game={game} numPlayers={playerIDs.length} phaseLabel={phaseLabel}>{phaseAction}</QuestBoard>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {seats.map((seat) => (
            <GameSeat canSelect={canSelectTeam} canSelectAsTarget={canSelectAssassinationTarget && isEligibleAssassinationTarget(game, playerID, seat.playerID)} className="min-h-0" compact game={game} key={seat.playerID} onSelect={() => toggleSeat(seat.playerID)} seat={seat} selected={selectedTeam.includes(seat.playerID)} selectedAsTarget={selectedTarget === seat.playerID} />
          ))}
        </div>
      </div>

      <RoleSummary game={game} onReconnect={onReconnect} playerNames={playerNames} />
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-cyan-100">选择任务队伍</p>
          <p className="mt-0.5 truncate text-[0.7rem] text-slate-300">{isLeader && activeStage === 'leader' ? `点击圆桌座位，选择 ${requiredTeamSize} 名队员` : `等待 ${getPlayerName(game, game.leaderID, playerNames)} 完成选队`}</p>
        </div>
        <button className="shrink-0 rounded-xl bg-cyan-200 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canSubmitTeam} onClick={onSubmitTeam} type="button">提交 {selectedTeam.length}/{requiredTeamSize}</button>
      </div>
    )
  }

  if (phase === 'teamVote') {
    const submittedVote = game.viewer.submittedVote
    const canVote = activeStage === 'vote' && submittedVote === undefined
    return (
      <div>
        <p className="text-xs text-slate-200">提案队伍：{(game.proposedTeam ?? []).map((id) => getPlayerName(game, id, playerNames)).join('、')}</p>
        {submittedVote === undefined ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="rounded-lg bg-emerald-200 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canVote} onClick={() => onCastTeamVote('approve')} type="button">同意队伍</button>
            <button className="rounded-lg bg-rose-200 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canVote} onClick={() => onCastTeamVote('reject')} type="button">拒绝队伍</button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-100">你已投票：{submittedVote === 'approve' ? '同意' : '拒绝'}。等待其他玩家。</p>
        )}
      </div>
    )
  }

  if (phase === 'quest') {
    const isQuestMember = game.proposedTeam?.includes(playerID) === true
    const submittedCard = game.viewer.submittedQuestCard
    const canPlay = isQuestMember && activeStage === 'quest' && submittedCard === undefined

    if (!isQuestMember) {
      return <p className="text-center text-xs text-slate-200">你未进入本次任务队伍，等待队员秘密出牌。</p>
    }

    if (submittedCard !== undefined) {
      return <p className="text-center text-xs text-amber-100">你已提交 {submittedCard === 'success' ? 'Success' : 'Fail'}，等待任务结算。</p>
    }

    return (
      <div>
        <p className="text-center text-xs text-slate-200">从你的任务手牌中选择一张。所有牌将在提交完成后统一结算。</p>
        <div className={`mt-2 grid gap-2 ${game.viewer.loyalty === 'evil' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button className="rounded-lg border border-sky-100/30 bg-sky-300/90 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canPlay} onClick={() => onPlayQuestCard('success')} type="button">让任务成功</button>
          {game.viewer.loyalty === 'evil' && (
            <button className="rounded-lg border border-rose-100/30 bg-rose-300/90 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!canPlay} onClick={() => onPlayQuestCard('fail')} type="button">让任务失败</button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'assassination') {
    if (game.viewer.role !== 'assassin' || activeStage !== 'assassin') {
      return <p className="text-center text-xs text-rose-100">三次任务已经成功，等待刺客决定最后的命运。</p>
    }

    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-rose-100">刺杀梅林</p>
          <p className="mt-0.5 truncate text-[0.7rem] text-slate-300">{selectedTarget === null ? '点击圆桌上的正义阵营玩家选择目标' : `目标：${getPlayerName(game, selectedTarget, playerNames)}`}</p>
        </div>
        <button className="shrink-0 rounded-xl bg-rose-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={selectedTarget === null} onClick={onAssassinate} type="button">确认刺杀</button>
      </div>
    )
  }

  return <p className="text-center text-xs text-cyan-100">正在同步游戏状态。</p>
}

function GameSeat({ canSelect, canSelectAsTarget, className, compact = false, game, onSelect, seat, selected, selectedAsTarget, style }: {
  canSelect: boolean
  canSelectAsTarget: boolean
  className: string
  compact?: boolean
  game: AvalonPlayerView
  onSelect: () => void
  seat: RoundTableSeat
  selected: boolean
  selectedAsTarget: boolean
  style?: CSSProperties
}) {
  const isLeader = game.leaderID === seat.playerID
  const onQuestTeam = game.proposedTeam?.includes(seat.playerID) === true
  const knownEvil = game.viewer.knownEvilPlayerIDs.includes(seat.playerID)
  const revealedRole = game.revealedRoles?.[seat.playerID]
  const classes = selectedAsTarget
    ? 'border-rose-200/90 bg-rose-400/20 shadow-[0_0_24px_rgba(251,113,133,0.2)]'
    : selected || onQuestTeam
    ? 'border-cyan-200/80 bg-cyan-300/18 shadow-[0_0_22px_rgba(34,211,238,0.13)]'
    : seat.isCurrentPlayer
      ? 'border-amber-300/70 bg-amber-300/15'
      : 'border-white/10 bg-slate-950/80'

  return (
    <button aria-label={revealedRole !== undefined ? `${seat.name} · ${ROLE_LABELS[revealedRole]}` : canSelect ? `选择 ${seat.name} 加入任务队伍` : canSelectAsTarget ? `选择 ${seat.name} 作为刺杀目标` : undefined} aria-pressed={canSelect ? selected : canSelectAsTarget ? selectedAsTarget : undefined} className={`${className} pointer-events-auto rounded-2xl border text-left transition ${compact ? 'p-2' : 'p-2.5'} ${classes} ${canSelect || canSelectAsTarget ? 'cursor-pointer hover:border-cyan-200' : 'cursor-default'}`} disabled={!canSelect && !canSelectAsTarget} onClick={onSelect} style={style} type="button">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">座位 {seat.seatNumber}</span>
        <span className="flex items-center gap-1 text-[0.6rem] font-semibold">
          {isLeader && <span className="text-amber-300">♛ 队长</span>}
          {seat.isCurrentPlayer && <span className="text-amber-200">你</span>}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-medium text-white">{seat.name}</p>
      <div className="mt-0.5 flex items-center justify-between gap-1 text-[0.65rem]">
        {revealedRole === undefined ? (
          <>
            <span className={seat.connected ? 'text-cyan-200/70' : 'text-slate-500'}>{seat.connected ? '已连接' : '连接中断'}</span>
            {knownEvil && <span className="text-rose-300">邪恶</span>}
            {selectedAsTarget && <span className="text-rose-200">刺杀目标</span>}
            {(selected || onQuestTeam) && <span className="text-cyan-200">任务队员</span>}
          </>
        ) : (
          <span className="truncate font-semibold text-amber-100">{ROLE_LABELS[revealedRole]}</span>
        )}
      </div>
    </button>
  )
}

function RoleSummary({ game, onReconnect, playerNames }: { game: AvalonPlayerView; onReconnect: () => void; playerNames: Readonly<Record<PlayerID, string>> }) {
  const { role, loyalty, knownEvilPlayerIDs } = game.viewer
  const knownEvilNames = knownEvilPlayerIDs.map((knownID) => getPlayerName(game, knownID, playerNames))

  return (
    <aside className="mt-2 flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.08] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-300">你的身份</p>
        <p className="truncate text-sm font-semibold text-white">{role === null ? '尚未分配' : ROLE_LABELS[role]}{loyalty !== null && <span className="ml-2 text-xs font-normal text-amber-100/70">{LOYALTY_LABELS[loyalty]}</span>}</p>
        {knownEvilNames.length > 0 && <p className="truncate text-[0.65rem] text-rose-100/70">你知道的邪恶阵营：{knownEvilNames.join('、')}</p>}
      </div>
      <button className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:border-white/30" onClick={onReconnect} type="button">重连</button>
    </aside>
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

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${connected ? 'bg-cyan-300/15 text-cyan-200' : 'bg-rose-300/15 text-rose-200'}`}>
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-cyan-300' : 'bg-rose-300'}`} />
      <span className="hidden sm:inline">{connected ? '已连接' : '连接中断'}</span>
    </span>
  )
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
    default: return phase
  }
}
