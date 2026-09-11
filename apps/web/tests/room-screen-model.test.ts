import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import {
  buildQuestProgress,
  buildRoomPlayers,
} from '../src/room-screen-model'

const players = [
  { id: 0, name: 'Alice', isConnected: true },
  { id: 1, name: 'Bob', isConnected: true },
  { id: 2 },
  { id: 3, name: 'Dylan', isConnected: false },
  { id: 4, name: 'Eve', isConnected: true },
]

const baseInput = {
  players,
  numPlayers: 5,
  currentPlayerID: '0',
  ownerPlayerID: '3',
  game: null,
  selectedTeam: [],
  selectedTarget: null,
  showKnownPlayerInfo: false,
  showPrivateRoleKnowledge: false,
} as const

function gameView(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
  return {
    status: 'playing',
    lobby: {
      authorityVersion: 1,
      ownerPlayerID: '3',
      occupiedPlayerIDs: ['0', '1', '3', '4'],
    },
    players: Object.fromEntries(
      players
        .filter((player) => player.name !== undefined)
        .map((player) => [String(player.id), { name: player.name! }]),
    ),
    identityRecognition: null,
    leaderID: '1',
    questIndex: 1,
    proposedTeam: ['0', '1'],
    submittedTeamVotePlayerIDs: ['0'],
    voteHistory: [],
    questHistory: [],
    consecutiveRejectedTeams: 0,
    goodSuccesses: 0,
    evilFailures: 0,
    rules: {
      roleConfiguration: { percivalMorgana: true },
      timeouts: { enabled: false },
    },
    viewer: {
      role: 'merlin',
      loyalty: 'good',
      knownEvilPlayerIDs: ['3'],
      knownMerlinCandidatePlayerIDs: [],
    },
    ...overrides,
  }
}

describe('room screen player model', () => {
  it('orders seats from the viewer without carrying renderer geometry', () => {
    const result = buildRoomPlayers(baseInput)

    expect(result.map(({ playerID, relativeSeatIndex }) => [playerID, relativeSeatIndex]))
      .toEqual([['0', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4]])
    expect(buildRoomPlayers({ ...baseInput, currentPlayerID: '3' })[0])
      .toMatchObject({ playerID: '3', relativeSeatIndex: 0, isCurrentPlayer: true })
    expect(Object.keys(result[0])).not.toContain('left')
    expect(Object.keys(result[0])).not.toContain('top')
    expect(Object.keys(result[0])).not.toContain('labelPlacement')
  })

  it('keeps empty seat identity data without inventing a player name', () => {
    const emptySeat = buildRoomPlayers(baseInput).find(({ playerID }) => playerID === '2')

    expect(emptySeat).toMatchObject({
      playerID: '2',
      seatNumber: 3,
      name: '',
      occupied: false,
      connected: false,
      avatarID: 'merlin',
    })
  })

  it('derives public and viewer-authorized markers without geometry', () => {
    const result = buildRoomPlayers({
      ...baseInput,
      game: gameView(),
      selectedTeam: ['4'],
      selectedTarget: '1',
      showKnownPlayerInfo: true,
      showPrivateRoleKnowledge: true,
    })

    expect(result.find(({ playerID }) => playerID === '0')).toMatchObject({
      isCurrentPlayer: true,
      isQuestMember: true,
      visibleRole: 'merlin',
      voteStatus: 'pending',
    })
    expect(result.find(({ playerID }) => playerID === '1')).toMatchObject({
      isLeader: true,
      isQuestMember: true,
      isSelectedTarget: true,
    })
    expect(result.find(({ playerID }) => playerID === '3')).toMatchObject({
      isOwner: true,
      knownEvil: true,
    })
    expect(result.find(({ playerID }) => playerID === '4')).toMatchObject({
      isSelected: true,
    })
  })
})

describe('room screen quest progress model', () => {
  it('provides known lobby requirements and unknown loading placeholders', () => {
    expect(buildQuestProgress(5, null).map((node) => node.state)).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
    expect(
      buildQuestProgress(null, null).every(
        (node) => node.teamSize === null && node.failThreshold === null,
      ),
    ).toBe(true)
  })

  it('combines configured requirements with settled and current game state', () => {
    const nodes = buildQuestProgress(5, gameView({
      questIndex: 1,
      questHistory: [{
        questIndex: 0,
        team: ['0', '1'],
        successCount: 2,
        failCount: 0,
        succeeded: true,
      }],
    }))

    expect(nodes[0]).toMatchObject({ teamSize: 2, failThreshold: 1, state: 'success' })
    expect(nodes[1]).toMatchObject({ teamSize: 3, failThreshold: 1, state: 'current' })
  })
})
