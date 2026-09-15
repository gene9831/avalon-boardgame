import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import {
  buildQuestProgress,
  buildRoomPlayers,
  buildRoomTeamTokens,
} from '../src/room-presentation'
import type { AvalonMatch } from '../src/lobby'

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
  viewerConnected: true,
  ownerPlayerID: '3',
  game: null,
  phase: 'teamVote',
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

describe('room player presentation', () => {
  it('builds team tokens in stable lobby-seat order with cosmetic avatars', () => {
    const room: AvalonMatch = {
      matchID: 'room-team-tokens', gameName: 'avalon', ownerPlayerID: '0',
      occupiedPlayerIDs: ['0', '1', '2'], roleConfiguration: { percivalMorgana: false },
      players: [
        { id: 0, name: 'Alice', data: { avatarID: 'assassin' } },
        { id: 1, name: 'Bob', data: { avatarID: 'merlin' } },
        { id: 2, name: 'Caro', data: { avatarID: 'percival' } },
      ],
    }

    expect(buildRoomTeamTokens(room, ['2', '0', '1'])).toEqual([
      { playerID: '0', seatNumber: 1, name: 'Alice', avatarID: 'assassin' },
      { playerID: '1', seatNumber: 2, name: 'Bob', avatarID: 'merlin' },
      { playerID: '2', seatNumber: 3, name: 'Caro', avatarID: 'percival' },
    ])
  })

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
      portrait: { kind: 'playerAvatar', connected: false, avatarID: 'merlin' },
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
      portrait: { kind: 'roleArtwork', role: 'merlin' },
      caption: { kind: 'role', role: 'merlin' },
      canReviewIdentity: true,
      markers: [
        { kind: 'questMember' },
        { kind: 'vote', status: 'pending' },
      ],
    })
    expect(result.find(({ playerID }) => playerID === '1')).toMatchObject({
      emphasis: 'target',
      markers: [{ kind: 'leader' }, { kind: 'questMember' }, { kind: 'assassinationTarget' }],
    })
    expect(result.find(({ playerID }) => playerID === '3')).toMatchObject({
      markers: [{ kind: 'owner' }],
      caption: { kind: 'recognition', label: '邪恶', tone: 'evil' },
    })
    expect(result.find(({ playerID }) => playerID === '4')).toMatchObject({
      emphasis: 'selected',
    })
  })

  it.each([
    [
      { role: 'minion', loyalty: 'evil', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [] },
      '3', '同伴', 'ally', ['owner'],
    ],
    [
      { role: 'percival', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: ['1', '3'] },
      '1', '梅林候选', 'candidate', ['leader', 'questMember'],
    ],
  ] as const)('presents restored %s knowledge as a colored text label', (viewer, targetPlayerID, label, tone, markerKinds) => {
    const result = buildRoomPlayers({
      ...baseInput,
      game: gameView({ viewer }),
      showKnownPlayerInfo: true,
    })
    const target = result.find(({ playerID }) => playerID === targetPlayerID)

    expect(target?.caption).toEqual({ kind: 'recognition', label, tone })
    expect(target?.markers.map(({ kind }) => kind)).toEqual(markerKinds)
  })

  it('keeps terminal public role labels non-reviewable', () => {
    const result = buildRoomPlayers({
      ...baseInput,
      game: gameView({
        status: 'finished',
        revealedRoles: {
          '0': 'merlin', '1': 'loyal_servant', '3': 'assassin', '4': 'minion',
        },
      }),
      showPrivateRoleKnowledge: true,
      showRoleReveal: true,
    })

    expect(result.find(({ playerID }) => playerID === '0')).toMatchObject({
      portrait: { kind: 'roleArtwork', role: 'merlin' },
      caption: { kind: 'role', role: 'merlin' },
      canReviewIdentity: false,
    })
  })

  it('shows only current vote submissions during a second active team vote', () => {
    const result = buildRoomPlayers({
      ...baseInput,
      game: gameView({
        questIndex: 0,
        submittedTeamVotePlayerIDs: ['2'],
        voteHistory: [{
          questIndex: 0,
          team: ['0', '1'],
          votes: {
            '0': 'approve',
            '1': 'approve',
            '2': 'reject',
            '3': 'reject',
            '4': 'reject',
          },
          approved: false,
        }],
      }),
      phase: 'teamVote',
    })

    expect(result.map(({ playerID, markers }) => [
      playerID,
      markers.find((marker) => marker.kind === 'vote')?.status ?? null,
    ])).toEqual([
      ['0', null],
      ['1', null],
      ['2', 'pending'],
      ['3', null],
      ['4', null],
    ])
  })
})
describe('room quest progress presentation', () => {
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
