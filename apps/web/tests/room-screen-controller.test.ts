// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import type { AvalonMatch } from '../src/lobby'
import {
  buildRoomSceneBinding,
  type RoomSceneEventHandlers,
  type UseRoomScreenControllerInput,
  useRoomScreenController,
} from '../src/room-screen-controller'
import type { RoomSettlement } from '../src/room-settlement'

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
    submittedQuestCardCount: 0,
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
    connected: true,
    manualReconnectAvailable: false,
    startPending: false,
    teamSubmissionPending: false,
    selectedTeamVote: null,
    teamVoteSubmissionPending: false,
    selectedQuestCard: null,
    questCardSubmissionPending: false,
    identityConfirmationView: 'concealed' as const,
    identityRecognitionView: 'concealed' as const,
  }
}

const eventHandlers: RoomSceneEventHandlers = {
  onActivatePlayer: () => undefined,
  onAssassinate: () => undefined,
  onCloseIdentityReview: () => undefined,
  onConfirmIdentityRecognition: () => undefined,
  onConfirmQuestCard: () => undefined,
  onConfirmTeamVote: () => undefined,
  onHideIdentity: () => undefined,
  onHideIdentityComplete: () => undefined,
  onReconnect: () => undefined,
  onRevealIdentity: () => undefined,
  onRevealIdentityComplete: () => undefined,
  onRevealIdentityClue: () => undefined,
  onRevealIdentityClueComplete: () => undefined,
  onReviewIdentity: () => undefined,
  onSelectQuestCard: () => undefined,
  onSelectTeamVote: () => undefined,
  onStart: () => undefined,
  onSubmitTeam: () => undefined,
}

describe('buildRoomSceneBinding', () => {
  it('returns a loading scene with no actions and no invented room facts', () => {
    const binding = buildRoomSceneBinding(
      { kind: 'loading', matchID: 'room-123', numPlayers: null },
      eventHandlers,
    )

    expect(binding).toEqual({
      actions: null,
      scene: {
        kind: 'loading',
        matchID: 'room-123',
        message: '正在进入房间，请稍候。',
        playerCount: null,
        players: [],
        questProgress: [
          { failThreshold: null, questIndex: 0, state: 'upcoming', teamSize: null },
          { failThreshold: null, questIndex: 1, state: 'upcoming', teamSize: null },
          { failThreshold: null, questIndex: 2, state: 'upcoming', teamSize: null },
          { failThreshold: null, questIndex: 3, state: 'upcoming', teamSize: null },
          { failThreshold: null, questIndex: 4, state: 'upcoming', teamSize: null },
        ],
      },
    })
  })

  it('returns connection recovery instead of phase actions while disconnected', () => {
    const binding = buildRoomSceneBinding({
      ...readyInput('teamProposal'),
      connected: false,
      manualReconnectAvailable: true,
    }, eventHandlers)

    expect(binding.scene).toMatchObject({
      kind: 'connectionRecovery',
      manualReconnectAvailable: true,
    })
    expect(binding.actions).toEqual({ onReconnect: eventHandlers.onReconnect })
  })

  it('keeps recovery reachable with only an active terminal settlement role reveal', () => {
    const settlement: Extract<RoomSettlement, { kind: 'assassination' }> = {
      kind: 'assassination', key: 'assassination:good:1', targetPlayerID: '1', targetRole: 'loyal_servant',
      hit: false, winner: 'good', continueIntent: 'gameResult',
    }
    const binding = buildRoomSceneBinding({
      ...readyInput('finished', {
        status: 'finished',
        result: { winner: 'good', reason: 'assassination', targetID: '1' },
        revealedRoles: { '0': 'merlin', '1': 'loyal_servant', '2': 'percival', '3': 'assassin', '4': 'morgana' },
      }),
      connected: false,
      manualReconnectAvailable: true,
      activeSettlement: settlement,
    }, eventHandlers)

    expect(binding.scene).toMatchObject({
      kind: 'connectionRecovery',
      manualReconnectAvailable: true,
    })
    expect(binding.scene.players.filter(({ portrait }) => portrait.kind === 'roleArtwork').map(({ playerID }) => playerID)).toEqual(['1'])
    expect(binding.actions).toEqual({ onReconnect: eventHandlers.onReconnect })
  })

  it('correlates lobby, proposal, and vote scenes with only their own actions', () => {
    const lobby = buildRoomSceneBinding(readyInput('lobby', { status: 'lobby' }), eventHandlers)
    const proposal = buildRoomSceneBinding({
      ...readyInput('teamProposal'),
      activeStage: 'leader',
      selectedTeam: ['1', '0'],
    }, eventHandlers)
    const vote = buildRoomSceneBinding({
      ...readyInput('teamVote', {
        proposedTeam: ['0', '2'],
        submittedTeamVotePlayerIDs: ['1', '3'],
      }),
      selectedTeamVote: 'approve',
    }, eventHandlers)

    expect(lobby.scene).toMatchObject({
      kind: 'lobby', occupiedCount: 5, seatCount: 5, viewer: 'owner',
      canStart: true, startRequestState: 'idle',
    })
    expect(Object.keys(lobby.actions ?? {})).toEqual(['onActivatePlayer', 'onStart'])
    expect(proposal.scene).toMatchObject({
      kind: 'teamProposal', perspective: 'leader', requiredTeamSize: 2,
      selectedCount: 2, canSubmit: true, submitRequestState: 'idle',
      teamTokens: [{ playerID: '0', seatNumber: 1 }, { playerID: '1', seatNumber: 2 }],
    })
    expect(Object.keys(proposal.actions ?? {})).toEqual(['onActivatePlayer', 'onSubmitTeam'])
    expect(vote.scene).toMatchObject({
      kind: 'teamVote', submittedCount: 2, participantCount: 5,
      teamTokens: [{ playerID: '0', seatNumber: 1 }, { playerID: '2', seatNumber: 3 }],
      view: { kind: 'choosing', selectedVote: 'approve', canChoose: true, submitRequestState: 'idle' },
    })
    expect(Object.keys(vote.actions ?? {})).toEqual(['onSelectVote', 'onConfirmVote', 'onContinue'])
    expect(vote.scene.players.find(({ playerID }) => playerID === '1')?.markers).toContainEqual({
      kind: 'vote', status: 'pending',
    })
  })

  it('maps lobby players, proposal observers, and submitted voters to non-authoring views', () => {
    const lobbyPlayer = buildRoomSceneBinding({
      ...readyInput('lobby', { status: 'lobby' }), currentPlayerID: '1', canStart: false,
    }, eventHandlers)
    const proposalObserver = buildRoomSceneBinding({
      ...readyInput('teamProposal'), currentPlayerID: '1', activeStage: undefined,
    }, eventHandlers)
    const submittedVoter = buildRoomSceneBinding(readyInput('teamVote', {
      proposedTeam: ['0', '2'],
      submittedTeamVotePlayerIDs: ['0'],
      viewer: {
        role: 'loyal_servant', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        submittedVote: 'reject',
      },
    }), eventHandlers)

    expect(lobbyPlayer.scene).toMatchObject({ kind: 'lobby', viewer: 'player', canStart: false })
    expect(proposalObserver.scene).toMatchObject({
      kind: 'teamProposal', perspective: 'observer', canSubmit: false, teamTokens: [],
    })
    expect(proposalObserver.scene.players.every(({ interaction }) => interaction.kind === 'none')).toBe(true)
    expect(submittedVoter.scene).toMatchObject({
      kind: 'teamVote', view: { kind: 'waiting', submittedVote: 'reject' },
    })
  })

  it('maps authorized role reveal into confirmation and keeps later private clues concealed', () => {
    const roleReveal = buildRoomSceneBinding(readyInput('identityRecognition', {
      identityRecognition: { step: 'roleReveal', deadlineAt: 1000, confirmedCount: 0, participantCount: 5 },
      viewer: {
        role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    }), eventHandlers)
    const confirmedRoleReveal = buildRoomSceneBinding(readyInput('identityRecognition', {
      identityRecognition: { step: 'roleReveal', deadlineAt: 1000, confirmedCount: 1, participantCount: 5 },
      viewer: {
        role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed: true, deadlineRefreshRequired: false, serverNow: 0 },
      },
    }), eventHandlers)
    const participant = buildRoomSceneBinding(readyInput('identityRecognition', {
      identityRecognition: { step: 'merlinRecognition', deadlineAt: 1000, confirmedCount: 0, participantCount: 1 },
      viewer: {
        role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: ['3', '4'], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    }), eventHandlers)
    const nonparticipant = buildRoomSceneBinding(readyInput('identityRecognition', {
      identityRecognition: { step: 'merlinRecognition', deadlineAt: 1000, confirmedCount: 0, participantCount: 1 },
      viewer: {
        role: 'loyal_servant', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: false, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    }), eventHandlers)

    expect(roleReveal.scene).toMatchObject({
      kind: 'identityConfirmation', role: 'merlin', view: 'concealed', confirmRequestState: 'idle',
    })
    expect(Object.keys(roleReveal.actions ?? {})).toEqual([
      'onReveal', 'onRevealComplete', 'onHide', 'onHideComplete', 'onConfirm', 'onReview', 'onCloseReview',
    ])
    expect(confirmedRoleReveal.scene).toMatchObject({
      kind: 'identityConfirmation', role: 'merlin', view: 'waiting', confirmRequestState: 'idle',
    })
    expect(participant.scene).toMatchObject({
      kind: 'identityRecognition',
      presentation: {
        kind: 'clue', clue: { kind: 'merlinEvil', targetPlayerIDs: ['3', '4'] },
        view: 'concealed', confirmRequestState: 'idle',
      },
    })
    expect(nonparticipant.scene).toMatchObject({
      kind: 'identityRecognition', presentation: { kind: 'observer' },
    })
    expect(nonparticipant.scene.players.every((player) => player.portrait.kind === 'playerAvatar')).toBe(true)
  })

  it('builds Good, Evil, observer, and submitted quest views without offering Good a Fail selection', () => {
    const common = { proposedTeam: ['0', '1'], submittedQuestCardCount: 1 }
    const good = buildRoomSceneBinding(readyInput('quest', common), eventHandlers)
    const evil = buildRoomSceneBinding({
      ...readyInput('quest', {
        ...common,
        viewer: { role: 'minion', loyalty: 'evil', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [] },
      }),
      currentPlayerID: '1', selectedQuestCard: 'fail',
    }, eventHandlers)
    const observer = buildRoomSceneBinding({
      ...readyInput('quest', common), currentPlayerID: '2', activeStage: undefined,
    }, eventHandlers)
    const submitted = buildRoomSceneBinding({
      ...readyInput('quest', {
        ...common,
        viewer: {
          role: 'minion', loyalty: 'evil', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
          submittedQuestCard: 'fail',
        },
      }),
      currentPlayerID: '1',
    }, eventHandlers)

    expect(good.scene).toMatchObject({
      kind: 'quest', view: {
        kind: 'choosing', alignment: 'good', selectedCard: 'success', canChoose: true,
      },
    })
    expect(evil.scene).toMatchObject({
      kind: 'quest', view: { kind: 'choosing', alignment: 'evil', selectedCard: 'fail', canChoose: true },
    })
    expect(observer.scene).toMatchObject({
      kind: 'quest', view: { kind: 'waiting', participation: 'observer', submittedCard: null },
    })
    expect(submitted.scene).toMatchObject({
      kind: 'quest', view: { kind: 'waiting', participation: 'member', submittedCard: 'fail' },
    })
    expect(Object.keys(good.actions ?? {})).toEqual(['onSelectCard', 'onConfirmCard', 'onContinue'])
  })

  it('builds Assassin and observer views and locks target selection while pending', () => {
    const assassin = buildRoomSceneBinding({
      ...readyInput('assassination', {
        goodSuccesses: 3,
        viewer: { role: 'assassin', loyalty: 'evil', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [] },
      }),
      activeStage: 'assassin', selectedTarget: '1', assassinationSubmissionPending: true,
    }, eventHandlers)
    const observer = buildRoomSceneBinding({
      ...readyInput('assassination', { goodSuccesses: 3 }),
      currentPlayerID: '1', activeStage: undefined,
    }, eventHandlers)

    expect(assassin.scene).toMatchObject({
      kind: 'assassination', view: {
        kind: 'selecting', targetPlayerID: '1', canSubmit: false, submitRequestState: 'pending',
      },
    })
    expect(assassin.scene.players.every(({ interaction }) => interaction.kind === 'none')).toBe(true)
    expect(observer.scene).toMatchObject({
      kind: 'assassination', view: { kind: 'observing', perspective: 'good' },
    })
  })

  it('gives a non-Assassin Evil player only the filtered Evil observer view', () => {
    const binding = buildRoomSceneBinding({
      ...readyInput('assassination', {
        goodSuccesses: 3,
        viewer: { role: 'minion', loyalty: 'evil', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [] },
      }),
      currentPlayerID: '3', activeStage: undefined, selectedTarget: '1',
    }, eventHandlers)

    expect(binding.scene).toMatchObject({
      kind: 'assassination', view: { kind: 'observing', perspective: 'evil' },
    })
    expect(binding.scene.players.every(({ emphasis }) => emphasis !== 'target')).toBe(true)
  })

  it('uses settled nested quest and assassination results when filtered live input exposes them', () => {
    const questResult = buildRoomSceneBinding(readyInput('quest', {
      questIndex: 1,
      proposedTeam: ['0', '1', '2'],
      questHistory: [{ questIndex: 1, team: ['0', '1', '2'], successCount: 2, failCount: 1, succeeded: false }],
    }), eventHandlers)
    const assassinationResult = buildRoomSceneBinding(readyInput('assassination', {
      result: { winner: 'good', reason: 'assassination', targetID: '1' },
      revealedRoles: { '1': 'loyal_servant' },
    }), eventHandlers)

    expect(questResult.scene).toMatchObject({
      kind: 'quest', view: { kind: 'result', succeeded: false, successCount: 2, failCount: 1 },
    })
    expect(assassinationResult.scene).toMatchObject({
      kind: 'assassination', view: {
        kind: 'result', targetPlayerID: '1', targetRole: 'loyal_servant', hit: false, winner: 'good',
      },
    })
  })

  it('builds immutable final seats with settled roles and no process interaction', () => {
    const binding = buildRoomSceneBinding(readyInput('finished', {
      status: 'finished',
      leaderID: '0', proposedTeam: ['0', '1'], submittedTeamVotePlayerIDs: ['2'],
      result: { winner: 'good', reason: 'assassination', targetID: '2' },
      revealedRoles: { '0': 'merlin', '1': 'percival', '2': 'loyal_servant', '3': 'assassin', '4': 'morgana' },
    }), eventHandlers)

    expect(binding.scene).toMatchObject({
      kind: 'gameResult', winner: 'good', reason: '刺杀未命中：Claire',
    })
    expect(binding.actions).toBeNull()
    expect(binding.scene.players.every((player) => (
      player.portrait.kind === 'roleArtwork' &&
      player.caption.kind === 'role' &&
      player.markers.length === 0 &&
      player.interaction.kind === 'none'
    ))).toBe(true)
  })

  it('binds a settled vote without mixing in a later proposed team', () => {
    const settlement: Extract<RoomSettlement, { kind: 'teamVote' }> = {
      kind: 'teamVote', key: 'teamVote:0', voteHistoryIndex: 0, questIndex: 0,
      team: ['0', '2'], votes: { '0': 'approve', '1': 'reject', '2': 'approve', '3': 'reject', '4': 'approve' },
      approved: true, approvalCount: 3, rejectionCount: 2, continueIntent: 'continue',
    }
    const binding = buildRoomSceneBinding({
      ...readyInput('teamProposal', { proposedTeam: ['3', '4'] }),
      activeSettlement: settlement,
    }, eventHandlers)

    expect(binding.scene).toMatchObject({
      kind: 'teamVote', questIndex: 0,
      teamTokens: [{ playerID: '0', seatNumber: 1 }, { playerID: '2', seatNumber: 3 }],
      view: { kind: 'result', approved: true, approvalCount: 3, rejectionCount: 2, continueIntent: 'continue' },
    })
    expect(Object.keys(binding.actions ?? {})).toEqual(['onSelectVote', 'onConfirmVote', 'onContinue'])
    expect(binding.scene.players.map(({ playerID, markers }) => [
      playerID,
      markers.find((marker) => marker.kind === 'vote')?.status ?? null,
    ])).toEqual([
      ['0', 'approve'], ['1', 'reject'], ['2', 'approve'], ['3', 'reject'], ['4', 'approve'],
    ])
    expect(binding.scene.players.filter(({ markers }) => (
      markers.some((marker) => marker.kind === 'questMember')
    )).map(({ playerID }) => playerID)).toEqual(['0', '2'])
  })

  it('keeps vote and quest settlement replay progress at the settled quest', () => {
    const vote: Extract<RoomSettlement, { kind: 'teamVote' }> = {
      kind: 'teamVote', key: 'teamVote:1', voteHistoryIndex: 1, questIndex: 1,
      team: ['0', '1', '2'], votes: { '0': 'approve', '1': 'approve', '2': 'approve', '3': 'reject', '4': 'reject' },
      approved: true, approvalCount: 3, rejectionCount: 2, continueIntent: 'continue',
    }
    const quest: Extract<RoomSettlement, { kind: 'quest' }> = {
      kind: 'quest', key: 'quest:1', questIndex: 1, team: ['0', '1', '2'], succeeded: false,
      successCount: 2, failCount: 1, failThreshold: 1, continueIntent: 'continue',
    }
    const latestSnapshot = {
      questIndex: 2,
      questHistory: [
        { questIndex: 0, team: ['0', '1'], successCount: 2, failCount: 0, succeeded: true },
        { questIndex: 1, team: ['0', '1', '2'], successCount: 2, failCount: 1, succeeded: false },
      ],
    }

    const voteBinding = buildRoomSceneBinding({
      ...readyInput('teamProposal', latestSnapshot), activeSettlement: vote,
    }, eventHandlers)
    const questBinding = buildRoomSceneBinding({
      ...readyInput('teamProposal', latestSnapshot), activeSettlement: quest,
    }, eventHandlers)

    expect(voteBinding.scene.questProgress.map(({ state }) => state)).toEqual([
      'success', 'current', 'upcoming', 'upcoming', 'upcoming',
    ])
    expect(questBinding.scene.questProgress.map(({ state }) => state)).toEqual([
      'success', 'failure', 'upcoming', 'upcoming', 'upcoming',
    ])
  })

  it('keeps roles concealed during terminal vote and quest settlement replay', () => {
    const terminalGame = {
      status: 'finished' as const,
      result: { winner: 'good' as const, reason: 'assassination' as const, targetID: '1' },
      revealedRoles: { '0': 'merlin' as const, '1': 'loyal_servant' as const, '2': 'percival' as const, '3': 'assassin' as const, '4': 'morgana' as const },
    }
    const vote: Extract<RoomSettlement, { kind: 'teamVote' }> = {
      kind: 'teamVote', key: 'teamVote:2', voteHistoryIndex: 2, questIndex: 2,
      team: ['0', '1', '2'], votes: { '0': 'approve', '1': 'approve', '2': 'approve', '3': 'reject', '4': 'reject' },
      approved: true, approvalCount: 3, rejectionCount: 2, continueIntent: 'gameResult',
    }
    const quest: Extract<RoomSettlement, { kind: 'quest' }> = {
      kind: 'quest', key: 'quest:2', questIndex: 2, team: ['0', '1', '2'], succeeded: true,
      successCount: 3, failCount: 0, failThreshold: 1, continueIntent: 'assassination',
    }

    const voteBinding = buildRoomSceneBinding({
      ...readyInput('finished', terminalGame), activeSettlement: vote,
    }, eventHandlers)
    const questBinding = buildRoomSceneBinding({
      ...readyInput('finished', terminalGame), activeSettlement: quest,
    }, eventHandlers)

    expect(voteBinding.scene.players.every(({ portrait }) => portrait.kind === 'playerAvatar')).toBe(true)
    expect(questBinding.scene.players.every(({ portrait }) => portrait.kind === 'playerAvatar')).toBe(true)
  })

  it.each([
    ['teamVote', {
      kind: 'teamVote', key: 'teamVote:0', voteHistoryIndex: 0, questIndex: 0,
      team: ['0', '1'], votes: { '0': 'approve', '1': 'approve', '2': 'approve', '3': 'reject', '4': 'reject' },
      approved: true, approvalCount: 3, rejectionCount: 2, continueIntent: 'continue',
    }],
    ['quest', {
      kind: 'quest', key: 'quest:0', questIndex: 0, team: ['0', '1'], succeeded: true,
      successCount: 2, failCount: 0, failThreshold: 1, continueIntent: 'continue',
    }],
  ] as const)('shows private role knowledge only while the %s settlement replay toggle is open', (_kind, settlement) => {
    const input = {
      ...readyInput('teamProposal', {
        viewer: { role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [] },
      }),
      activeSettlement: settlement,
    }
    const concealed = buildRoomSceneBinding({ ...input, roleKnowledgeOpen: false }, eventHandlers)
    const revealed = buildRoomSceneBinding({ ...input, roleKnowledgeOpen: true }, eventHandlers)

    expect(concealed.scene.players.find(({ playerID }) => playerID === '0')?.portrait.kind).toBe('playerAvatar')
    expect(concealed.scene.players.find(({ playerID }) => playerID === '3')?.markers).not.toContainEqual({ kind: 'knownEvil' })
    expect(revealed.scene.players.find(({ playerID }) => playerID === '0')?.portrait).toEqual({ kind: 'roleArtwork', role: 'merlin' })
    expect(revealed.scene.players.find(({ playerID }) => playerID === '3')?.markers).toContainEqual({ kind: 'knownEvil' })
  })

  it('binds a settled quest team and target-only assassination role reveal', () => {
    const quest: Extract<RoomSettlement, { kind: 'quest' }> = {
      kind: 'quest', key: 'quest:1', questIndex: 1, team: ['0', '1', '2'], succeeded: false,
      successCount: 2, failCount: 1, failThreshold: 1, continueIntent: 'continue',
    }
    const assassination: Extract<RoomSettlement, { kind: 'assassination' }> = {
      kind: 'assassination', key: 'assassination:good:1', targetPlayerID: '1', targetRole: 'loyal_servant',
      hit: false, winner: 'good', continueIntent: 'gameResult',
    }
    const questBinding = buildRoomSceneBinding({ ...readyInput('assassination'), activeSettlement: quest }, eventHandlers)
    const assassinationBinding = buildRoomSceneBinding({
      ...readyInput('finished', { status: 'finished', revealedRoles: { '0': 'merlin', '1': 'loyal_servant', '2': 'minion' }, result: { winner: 'good', reason: 'assassination', targetID: '1' } }),
      activeSettlement: assassination,
    }, eventHandlers)

    expect(questBinding.scene).toMatchObject({
      kind: 'quest', questIndex: 1, requiredSubmissionCount: 3,
      view: { kind: 'result', successCount: 2, failCount: 1, failThreshold: 1 },
    })
    expect(questBinding.scene.players.filter(({ markers }) => markers.some((marker) => marker.kind === 'questMember')).map(({ playerID }) => playerID)).toEqual(['0', '1', '2'])
    expect(Object.keys(questBinding.actions ?? {})).toEqual(['onSelectCard', 'onConfirmCard', 'onContinue'])
    expect(assassinationBinding.scene).toMatchObject({
      kind: 'assassination', view: { kind: 'result', targetPlayerID: '1', targetRole: 'loyal_servant', continueIntent: 'gameResult' },
    })
    expect(assassinationBinding.scene.players.filter(({ portrait }) => portrait.kind === 'roleArtwork').map(({ playerID }) => playerID)).toEqual(['1'])
    expect(Object.keys(assassinationBinding.actions ?? {})).toEqual(['onActivatePlayer', 'onAssassinate', 'onContinue'])
  })
})
describe('useRoomScreenController recognition request lifecycle', () => {
  it('clears a confirmed request when the server advances to another recognition step', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const onConfirmIdentityRecognition = () => undefined
    const recognitionGame = (step: 'roleReveal' | 'merlinRecognition') => game({
      identityRecognition: { step, deadlineAt: 1000, confirmedCount: 0, participantCount: step === 'roleReveal' ? 5 : 1 },
      viewer: {
        role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: step === 'merlinRecognition' ? ['3', '4'] : [],
        knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    })
    const input = (currentGame: AvalonPlayerView): UseRoomScreenControllerInput => ({
      activeStage: 'identityRecognition', canStart: false, connected: true,
      currentPlayerID: '0', game: currentGame, manualReconnectAvailable: false,
      matchID: room.matchID, onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'identityRecognition',
      room, seatChangeTargetID: null, startPending: false,
    })
    function Harness({ value }: { value: UseRoomScreenControllerInput }) {
      controller = useRoomScreenController(value)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(recognitionGame('roleReveal')) })))
    if (controller === null || controller.binding.scene.kind !== 'identityConfirmation') {
      throw new Error('Expected identity-confirmation controller')
    }
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onReveal())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onRevealComplete())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onConfirm())
    expect(controller.binding.scene).toMatchObject({
      kind: 'identityConfirmation', view: 'revealed', confirmRequestState: 'pending',
    })

    await act(async () => root.render(createElement(Harness, { value: input(recognitionGame('merlinRecognition')) })))
    expect(controller.binding.scene).toMatchObject({
      kind: 'identityRecognition', presentation: {
        kind: 'clue', view: 'concealed', confirmRequestState: 'idle',
        clue: { kind: 'merlinEvil', targetPlayerIDs: ['3', '4'] },
      },
    })

    await act(async () => root.unmount())
    container.remove()
  })

  it('clears a synchronous identity submission failure and reports it to the outer owner', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const submissionError = new Error('client unavailable')
    const onIdentityRecognitionSubmissionError = vi.fn()
    const input: UseRoomScreenControllerInput = {
      activeStage: 'identityRecognition', canStart: false, connected: true,
      currentPlayerID: '0', game: game({
        identityRecognition: { step: 'roleReveal', deadlineAt: 1000, confirmedCount: 0, participantCount: 5 },
        viewer: {
          role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
          identityRecognition: { isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
        },
      }),
      manualReconnectAvailable: false, matchID: room.matchID,
      onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition: () => { throw submissionError },
      onIdentityRecognitionSubmissionError,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'identityRecognition',
      room, seatChangeTargetID: null, startPending: false,
    }
    function Harness() {
      controller = useRoomScreenController(input)
      return null
    }

    await act(async () => root.render(createElement(Harness)))
    if (controller === null || controller.binding.scene.kind !== 'identityConfirmation') {
      throw new Error('Expected identity-confirmation controller')
    }
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onReveal())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onRevealComplete())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onConfirm())

    expect(onIdentityRecognitionSubmissionError).toHaveBeenCalledWith(submissionError)
    expect(controller.binding.scene).toMatchObject({
      kind: 'identityConfirmation', view: 'revealed', confirmRequestState: 'idle',
    })

    await act(async () => root.unmount())
    container.remove()
  })

  it('drives the approved role confirmation lifecycle and restores privacy after reconnect', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const onConfirmIdentityRecognition = vi.fn()
    const recognitionGame = (confirmed: boolean) => game({
      identityRecognition: { step: 'roleReveal', deadlineAt: 1000, confirmedCount: confirmed ? 1 : 0, participantCount: 5 },
      viewer: {
        role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed, deadlineRefreshRequired: false, serverNow: 0 },
      },
    })
    const input = (currentGame: AvalonPlayerView, connected = true): UseRoomScreenControllerInput => ({
      activeStage: 'identityRecognition', canStart: false, connected,
      currentPlayerID: '0', game: currentGame, manualReconnectAvailable: !connected,
      matchID: room.matchID, onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'identityRecognition',
      room, seatChangeTargetID: null, startPending: false,
    })
    function Harness({ value }: { value: UseRoomScreenControllerInput }) {
      controller = useRoomScreenController(value)
      return null
    }

    const unconfirmed = recognitionGame(false)
    await act(async () => root.render(createElement(Harness, { value: input(unconfirmed) })))
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'concealed' })

    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onReveal())
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'revealing' })
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onRevealComplete())
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'revealed' })
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onHide())
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'hiding' })
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onHideComplete())
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'concealed' })

    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onReveal())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onRevealComplete())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onConfirm())
    expect(onConfirmIdentityRecognition).toHaveBeenCalledOnce()
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'revealed', confirmRequestState: 'pending' })

    await act(async () => root.render(createElement(Harness, { value: input(recognitionGame(true)) })))
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'waiting' })
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onReview())
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'reviewing' })
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onCloseReview())
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'waiting' })

    await act(async () => root.render(createElement(Harness, { value: input(unconfirmed, false) })))
    expect(controller?.binding.scene).toMatchObject({ kind: 'connectionRecovery' })
    await act(async () => root.render(createElement(Harness, { value: input(unconfirmed) })))
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', view: 'concealed' })

    await act(async () => root.unmount())
    container.remove()
  })

  it('requires private recognition clues to be revealed again after reconnect', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const onConfirmIdentityRecognition = vi.fn()
    const currentGame = game({
      identityRecognition: { step: 'merlinRecognition', deadlineAt: 1000, confirmedCount: 0, participantCount: 1 },
      viewer: {
        role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: ['3', '4'], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    })
    const input = (connected: boolean): UseRoomScreenControllerInput => ({
      activeStage: 'identityRecognition', canStart: false, connected,
      currentPlayerID: '0', game: currentGame, manualReconnectAvailable: !connected,
      matchID: room.matchID, onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'identityRecognition',
      room, seatChangeTargetID: null, startPending: false,
    })
    function Harness({ value }: { value: UseRoomScreenControllerInput }) {
      controller = useRoomScreenController(value)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(true) })))
    expect(controller?.binding.scene).toMatchObject({
      kind: 'identityRecognition', presentation: { kind: 'clue', view: 'concealed' },
    })
    await act(async () => controller?.binding.scene.kind === 'identityRecognition' && controller.binding.actions.onReveal())
    expect(controller?.binding.scene).toMatchObject({
      kind: 'identityRecognition', presentation: { kind: 'clue', view: 'revealing' },
    })
    await act(async () => controller?.binding.scene.kind === 'identityRecognition' && controller.binding.actions.onRevealComplete())
    expect(controller?.binding.scene).toMatchObject({
      kind: 'identityRecognition', presentation: { kind: 'clue', view: 'revealed' },
    })
    await act(async () => controller?.binding.scene.kind === 'identityRecognition' && controller.binding.actions.onConfirm())
    expect(onConfirmIdentityRecognition).toHaveBeenCalledOnce()
    expect(controller?.binding.scene).toMatchObject({
      kind: 'identityRecognition', presentation: { kind: 'clue', view: 'revealed', confirmRequestState: 'pending' },
    })

    await act(async () => root.render(createElement(Harness, { value: input(false) })))
    expect(controller?.binding.scene).toMatchObject({ kind: 'connectionRecovery' })
    await act(async () => root.render(createElement(Harness, { value: input(true) })))
    expect(controller?.binding.scene).toMatchObject({
      kind: 'identityRecognition', presentation: { kind: 'clue', view: 'concealed', confirmRequestState: 'idle' },
    })

    await act(async () => root.unmount())
    container.remove()
  })

  it('does not reuse a revealed identity across rooms or viewer roles', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const roleReveal = (role: 'merlin' | 'percival') => game({
      identityRecognition: { step: 'roleReveal', deadlineAt: 1000, confirmedCount: 0, participantCount: 5 },
      viewer: {
        role, loyalty: 'good', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
        identityRecognition: { isParticipant: true, confirmed: false, deadlineRefreshRequired: false, serverNow: 0 },
      },
    })
    const input = (matchID: string, currentGame: AvalonPlayerView): UseRoomScreenControllerInput => ({
      activeStage: 'identityRecognition', canStart: false, connected: true,
      currentPlayerID: '0', game: currentGame, manualReconnectAvailable: false,
      matchID, onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition: () => undefined,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'identityRecognition',
      room, seatChangeTargetID: null, startPending: false,
    })
    function Harness({ value }: { value: UseRoomScreenControllerInput }) {
      controller = useRoomScreenController(value)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(room.matchID, roleReveal('merlin')) })))
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onReveal())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onRevealComplete())
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', role: 'merlin', view: 'revealed' })

    await act(async () => root.render(createElement(Harness, { value: input('room-other', roleReveal('merlin')) })))
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', role: 'merlin', view: 'concealed' })

    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onReveal())
    await act(async () => controller?.binding.scene.kind === 'identityConfirmation' && controller.binding.actions.onRevealComplete())
    await act(async () => root.render(createElement(Harness, { value: input('room-other', roleReveal('percival')) })))
    expect(controller?.binding.scene).toMatchObject({ kind: 'identityConfirmation', role: 'percival', view: 'concealed' })

    await act(async () => root.unmount())
    container.remove()
  })
})

describe('useRoomScreenController settlement queue', () => {
  it('shows a terminal settlement before the final result first exposes all roles', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const observedScenes: Array<ReturnType<typeof useRoomScreenController>['binding']['scene']> = []
    const receipts = new Map<string, string>()
    const settlementReadStorage = {
      getItem: (key: string) => receipts.get(key) ?? null,
      setItem: (key: string, value: string) => { receipts.set(key, value) },
    }
    const input = (currentGame: AvalonPlayerView): UseRoomScreenControllerInput => ({
      activeStage: undefined, canStart: false, connected: true,
      currentPlayerID: '0', game: currentGame, manualReconnectAvailable: false,
      matchID: room.matchID, onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition: () => undefined,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'finished',
      room, seatChangeTargetID: null, startPending: false, settlementReadStorage,
    })
    function Harness({ value, observe }: { value: UseRoomScreenControllerInput; observe: boolean }) {
      const controller = useRoomScreenController(value)
      if (observe) observedScenes.push(controller.binding.scene)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(game()), observe: false })))
    await act(async () => root.render(createElement(Harness, {
      observe: true,
      value: input(game({
        status: 'finished',
        voteHistory: [{
          questIndex: 0, team: ['0', '1'],
          votes: { '0': 'reject', '1': 'reject', '2': 'reject', '3': 'approve', '4': 'approve' },
          approved: false,
        }],
        consecutiveRejectedTeams: 5,
        result: { winner: 'evil', reason: 'five_rejections' },
        revealedRoles: { '0': 'merlin', '1': 'loyal_servant', '2': 'percival', '3': 'assassin', '4': 'morgana' },
      })),
    })))

    expect(observedScenes[0]).toMatchObject({
      kind: 'teamVote', view: { kind: 'result', approved: false, continueIntent: 'gameResult' },
    })
    expect(observedScenes[0]?.players.every(({ portrait }) => portrait.kind === 'playerAvatar')).toBe(true)

    await act(async () => root.unmount())
    container.remove()
  })

  it('keeps recovery reachable and all terminal roles concealed when a snapshot and disconnect arrive together', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const observedBindings: Array<ReturnType<typeof useRoomScreenController>['binding']> = []
    const receipts = new Map<string, string>()
    const settlementReadStorage = {
      getItem: (key: string) => receipts.get(key) ?? null,
      setItem: (key: string, value: string) => { receipts.set(key, value) },
    }
    const onReconnect = vi.fn()
    const input = (currentGame: AvalonPlayerView, connected: boolean): UseRoomScreenControllerInput => ({
      activeStage: undefined, canStart: false, connected,
      currentPlayerID: '0', game: currentGame, manualReconnectAvailable: !connected,
      matchID: room.matchID, onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition: () => undefined,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect, onStart: () => undefined, phase: 'finished',
      room, seatChangeTargetID: null, startPending: false, settlementReadStorage,
    })
    function Harness({ value, observe }: { value: UseRoomScreenControllerInput; observe: boolean }) {
      const controller = useRoomScreenController(value)
      if (observe) observedBindings.push(controller.binding)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(game(), true), observe: false })))
    await act(async () => root.render(createElement(Harness, {
      observe: true,
      value: input(game({
        status: 'finished',
        voteHistory: [{
          questIndex: 0, team: ['0', '1'],
          votes: { '0': 'reject', '1': 'reject', '2': 'reject', '3': 'approve', '4': 'approve' },
          approved: false,
        }],
        consecutiveRejectedTeams: 5,
        result: { winner: 'evil', reason: 'five_rejections' },
        revealedRoles: { '0': 'merlin', '1': 'loyal_servant', '2': 'percival', '3': 'assassin', '4': 'morgana' },
      }), false),
    })))

    expect(observedBindings[0]?.scene).toMatchObject({
      kind: 'connectionRecovery', manualReconnectAvailable: true,
    })
    expect(observedBindings[0]?.scene.players.every(({ portrait }) => portrait.kind === 'playerAvatar')).toBe(true)
    expect(observedBindings[0]?.actions).toEqual({ onReconnect })
    if (observedBindings[0]?.actions !== null && 'onReconnect' in observedBindings[0].actions) {
      observedBindings[0].actions.onReconnect()
    }
    expect(onReconnect).toHaveBeenCalledOnce()

    await act(async () => root.unmount())
    container.remove()
  })

  it('keeps an appended vote visible until continue, then returns to the authoritative phase', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const receipts = new Map<string, string>()
    const settlementReadStorage = {
      getItem: (key: string) => receipts.get(key) ?? null,
      setItem: (key: string, value: string) => { receipts.set(key, value) },
    }
    const onProposeTeam = vi.fn()
    const input = (currentGame: AvalonPlayerView): UseRoomScreenControllerInput => ({
      activeStage: 'leader', canStart: false, connected: true,
      currentPlayerID: '0', game: currentGame, manualReconnectAvailable: false,
      matchID: room.matchID, onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition: () => undefined,
      onPlayQuestCard: () => undefined, onProposeTeam,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'teamProposal',
      room, seatChangeTargetID: null, startPending: false, settlementReadStorage,
    })
    function Harness({ value }: { value: UseRoomScreenControllerInput }) {
      controller = useRoomScreenController(value)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(game()) })))
    await act(async () => root.render(createElement(Harness, { value: input(game({
      voteHistory: [{ questIndex: 0, team: ['0', '1'], votes: { '0': 'reject', '1': 'reject', '2': 'reject', '3': 'approve', '4': 'approve' }, approved: false }],
      consecutiveRejectedTeams: 1,
    })) })))

    expect(controller?.binding.scene).toMatchObject({
      kind: 'teamVote', view: { kind: 'result', approved: false },
    })
    expect([...receipts.keys()]).toHaveLength(1)
    await act(async () => controller?.binding.scene.kind === 'teamVote' && controller.binding.actions.onContinue?.())
    expect(controller?.binding.scene).toMatchObject({ kind: 'teamProposal' })
    expect(onProposeTeam).not.toHaveBeenCalled()

    await act(async () => root.unmount())
    container.remove()
  })
})

describe('useRoomScreenController connection-boundary request recovery', () => {
  it('preserves the selected team and re-enables proposal submission after same-phase reconnect', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const onProposeTeam = vi.fn()
    const currentGame = game()
    const input = (connected: boolean): UseRoomScreenControllerInput => ({
      activeStage: 'leader', canStart: false, connected, currentPlayerID: '0', game: currentGame,
      manualReconnectAvailable: !connected, matchID: room.matchID,
      onAssassinate: () => undefined, onCastTeamVote: () => undefined,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition: () => undefined,
      onPlayQuestCard: () => undefined, onProposeTeam,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'teamProposal',
      room, seatChangeTargetID: null, startPending: false,
    })
    function Harness({ value }: { value: UseRoomScreenControllerInput }) {
      controller = useRoomScreenController(value)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(true) })))
    if (controller === null || controller.binding.scene.kind !== 'teamProposal') {
      throw new Error('Expected team-proposal controller')
    }
    await act(async () => {
      if (controller?.binding.scene.kind !== 'teamProposal') return
      controller.binding.actions.onActivatePlayer('0')
      controller.binding.actions.onActivatePlayer('1')
    })
    expect(controller.binding.scene).toMatchObject({ selectedCount: 2, canSubmit: true })

    await act(async () => controller?.binding.scene.kind === 'teamProposal' && controller.binding.actions.onSubmitTeam())
    expect(onProposeTeam).toHaveBeenCalledWith(['0', '1'])
    expect(controller.binding.scene).toMatchObject({
      kind: 'teamProposal', selectedCount: 2, canSubmit: false, submitRequestState: 'pending',
    })

    await act(async () => root.render(createElement(Harness, { value: input(false) })))
    await act(async () => root.render(createElement(Harness, { value: input(true) })))

    expect(controller.binding.scene).toMatchObject({
      kind: 'teamProposal', selectedCount: 2, canSubmit: true, submitRequestState: 'idle',
    })
    expect(controller.binding.scene.kind === 'teamProposal' && controller.binding.scene.players
      .filter(({ interaction }) => interaction.kind === 'selectTeam' && interaction.selected)
      .map(({ playerID }) => playerID)).toEqual(['0', '1'])

    await act(async () => root.unmount())
    container.remove()
  })

  it('preserves the selected vote and re-enables confirmation after same-phase reconnect', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let controller: ReturnType<typeof useRoomScreenController> | null = null
    const onCastTeamVote = vi.fn()
    const currentGame = game({ proposedTeam: ['0', '1'] })
    const input = (connected: boolean): UseRoomScreenControllerInput => ({
      activeStage: 'vote', canStart: false, connected, currentPlayerID: '0', game: currentGame,
      manualReconnectAvailable: !connected, matchID: room.matchID,
      onAssassinate: () => undefined, onCastTeamVote,
      onChangeSeat: () => undefined, onConfirmIdentityRecognition: () => undefined,
      onPlayQuestCard: () => undefined, onProposeTeam: () => undefined,
      onReconnect: () => undefined, onStart: () => undefined, phase: 'teamVote',
      room, seatChangeTargetID: null, startPending: false,
    })
    function Harness({ value }: { value: UseRoomScreenControllerInput }) {
      controller = useRoomScreenController(value)
      return null
    }

    await act(async () => root.render(createElement(Harness, { value: input(true) })))
    if (controller === null || controller.binding.scene.kind !== 'teamVote') {
      throw new Error('Expected team-vote controller')
    }
    await act(async () => controller?.binding.scene.kind === 'teamVote' && controller.binding.actions.onSelectVote('reject'))
    expect(controller.binding.scene).toMatchObject({
      view: { kind: 'choosing', selectedVote: 'reject', canChoose: true },
    })

    await act(async () => controller?.binding.scene.kind === 'teamVote' && controller.binding.actions.onConfirmVote())
    expect(onCastTeamVote).toHaveBeenCalledWith('reject')
    expect(controller.binding.scene).toMatchObject({
      kind: 'teamVote', view: {
        kind: 'choosing', selectedVote: 'reject', canChoose: false, submitRequestState: 'pending',
      },
    })

    await act(async () => root.render(createElement(Harness, { value: input(false) })))
    await act(async () => root.render(createElement(Harness, { value: input(true) })))

    expect(controller.binding.scene).toMatchObject({
      kind: 'teamVote', view: {
        kind: 'choosing', selectedVote: 'reject', canChoose: true, submitRequestState: 'idle',
      },
    })

    await act(async () => root.unmount())
    container.remove()
  })
})
