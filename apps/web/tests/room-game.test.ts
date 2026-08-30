import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView, TeamVoteResult } from '@avalon/game'

import {
  canSubmitTeam,
  getDisplayedTeamVoteResult,
  getQuestTeamSize,
  toggleTeamMember,
} from '../src/room-game'

function gameView(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
  return {
    status: 'playing',
    players: Object.fromEntries(
      Array.from({ length: 5 }, (_, index) => [String(index), { name: `Player ${index + 1}` }]),
    ),
    identityRecognition: null,
    leaderID: '0',
    questIndex: 0,
    proposedTeam: null,
    submittedTeamVotePlayerIDs: [],
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
    },
    ...overrides,
  }
}

const approvedVote: TeamVoteResult = {
  proposerID: '0',
  questIndex: 0,
  team: ['0', '1'],
  votes: {
    '0': 'approve',
    '1': 'approve',
    '2': 'approve',
    '3': 'reject',
    '4': 'reject',
  },
  approved: true,
}

const rejectedVote: TeamVoteResult = {
  ...approvedVote,
  votes: {
    '0': 'approve',
    '1': 'approve',
    '2': 'reject',
    '3': 'reject',
    '4': 'reject',
  },
  approved: false,
}

describe('room game interaction helpers', () => {
  it('uses the configured team size for the current quest', () => {
    expect(getQuestTeamSize(5, 0)).toBe(2)
    expect(getQuestTeamSize(7, 3)).toBe(4)
  })

  it('toggles a player without exceeding the required team size', () => {
    expect(toggleTeamMember([], '0', 2)).toEqual(['0'])
    expect(toggleTeamMember(['0'], '0', 2)).toEqual([])
    expect(toggleTeamMember(['0', '1'], '2', 2)).toEqual(['0', '1'])
  })

  it('allows submission only for the active leader with a complete team', () => {
    expect(
      canSubmitTeam({
        activeStage: 'leader',
        leaderID: '1',
        playerID: '1',
        requiredTeamSize: 2,
        selectedTeam: ['1', '2'],
      }),
    ).toBe(true)
    expect(
      canSubmitTeam({
        activeStage: 'leader',
        leaderID: '1',
        playerID: '0',
        requiredTeamSize: 2,
        selectedTeam: ['1', '2'],
      }),
    ).toBe(false)
    expect(
      canSubmitTeam({
        activeStage: 'leader',
        leaderID: '1',
        playerID: '1',
        requiredTeamSize: 2,
        selectedTeam: ['1'],
      }),
    ).toBe(false)
  })

  it('keeps an approved vote visible only until its quest settles', () => {
    const pendingQuest = gameView({
      proposedTeam: ['0', '1'],
      voteHistory: [approvedVote],
    })
    const settledQuest = gameView({
      questIndex: 1,
      voteHistory: [approvedVote],
      questHistory: [{
        questIndex: 0,
        team: ['0', '1'],
        successCount: 2,
        failCount: 0,
        succeeded: true,
      }],
    })

    expect(getDisplayedTeamVoteResult(pendingQuest, 'quest')).toBe(approvedVote)
    expect(
      getDisplayedTeamVoteResult(settledQuest, 'teamProposal'),
    ).toBeUndefined()
  })

  it('keeps a rejected vote through proposal but clears it for the next vote', () => {
    const game = gameView({ voteHistory: [rejectedVote] })

    expect(getDisplayedTeamVoteResult(game, 'teamProposal')).toBe(rejectedVote)
    expect(getDisplayedTeamVoteResult(game, 'teamVote')).toBeUndefined()
  })

  it('keeps the fifth rejection visible on the final result', () => {
    const game = gameView({
      status: 'finished',
      result: { winner: 'evil', reason: 'five_rejections' },
      voteHistory: [rejectedVote],
    })

    expect(getDisplayedTeamVoteResult(game, 'teamVote')).toBe(rejectedVote)
  })
})
