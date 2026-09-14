import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import {
  establishSettlementBaseline,
  findNewSettlements,
} from '../src/room-settlement'

function game(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
  return {
    status: 'playing',
    lobby: { authorityVersion: 1, ownerPlayerID: '0', occupiedPlayerIDs: ['0', '1', '2', '3', '4'] },
    players: { '0': { name: 'Alice' }, '1': { name: 'Bob' }, '2': { name: 'Claire' }, '3': { name: 'Dylan' }, '4': { name: 'Eve' } },
    identityRecognition: null,
    leaderID: '0',
    questIndex: 0,
    proposedTeam: null,
    submittedTeamVotePlayerIDs: [],
    submittedQuestCardCount: 0,
    voteHistory: [],
    questHistory: [],
    consecutiveRejectedTeams: 0,
    goodSuccesses: 0,
    evilFailures: 0,
    rules: { roleConfiguration: { percivalMorgana: true }, timeouts: { enabled: false } },
    viewer: { role: 'loyal_servant', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [] },
    ...overrides,
  }
}

describe('room settlements', () => {
  it('establishes a historical baseline without replaying settled history', () => {
    const snapshot = game({
      voteHistory: [{ questIndex: 0, team: ['0', '1'], votes: { '0': 'approve', '1': 'approve', '2': 'approve', '3': 'reject', '4': 'reject' }, approved: true }],
      questHistory: [{ questIndex: 0, team: ['0', '1'], successCount: 2, failCount: 0, succeeded: true }],
    })

    expect(findNewSettlements(snapshot, establishSettlementBaseline(snapshot))).toEqual([])
  })

  it('keeps votes before their quest and uses stable later-history keys', () => {
    const previous = game()
    const snapshot = game({
      questIndex: 1,
      voteHistory: [
        { questIndex: 0, team: ['0', '1'], votes: { '0': 'reject', '1': 'reject', '2': 'approve', '3': 'reject', '4': 'approve' }, approved: false },
        { questIndex: 0, team: ['0', '2'], votes: { '0': 'approve', '1': 'approve', '2': 'approve', '3': 'reject', '4': 'reject' }, approved: true },
      ],
      questHistory: [{ questIndex: 0, team: ['0', '2'], successCount: 1, failCount: 1, succeeded: false }],
    })

    expect(findNewSettlements(snapshot, establishSettlementBaseline(previous))).toEqual([
      expect.objectContaining({ kind: 'teamVote', key: 'teamVote:0', approved: false, continueIntent: 'continue' }),
      expect.objectContaining({ kind: 'teamVote', key: 'teamVote:1', approved: true, team: ['0', '2'] }),
      expect.objectContaining({ kind: 'quest', key: 'quest:0', failThreshold: 1, continueIntent: 'continue', team: ['0', '2'] }),
    ])
  })

  it('places terminal rejection and assassination after their public cause', () => {
    const fifthRejection = game({
      status: 'finished',
      result: { winner: 'evil', reason: 'five_rejections' },
      voteHistory: [{ questIndex: 0, team: ['0', '1'], votes: { '0': 'reject', '1': 'reject', '2': 'reject', '3': 'approve', '4': 'approve' }, approved: false }],
    })
    const assassination = game({
      status: 'finished',
      result: { winner: 'good', reason: 'assassination', targetID: '1' },
      revealedRoles: { '1': 'loyal_servant' },
    })

    expect(findNewSettlements(fifthRejection, establishSettlementBaseline(game()))).toEqual([
      expect.objectContaining({ kind: 'teamVote', continueIntent: 'gameResult' }),
    ])
    expect(findNewSettlements(assassination, establishSettlementBaseline(game()))).toEqual([
      expect.objectContaining({ kind: 'assassination', key: 'assassination:good:1', targetRole: 'loyal_servant', hit: false, continueIntent: 'gameResult' }),
    ])
  })

  it('marks only the third accumulated Evil quest failure as terminal during catch-up', () => {
    const terminalSnapshot = game({
      status: 'finished',
      evilFailures: 3,
      result: { winner: 'evil', reason: 'three_quests' },
      questHistory: [
        { questIndex: 0, team: ['0', '1'], successCount: 1, failCount: 1, succeeded: false },
        { questIndex: 1, team: ['0', '2', '3'], successCount: 2, failCount: 1, succeeded: false },
        { questIndex: 2, team: ['1', '2'], successCount: 1, failCount: 1, succeeded: false },
      ],
    })

    expect(findNewSettlements(terminalSnapshot, establishSettlementBaseline(game()))
      .filter((settlement) => settlement.kind === 'quest')
      .map((settlement) => settlement.continueIntent)).toEqual([
      'continue', 'continue', 'gameResult',
    ])
  })
})
