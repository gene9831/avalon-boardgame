import type {
  AvalonPlayerView,
  PlayerID,
  QuestResult,
  TeamVoteResult,
} from '@avalon/game'

export type RoomLogKind =
  | 'assassination'
  | 'game-start'
  | 'presence'
  | 'proposal'
  | 'quest'
  | 'result'
  | 'vote'

export interface RoomLogEntry {
  detail?: string
  group: string
  id: string
  kind: RoomLogKind
  title: string
  tone?: 'danger' | 'good' | 'neutral'
}

interface PublicLogPlayer {
  id: string | number
  name?: string | null
}

function occupiedPlayers(players: readonly PublicLogPlayer[]) {
  return players.filter(
    (player) => typeof player.name === 'string' && player.name.length > 0,
  )
}

export function createPresenceBaselineEntry(
  players: readonly PublicLogPlayer[],
): RoomLogEntry {
  return {
    id: 'presence-0',
    kind: 'presence',
    group: '等待玩家',
    title: `当前房间共有 ${occupiedPlayers(players).length} 名玩家`,
  }
}

export function buildPresenceLogChanges(
  previousPlayers: readonly PublicLogPlayer[],
  currentPlayers: readonly PublicLogPlayer[],
  startIndex: number,
) {
  const previous = new Map(
    occupiedPlayers(previousPlayers).map((player) => [String(player.id), player]),
  )
  const current = new Map(
    occupiedPlayers(currentPlayers).map((player) => [String(player.id), player]),
  )
  const changes: Omit<RoomLogEntry, 'id'>[] = []

  for (const [playerID] of [...previous].sort(([left], [right]) => Number(left) - Number(right))) {
    if (current.has(playerID)) continue
    changes.push({
      kind: 'presence',
      group: '等待玩家',
      title: `${playerLabel(previousPlayers, playerID)}退出了房间`,
    })
  }
  for (const [playerID] of [...current].sort(([left], [right]) => Number(left) - Number(right))) {
    if (previous.has(playerID)) continue
    changes.push({
      kind: 'presence',
      group: '等待玩家',
      title: `${playerLabel(currentPlayers, playerID)}加入了房间`,
    })
  }

  return changes.map((entry, index): RoomLogEntry => ({
    ...entry,
    id: `presence-${startIndex + index}`,
  }))
}

function playerLabel(players: readonly PublicLogPlayer[], playerID: PlayerID) {
  const seatNumber = Number(playerID) + 1
  const name = players.find(({ id }) => String(id) === playerID)?.name
  return `${name ?? `玩家 ${seatNumber}`}（${seatNumber}号位）`
}

function questGroup(questIndex: number, attempt?: number) {
  return attempt === undefined
    ? `第 ${questIndex + 1} 次任务`
    : `第 ${questIndex + 1} 次任务 · 第 ${attempt} 次提案`
}

function proposalEntry(
  vote: Pick<TeamVoteResult, 'proposerID' | 'questIndex' | 'team'>,
  players: readonly PublicLogPlayer[],
  attempt: number,
  id: string,
): RoomLogEntry {
  const proposer = vote.proposerID === undefined
    ? '队长'
    : playerLabel(players, vote.proposerID)
  return {
    id,
    kind: 'proposal',
    group: questGroup(vote.questIndex, attempt),
    title: `${proposer}提出了任务队伍`,
    detail: vote.team.map((playerID) => playerLabel(players, playerID)).join('、'),
  }
}

function voteEntry(
  vote: TeamVoteResult,
  players: readonly PublicLogPlayer[],
  attempt: number,
  id: string,
): RoomLogEntry {
  const detail = Object.entries(vote.votes)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([playerID, choice]) =>
      `${playerLabel(players, playerID)}：${choice === 'approve' ? '赞成' : '反对'}`,
    )
    .join(' · ')
  return {
    id,
    kind: 'vote',
    group: questGroup(vote.questIndex, attempt),
    title: vote.approved ? '队伍表决通过' : '队伍表决未通过',
    detail,
    tone: vote.approved ? 'good' : 'danger',
  }
}

function questEntry(result: QuestResult): RoomLogEntry {
  return {
    id: `quest-${result.questIndex}`,
    kind: 'quest',
    group: questGroup(result.questIndex),
    title: `第 ${result.questIndex + 1} 次任务${result.succeeded ? '成功' : '失败'}`,
    detail: `${result.successCount} 张成功 · ${result.failCount} 张失败`,
    tone: result.succeeded ? 'good' : 'danger',
  }
}

export function buildGameLogEntries(
  game: Pick<
    AvalonPlayerView,
    | 'leaderID'
    | 'proposedTeam'
    | 'questHistory'
    | 'questIndex'
    | 'result'
    | 'revealedRoles'
    | 'status'
    | 'voteHistory'
  >,
  players: readonly PublicLogPlayer[],
  phase: string,
): RoomLogEntry[] {
  if (game.status === 'lobby') return []

  const entries: RoomLogEntry[] = [{
    id: 'game-start',
    kind: 'game-start',
    group: '对局开始',
    title: `${playerLabel(players, '0')}开始了游戏`,
  }]
  const attemptsByQuest = new Map<number, number>()
  const questResults = new Map(
    game.questHistory.map((result) => [result.questIndex, result]),
  )

  game.voteHistory.forEach((vote, index) => {
    const attempt = (attemptsByQuest.get(vote.questIndex) ?? 0) + 1
    attemptsByQuest.set(vote.questIndex, attempt)
    entries.push(
      proposalEntry(vote, players, attempt, `proposal-${index}`),
      voteEntry(vote, players, attempt, `vote-${index}`),
    )

    const questResult = vote.approved
      ? questResults.get(vote.questIndex)
      : undefined
    if (questResult !== undefined) entries.push(questEntry(questResult))
  })

  if (
    phase === 'teamVote' &&
    game.proposedTeam !== null &&
    game.leaderID !== null
  ) {
    const attempt = (attemptsByQuest.get(game.questIndex) ?? 0) + 1
    entries.push(proposalEntry({
      proposerID: game.leaderID,
      questIndex: game.questIndex,
      team: game.proposedTeam,
    }, players, attempt, 'proposal-current'))
  }

  if (game.result?.reason === 'assassination' && game.result.targetID !== undefined) {
    const assassinID = Object.entries(game.revealedRoles ?? {}).find(
      ([, role]) => role === 'assassin',
    )?.[0]
    const assassin = assassinID === undefined
      ? '刺客'
      : playerLabel(players, assassinID)
    entries.push({
      id: 'assassination',
      kind: 'assassination',
      group: '刺杀阶段',
      title: `${assassin}选择刺杀${playerLabel(players, game.result.targetID)}`,
      tone: 'danger',
    })
  }

  if (game.result !== undefined) {
    const reason = game.result.reason === 'five_rejections'
      ? '连续五次队伍提案被否决'
      : game.result.reason === 'three_quests'
        ? '邪恶阵营破坏了三次任务'
        : game.result.winner === 'evil'
          ? '刺客命中了梅林'
          : '刺杀未命中梅林'
    entries.push({
      id: 'result',
      kind: 'result',
      group: '对局结束',
      title: `${game.result.winner === 'good' ? '正义' : '邪恶'}阵营获胜`,
      detail: reason,
      tone: game.result.winner === 'good' ? 'good' : 'danger',
    })
  }

  return entries
}
