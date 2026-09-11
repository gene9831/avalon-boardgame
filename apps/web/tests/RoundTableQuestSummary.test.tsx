import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import { QuestProgressTrack } from '../src/QuestProgressTrack'
import { buildQuestProgress } from '../src/room-screen-model'
import { RoundTableQuestSummary } from '../src/RoundTableQuestSummary'

const game: AvalonPlayerView = {
  status: 'playing',
  players: {
    '0': { name: 'Alice' },
    '1': { name: 'Bob' },
    '2': { name: 'Claire' },
    '3': { name: 'Dylan' },
    '4': { name: 'Eve' },
    '5': { name: 'Flynn' },
    '6': { name: 'Grace' },
  },
  identityRecognition: null,
  leaderID: '0',
  questIndex: 1,
  proposedTeam: null,
  submittedTeamVotePlayerIDs: [],
  voteHistory: [],
  questHistory: [{
    questIndex: 0,
    team: ['0', '3'],
    successCount: 1,
    failCount: 1,
    succeeded: false,
  }],
  consecutiveRejectedTeams: 2,
  goodSuccesses: 0,
  evilFailures: 1,
  rules: { timeouts: { enabled: false } },
  viewer: {
    role: 'loyal_servant',
    loyalty: 'good',
    knownEvilPlayerIDs: [],
    knownMerlinCandidatePlayerIDs: [],
  },
}

describe('RoundTableQuestSummary', () => {
  it('keeps one quest-progress track available for shell repositioning', () => {
    const html = renderToStaticMarkup(
      <QuestProgressTrack nodes={buildQuestProgress(7, game)} />,
    )

    expect(html).toContain('aria-label="五次任务进度"')
    expect(html.match(/data-quest-index=/g)).toHaveLength(5)
    expect(html).toContain('第 4 次任务，4 人，需 2 张失败牌才会失败')
  })

  it('shows public result and rejection progress without duplicating the quest track', () => {
    const html = renderToStaticMarkup(
      <RoundTableQuestSummary game={game} />,
    )

    expect(html).toContain('第 1 次任务失败 · 1 张成功 · 1 张失败')
    expect(html).toContain('aria-label="连续否决轨道，当前 2 次"')
    expect(html).not.toContain('Alice：成功')
    expect(html).not.toContain('Dylan：失败')
    expect(html).not.toContain('aria-label="五次任务进度"')
    expect(html).not.toContain('确认队伍')
  })
})
