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
    manualReconnectAvailable: false,
    startPending: false,
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

  it('derives lobby ownership, fullness, and pending start without hidden data', () => {
    const input = readyInput('lobby', { status: 'lobby' })
    const model = buildRoomScreenModel({
      ...input,
      canStart: false,
      startPending: true,
      manualReconnectAvailable: false,
    })

    expect(model.phase).toEqual({
      kind: 'lobby', title: '等待玩家', occupied: 5, total: 5,
      isOwner: true, canStart: false, startPending: true,
    })
    expect(model.utilities).toMatchObject({ variant: 'lobby', showRoomExit: true })
  })

  it('uses a local recovery presentation and marks only the viewer locally disconnected', () => {
    const input = readyInput('lobby', { status: 'lobby' })
    const model = buildRoomScreenModel({
      ...input,
      connected: false,
      manualReconnectAvailable: true,
      startPending: false,
    })

    expect(model.mode).toBe('lobby')
    expect(model.phase).toEqual({
      kind: 'connectionRecovery',
      title: '正在重新连接',
      manualReconnectAvailable: true,
    })
    expect(model.players.find((player) => player.isCurrentPlayer)?.connected).toBe(false)
  })

  it('keeps the assassin\'s known evil teammates ineligible while role details are closed', () => {
    const input = readyInput('assassination', {
      viewer: {
        role: 'assassin',
        loyalty: 'evil',
        knownEvilPlayerIDs: ['3'],
        knownMerlinCandidatePlayerIDs: [],
      },
    })
    const model = buildRoomScreenModel({ ...input, activeStage: 'assassin' })

    expect(model.playerInteractionMode).toBe('selectAssassinationTarget')
    expect(model.players.find(({ playerID }) => playerID === '3')?.knownEvil).toBe(true)
  })

  it.each([
    [
      'an Evil three-failed-quest victory',
      { winner: 'evil', reason: 'three_quests' } as const,
      '邪恶阵营破坏了三次任务',
    ],
    [
      'a Good three-successful-quest legacy result',
      { winner: 'good', reason: 'three_quests' } as const,
      '正义阵营完成三次任务',
    ],
    [
      'an assassination hit with the public target',
      { winner: 'evil', reason: 'assassination', targetID: '1' } as const,
      '刺客命中梅林：Bob',
    ],
    [
      'an assassination miss with the public target',
      { winner: 'good', reason: 'assassination', targetID: '2' } as const,
      '刺杀未命中梅林：Claire',
    ],
  ])('summarizes %s without collapsing the settled outcome', (_label, result, summary) => {
    const model = buildRoomScreenModel(readyInput('finished', {
      status: 'finished',
      result,
    }))

    expect(model.center).toEqual({
      kind: 'resultSummary',
      winner: result.winner,
      reason: summary,
    })
    expect(model.phase).toMatchObject({ kind: 'finished', summary })
  })
})
