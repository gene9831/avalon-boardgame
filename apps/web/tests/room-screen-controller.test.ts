import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import type { AvalonMatch } from '../src/lobby'
import { buildRoomScreenModel } from '../src/room-screen-controller'

const room: AvalonMatch = {
  matchID: 'room-123456789',
  gameName: 'avalon',
  players: Array.from({ length: 5 }, (_, id) => ({
    id,
    name: ['Alice', 'Bob', 'Claire', 'Dylan', 'Eve'][id],
    isConnected: true,
  })),
  setupData: { numPlayers: 5 },
  ownerPlayerID: '0',
  occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
  roleConfiguration: { percivalMorgana: true },
}

function game(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
  return {
    status: 'playing',
    lobby: { authorityVersion: 1, ownerPlayerID: '0', occupiedPlayerIDs: room.occupiedPlayerIDs },
    players: Object.fromEntries(room.players.map((player) => [String(player.id), { name: player.name! }])),
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
    rules: { roleConfiguration: { percivalMorgana: true }, timeouts: { enabled: false } },
    viewer: {
      role: 'loyal_servant',
      loyalty: 'good',
      knownEvilPlayerIDs: [],
      knownMerlinCandidatePlayerIDs: [],
    },
    ...overrides,
  }
}

function readyInput(phase: string, overrides: Partial<AvalonPlayerView> = {}) {
  return {
    kind: 'ready' as const,
    matchID: room.matchID,
    room,
    game: game(overrides),
    phase,
    activeStage: phase === 'teamVote' ? 'vote' : phase,
    currentPlayerID: '0',
    selectedTeam: [] as string[],
    selectedTarget: null,
    roleKnowledgeOpen: false,
    canStart: true,
    roomExitBusy: false,
    connected: true,
  }
}

describe('buildRoomScreenModel', () => {
  it.each([
    ['lobby', readyInput('lobby', { status: 'lobby' }), 'lobby'],
    ['identityRecognition', readyInput('identityRecognition', {
      identityRecognition: { step: 'roleReveal', deadlineAt: 1000, confirmedCount: 0, participantCount: 5 },
      viewer: {
        role: 'loyal_servant', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    }), 'identityRecognition'],
    ['teamProposal', readyInput('teamProposal'), 'teamProposal'],
    ['teamVote', readyInput('teamVote', { proposedTeam: ['0', '1'] }), 'teamVote'],
    ['quest', readyInput('quest', { proposedTeam: ['0', '1'] }), 'quest'],
    ['assassination', readyInput('assassination', { viewer: {
      role: 'assassin', loyalty: 'evil', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [],
    } }), 'assassination'],
    ['finished', readyInput('finished', {
      status: 'finished',
      result: { winner: 'good', reason: 'three_quests' },
      revealedRoles: { '0': 'merlin', '1': 'loyal_servant', '2': 'loyal_servant', '3': 'assassin', '4': 'minion' },
    }), 'finished'],
  ] as const)('builds one %s model', (_label, input, expectedMode) => {
    expect(buildRoomScreenModel(input).mode).toBe(expectedMode)
  })

  it('keeps role data out of a nonparticipant recognition overlay', () => {
    const model = buildRoomScreenModel(readyInput('identityRecognition', {
      identityRecognition: { step: 'roleReveal', deadlineAt: 1000, confirmedCount: 1, participantCount: 4 },
      viewer: {
        role: null, loyalty: null, knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: false, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    }))

    expect(model.stageOverlay).toMatchObject({ kind: 'identityRecognition', curtainState: 'closed', role: null })
    expect(model.players.every((player) => player.visibleRole === null)).toBe(true)
  })

  it('builds a loading shell without invented player or quest requirements', () => {
    const model = buildRoomScreenModel({ kind: 'loading', matchID: 'room-123', numPlayers: null })

    expect(model.mode).toBe('loading')
    expect(model.players).toEqual([])
    expect(model.questProgress.every((node) => node.teamSize === null)).toBe(true)
  })
})
