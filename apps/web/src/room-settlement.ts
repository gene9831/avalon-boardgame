import {
  getPlayerCountConfig,
  type AvalonPlayerView,
  type PlayerID,
  type Role,
  type TeamVote,
  type VictoryWinner,
} from '@avalon/game'

export type SettlementContinueIntent = 'continue' | 'assassination' | 'gameResult'

export type RoomSettlement =
  | Readonly<{
      kind: 'teamVote'
      key: string
      voteHistoryIndex: number
      questIndex: number
      team: readonly PlayerID[]
      votes: Readonly<Record<PlayerID, TeamVote>>
      approved: boolean
      approvalCount: number
      rejectionCount: number
      continueIntent: SettlementContinueIntent
    }>
  | Readonly<{
      kind: 'quest'
      key: string
      questIndex: number
      team: readonly PlayerID[]
      succeeded: boolean
      successCount: number
      failCount: number
      failThreshold: number
      continueIntent: SettlementContinueIntent
    }>
  | Readonly<{
      kind: 'assassination'
      key: string
      targetPlayerID: PlayerID
      targetRole: Role
      hit: boolean
      winner: VictoryWinner
      continueIntent: 'gameResult'
    }>

export type SettlementBaseline = Readonly<{
  voteHistoryLength: number
  questHistoryLength: number
  assassinationWasTerminal: boolean
}>

export function establishSettlementBaseline(game: AvalonPlayerView): SettlementBaseline {
  return {
    voteHistoryLength: game.voteHistory.length,
    questHistoryLength: game.questHistory.length,
    assassinationWasTerminal: game.result?.reason === 'assassination',
  }
}

function voteContinueIntent(game: AvalonPlayerView, voteHistoryIndex: number): SettlementContinueIntent {
  return game.result?.reason === 'five_rejections' && voteHistoryIndex === game.voteHistory.length - 1
    ? 'gameResult'
    : 'continue'
}

function questContinueIntent(game: AvalonPlayerView, questHistoryIndex: number): SettlementContinueIntent {
  const quest = game.questHistory[questHistoryIndex]!
  const failuresThroughQuest = game.questHistory
    .slice(0, questHistoryIndex + 1)
    .filter(({ succeeded }) => !succeeded)
    .length
  if (
    game.result?.reason === 'three_quests' &&
    game.result.winner === 'evil' &&
    !quest.succeeded &&
    failuresThroughQuest === 3
  ) return 'gameResult'
  return quest.succeeded && game.goodSuccesses >= 3 && questHistoryIndex === game.questHistory.length - 1
    ? 'assassination'
    : 'continue'
}

function teamVoteSettlement(game: AvalonPlayerView, voteHistoryIndex: number): Extract<RoomSettlement, { kind: 'teamVote' }> {
  const result = game.voteHistory[voteHistoryIndex]!
  const votes = { ...result.votes }
  const approvalCount = Object.values(votes).filter((vote) => vote === 'approve').length
  return {
    kind: 'teamVote',
    key: `teamVote:${voteHistoryIndex}`,
    voteHistoryIndex,
    questIndex: result.questIndex,
    team: [...result.team],
    votes,
    approved: result.approved,
    approvalCount,
    rejectionCount: Object.keys(votes).length - approvalCount,
    continueIntent: voteContinueIntent(game, voteHistoryIndex),
  }
}

function questSettlement(game: AvalonPlayerView, questHistoryIndex: number): Extract<RoomSettlement, { kind: 'quest' }> {
  const result = game.questHistory[questHistoryIndex]!
  return {
    kind: 'quest',
    key: `quest:${result.questIndex}`,
    questIndex: result.questIndex,
    team: [...result.team],
    succeeded: result.succeeded,
    successCount: result.successCount,
    failCount: result.failCount,
    failThreshold: getPlayerCountConfig(Object.keys(game.players).length).questFailThresholds[result.questIndex] ?? 1,
    continueIntent: questContinueIntent(game, questHistoryIndex),
  }
}

function assassinationSettlement(game: AvalonPlayerView): Extract<RoomSettlement, { kind: 'assassination' }> | null {
  const result = game.result
  if (result?.reason !== 'assassination' || result.targetID === undefined) return null
  const targetRole = game.revealedRoles?.[result.targetID]
  if (targetRole === undefined) return null
  return {
    kind: 'assassination',
    key: `assassination:${result.winner}:${result.targetID}`,
    targetPlayerID: result.targetID,
    targetRole,
    hit: targetRole === 'merlin',
    winner: result.winner,
    continueIntent: 'gameResult',
  }
}

/** Finds only public settlements appended after a previously observed snapshot. */
export function findNewSettlements(
  game: AvalonPlayerView,
  baseline: SettlementBaseline,
): readonly RoomSettlement[] {
  const newVoteIndexes = Array.from(
    { length: Math.max(0, game.voteHistory.length - baseline.voteHistoryLength) },
    (_, index) => baseline.voteHistoryLength + index,
  )
  const newQuestIndexes = Array.from(
    { length: Math.max(0, game.questHistory.length - baseline.questHistoryLength) },
    (_, index) => baseline.questHistoryLength + index,
  )
  const remainingVotes = new Set(newVoteIndexes)
  const settlements: RoomSettlement[] = []

  for (const questHistoryIndex of newQuestIndexes) {
    const quest = game.questHistory[questHistoryIndex]!
    for (const voteHistoryIndex of newVoteIndexes) {
      if (remainingVotes.has(voteHistoryIndex) && game.voteHistory[voteHistoryIndex]?.questIndex === quest.questIndex) {
        settlements.push(teamVoteSettlement(game, voteHistoryIndex))
        remainingVotes.delete(voteHistoryIndex)
      }
    }
    settlements.push(questSettlement(game, questHistoryIndex))
  }
  for (const voteHistoryIndex of newVoteIndexes) {
    if (remainingVotes.has(voteHistoryIndex)) settlements.push(teamVoteSettlement(game, voteHistoryIndex))
  }
  if (!baseline.assassinationWasTerminal) {
    const assassination = assassinationSettlement(game)
    if (assassination !== null) settlements.push(assassination)
  }
  return settlements
}
