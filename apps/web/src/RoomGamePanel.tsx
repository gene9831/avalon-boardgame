import { useEffect, useState } from 'react'
import type {
  AvalonPlayerView,
  PlayerID,
  TeamVote,
} from '@avalon/game'

import {
  canSubmitTeam,
  getQuestTeamSize,
  LOYALTY_LABELS,
  ROLE_LABELS,
  toggleTeamMember,
} from './room-game'

interface RoomGamePanelProps {
  activeStage: string | undefined
  game: AvalonPlayerView | null
  onCastTeamVote: (vote: TeamVote) => void
  onProposeTeam: (team: PlayerID[]) => void
  phase: string | undefined
  playerID: PlayerID
}

export function RoomGamePanel({
  activeStage,
  game,
  onCastTeamVote,
  onProposeTeam,
  phase,
  playerID,
}: RoomGamePanelProps) {
  if (game === null || phase === undefined || phase === 'lobby') {
    return null
  }

  const playerIDs = Object.keys(game.players).sort(
    (left, right) => Number(left) - Number(right),
  )

  return (
    <section className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
      <RoleSummary game={game} />

      {phase === 'teamProposal' && (
        <TeamProposalPanel
          activeStage={activeStage}
          game={game}
          onProposeTeam={onProposeTeam}
          playerID={playerID}
          playerIDs={playerIDs}
        />
      )}

      {phase === 'teamVote' && (
        <TeamVotePanel
          activeStage={activeStage}
          game={game}
          onCastTeamVote={onCastTeamVote}
        />
      )}

      {phase !== 'teamProposal' && phase !== 'teamVote' && (
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">
          当前阶段：{getPhaseLabel(phase)}。对应操作界面将在后续模块接入。
        </div>
      )}
    </section>
  )
}

function RoleSummary({
  game,
}: {
  game: AvalonPlayerView
}) {
  const { role, loyalty, knownEvilPlayerIDs } = game.viewer
  const knownEvilNames = knownEvilPlayerIDs.map((knownID) =>
    getPlayerName(game, knownID),
  )

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Your role
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            {role === null ? '身份尚未分配' : ROLE_LABELS[role]}
          </h3>
        </div>
        {loyalty !== null && (
          <span className="rounded-full bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100">
            {LOYALTY_LABELS[loyalty]}
          </span>
        )}
      </div>

      {knownEvilNames.length > 0 && (
        <p className="mt-4 text-sm leading-6 text-amber-50/80">
          你知道的邪恶阵营：{knownEvilNames.join('、')}
        </p>
      )}
    </div>
  )
}

function TeamProposalPanel({
  activeStage,
  game,
  onProposeTeam,
  playerID,
  playerIDs,
}: {
  activeStage: string | undefined
  game: AvalonPlayerView
  onProposeTeam: (team: PlayerID[]) => void
  playerID: PlayerID
  playerIDs: PlayerID[]
}) {
  const requiredTeamSize = getQuestTeamSize(
    playerIDs.length,
    game.questIndex,
  )
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([])
  const isLeader = game.leaderID === playerID
  const canInteract = activeStage === 'leader' && isLeader
  const canSubmit = canSubmitTeam({
    activeStage,
    leaderID: game.leaderID,
    playerID,
    requiredTeamSize,
    selectedTeam,
  })

  useEffect(() => {
    setSelectedTeam([])
  }, [game.leaderID, game.questIndex])

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Team proposal
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">选择任务队伍</h3>
        </div>
        <span className="rounded-full bg-slate-950/40 px-3 py-1.5 text-sm text-slate-200">
          第 {game.questIndex + 1} 次任务 · 需要 {requiredTeamSize} 人
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        {canInteract
          ? '你是队长，请选择本次任务的队员。'
          : `等待座位 ${Number(game.leaderID ?? 0) + 1} 的队长完成选队。`}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {playerIDs.map((currentPlayerID) => {
          const selected = selectedTeam.includes(currentPlayerID)
          const disabled = !canInteract || (!selected && selectedTeam.length >= requiredTeamSize)

          return (
            <button
              aria-pressed={selected}
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-cyan-300/80 bg-cyan-300/15 text-white'
                  : 'border-white/10 bg-slate-950/30 text-slate-200 hover:border-cyan-300/50'
              }`}
              disabled={disabled}
              key={currentPlayerID}
              onClick={() =>
                setSelectedTeam((previous) =>
                  toggleTeamMember(previous, currentPlayerID, requiredTeamSize),
                )
              }
              type="button"
            >
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                座位 {Number(currentPlayerID) + 1}
              </span>
              <span className="mt-2 block font-medium">{getPlayerName(game, currentPlayerID)}</span>
              <span className="mt-1 block text-xs text-slate-400">
                {selected ? '已加入队伍' : '点击选择'}
              </span>
            </button>
          )
        })}
      </div>

      <button
        className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canSubmit}
        onClick={() => onProposeTeam(selectedTeam)}
        type="button"
      >
        提交队伍（{selectedTeam.length}/{requiredTeamSize}）
      </button>
    </div>
  )
}

function TeamVotePanel({
  activeStage,
  game,
  onCastTeamVote,
}: {
  activeStage: string | undefined
  game: AvalonPlayerView
  onCastTeamVote: (vote: TeamVote) => void
}) {
  const proposedTeam = game.proposedTeam ?? []
  const submittedVote = game.viewer.submittedVote
  const canVote = activeStage === 'vote' && submittedVote === undefined

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Team vote
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">投票决定队伍</h3>
        </div>
        <span className="rounded-full bg-slate-950/40 px-3 py-1.5 text-sm text-slate-200">
          等待全员提交
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
        <p className="text-sm text-slate-400">本次提案队伍</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {proposedTeam.map((currentPlayerID) => (
            <span
              className="rounded-full bg-cyan-300/15 px-3 py-1.5 text-sm font-medium text-cyan-100"
              key={currentPlayerID}
            >
              座位 {Number(currentPlayerID) + 1} · {getPlayerName(game, currentPlayerID)}
            </span>
          ))}
        </div>
      </div>

      {submittedVote === undefined ? (
        <>
          <p className="mt-5 text-sm leading-6 text-slate-300">
            请选择是否批准这支队伍。所有玩家提交后，投票结果才会公开。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canVote}
              onClick={() => onCastTeamVote('approve')}
              type="button"
            >
              同意队伍
            </button>
            <button
              className="rounded-xl bg-rose-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canVote}
              onClick={() => onCastTeamVote('reject')}
              type="button"
            >
              拒绝队伍
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          你已投票：{submittedVote === 'approve' ? '同意' : '拒绝'}。等待其他玩家完成投票。
        </div>
      )}
    </div>
  )
}

function getPlayerName(game: AvalonPlayerView, playerID: PlayerID) {
  return game.players[playerID]?.name ?? `玩家 ${Number(playerID) + 1}`
}

function getPhaseLabel(phase: string) {
  switch (phase) {
    case 'assassination':
      return '刺杀'
    case 'quest':
      return '任务'
    default:
      return phase
  }
}
