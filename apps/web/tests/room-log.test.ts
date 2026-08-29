import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import {
  buildGameLogEntries,
  buildPresenceLogChanges,
  createPresenceBaselineEntry,
} from '../src/room-log'

const players = [
  { id: 0, name: 'Arthur' },
  { id: 1, name: 'Arthur' },
  { id: 2, name: 'Claire' },
  { id: 3, name: 'Dylan' },
  { id: 4, name: 'Eve' },
]

function gameView(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
  return {
    status: 'playing',
    players: Object.fromEntries(players.map(({ id, name }) => [String(id), { name }])),
    identityRecognition: null,
    leaderID: '0',
    questIndex: 0,
    proposedTeam: null,
    voteHistory: [],
    questHistory: [],
    consecutiveRejectedTeams: 0,
    goodSuccesses: 0,
    evilFailures: 0,
    rules: { timeouts: { enabled: false } },
    viewer: {
      role: 'merlin',
      loyalty: 'good',
      knownEvilPlayerIDs: ['3', '4'],
      submittedVote: 'reject',
      submittedQuestCard: 'success',
    },
    ...overrides,
  }
}

describe('public room game log', () => {
  it('reconstructs proposals, settled votes, anonymous quest results, assassination, and victory in order', () => {
    const game = gameView({
      status: 'finished',
      questIndex: 1,
      voteHistory: [
        {
          proposerID: '0',
          questIndex: 0,
          team: ['0', '1'],
          votes: {
            '0': 'approve',
            '1': 'reject',
            '2': 'reject',
            '3': 'reject',
            '4': 'approve',
          },
          approved: false,
        },
        {
          proposerID: '1',
          questIndex: 0,
          team: ['1', '2'],
          votes: {
            '0': 'approve',
            '1': 'approve',
            '2': 'approve',
            '3': 'reject',
            '4': 'reject',
          },
          approved: true,
        },
      ],
      questHistory: [{
        questIndex: 0,
        team: ['1', '2'],
        successCount: 2,
        failCount: 0,
        succeeded: true,
      }],
      result: {
        winner: 'good',
        reason: 'assassination',
        targetID: '1',
      },
      revealedRoles: {
        '0': 'merlin',
        '1': 'loyal_servant',
        '2': 'loyal_servant',
        '3': 'assassin',
        '4': 'minion',
      },
    })

    const entries = buildGameLogEntries(game, players, 'assassination')

    expect(entries.map(({ kind }) => kind)).toEqual([
      'game-start',
      'proposal',
      'vote',
      'proposal',
      'vote',
      'quest',
      'assassination',
      'result',
    ])
    expect(entries[1].title).toContain('Arthur（1号位）')
    expect(entries[3].title).toContain('Arthur（2号位）')
    expect(entries[4].detail).toContain('Arthur（1号位）：赞成')
    expect(entries[4].detail).toContain('Arthur（2号位）：赞成')
    expect(entries[5]).toMatchObject({
      detail: '2 张成功 · 0 张失败',
      title: '第 1 次任务成功',
    })
    expect(entries[5].detail).not.toContain('Arthur')
    expect(entries[6].title).toContain('Dylan（4号位）')
    expect(entries[6].title).toContain('Arthur（2号位）')
    expect(entries[7].title).toBe('正义阵营获胜')
    expect(JSON.stringify(entries)).not.toContain('knownEvilPlayerIDs')
    expect(JSON.stringify(entries)).not.toContain('submittedQuestCard')
  })

  it('includes the current public proposal before voting settles', () => {
    const entries = buildGameLogEntries(gameView({
      leaderID: '2',
      proposedTeam: ['0', '2'],
    }), players, 'teamVote')

    expect(entries.map(({ kind }) => kind)).toEqual(['game-start', 'proposal'])
    expect(entries[1].title).toContain('Claire（3号位）')
    expect(entries[1].detail).toBe('Arthur（1号位）、Claire（3号位）')
  })
})

describe('local waiting-room presence log', () => {
  it('starts from the current occupancy without inventing earlier events', () => {
    expect(createPresenceBaselineEntry(players.slice(0, 2))).toMatchObject({
      kind: 'presence',
      title: '当前房间共有 2 名玩家',
    })
  })

  it('records only joins and exits observed by this client with seat identity', () => {
    const previous = players.slice(0, 2)
    const current = [players[0], players[2]]

    expect(buildPresenceLogChanges(previous, current, 4)).toEqual([
      {
        group: '等待玩家',
        id: 'presence-4',
        kind: 'presence',
        title: 'Arthur（2号位）退出了房间',
      },
      {
        group: '等待玩家',
        id: 'presence-5',
        kind: 'presence',
        title: 'Claire（3号位）加入了房间',
      },
    ])
  })
})
