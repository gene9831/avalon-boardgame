import { describe, expect, it } from 'vitest'
import type { AvalonPlayerView } from '@avalon/game'

import type { AvalonMatch } from '../src/lobby'
import {
  buildRoomPlayerPresentation,
  type FilteredSeatInput,
} from '../src/room-player-presentation'
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
    roomExitBusy: false,
    connected: true,
    manualReconnectAvailable: false,
    startPending: false,
    teamSubmissionPending: false,
    selectedTeamVote: null,
    teamVoteSubmissionPending: false,
    selectedQuestCard: null,
    questCardSubmissionPending: false,
  }
}

describe('buildRoomScreenModel', () => {
  it('cleans process state from a settled public role presentation', () => {
    const finalResultInput: FilteredSeatInput = {
      playerID: '0', relativeSeatIndex: 0, seatNumber: 1, name: 'Alice', occupied: true,
      isCurrentPlayer: true,
      avatarID: 'merlin', connected: false,
      role: { kind: 'settledReveal', role: 'merlin' },
      isOwner: true, isLeader: true, isQuestMember: true,
      isSelected: true, isSelectedTarget: true,
      knownEvil: true, knownMerlinCandidate: true,
      voteStatus: 'approve',
      recognition: { kind: 'recognition', label: '你', tone: 'self' },
      interaction: { kind: 'selectTeam', disabled: false, selected: true },
    }

    expect(buildRoomPlayerPresentation(finalResultInput)).toMatchObject({
      portrait: { kind: 'roleArtwork', role: 'merlin' },
      markers: [],
      caption: { kind: 'role', role: 'merlin' },
      interaction: { kind: 'none' },
    })
  })

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
    expect(model.players.every((player) => player.portrait.kind === 'playerAvatar')).toBe(true)
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

  it('normalizes lobby migration state into each seat interaction', () => {
    const model = buildRoomScreenModel({
      ...readyInput('lobby', { status: 'lobby' }),
      room: {
        ...room,
        players: room.players.map((player) => player.id === 3
          ? { ...player, name: undefined }
          : player),
      },
      seatChangeTargetID: '3',
    })

    expect(model.players.find(({ playerID }) => playerID === '3')?.interaction).toEqual({
      kind: 'changeSeat', disabled: true, pending: true,
    })
    expect(model.players.find(({ playerID }) => playerID === '4')?.interaction).toEqual({
      kind: 'changeSeat', disabled: true, pending: false,
    })
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
    expect(model.players.find((player) => player.isCurrentPlayer)?.portrait).toMatchObject({
      kind: 'playerAvatar', connected: false,
    })
  })

  it('builds distinct leader and observer presentations for a team proposal', () => {
    const leader = buildRoomScreenModel({
      ...readyInput('teamProposal'), activeStage: 'leader', selectedTeam: ['1'],
      teamSubmissionPending: false,
    })
    const observer = buildRoomScreenModel({
      ...readyInput('teamProposal'), currentPlayerID: '1', activeStage: undefined,
      selectedTeam: [], teamSubmissionPending: false,
    })
    const submitting = buildRoomScreenModel({
      ...readyInput('teamProposal'), activeStage: 'leader', selectedTeam: ['0', '1'],
      teamSubmissionPending: true,
    })

    expect(leader.playerInteractionMode).toBe('selectTeam')
    expect(leader.players.find(({ playerID }) => playerID === '1')?.interaction).toEqual({
      kind: 'selectTeam', disabled: false, selected: true,
    })
    expect(leader.center).toMatchObject({
      kind: 'questSummary', status: '由你组建本次任务队伍',
    })
    expect(leader.phase).toMatchObject({
      kind: 'teamProposal', title: '组建任务队伍', requiredTeamSize: 2,
      selectedCount: 1, isLeader: true, canSubmit: false, isSubmitting: false,
    })
    expect(observer.playerInteractionMode).toBe('none')
    expect(observer.players.every(({ interaction }) => interaction.kind === 'none')).toBe(true)
    expect(observer.center).toMatchObject({
      kind: 'questSummary', status: '等待队长选择任务队员',
    })
    expect(observer.phase).toMatchObject({
      kind: 'teamProposal', title: '等待队长组队', isLeader: false,
      canSubmit: false, isSubmitting: false,
    })
    expect(submitting.phase).toMatchObject({
      kind: 'teamProposal', isLeader: true, canSubmit: false, isSubmitting: true,
    })
  })

  it('builds the active team vote presentation without exposing another player\'s choice', () => {
    const model = buildRoomScreenModel({
      ...readyInput('teamVote', {
        proposedTeam: ['0', '2'],
        submittedTeamVotePlayerIDs: ['1', '3'],
      }),
      selectedTeamVote: 'approve',
    })

    expect(model.center).toMatchObject({
      kind: 'questSummary', status: '已确定 2 名任务队员',
      detail: '等待所有玩家投票',
    })
    expect(model.phase).toMatchObject({
      kind: 'teamVote', selectedVote: 'approve', submittedVote: null,
      canVote: true, isSubmitting: false,
    })
    expect(model.players.find(({ playerID }) => playerID === '0')?.markers).toContainEqual({
      kind: 'questMember',
    })
    expect(model.players.find(({ playerID }) => playerID === '1')?.markers).toContainEqual({
      kind: 'vote', status: 'pending',
    })
  })

  it('builds Good, Evil, observer, and submitted quest presentations from filtered state', () => {
    const approvedVote = {
      proposerID: '0', questIndex: 0, team: ['0', '1'], approved: true,
      votes: { '0': 'approve', '1': 'approve', '2': 'approve', '3': 'approve', '4': 'reject' },
    } as const
    const common = {
      proposedTeam: ['0', '1'], submittedQuestCardCount: 1,
      voteHistory: [approvedVote],
    }
    const good = buildRoomScreenModel({
      ...readyInput('quest', common), selectedQuestCard: null,
    })
    const evil = buildRoomScreenModel({
      ...readyInput('quest', {
        ...common,
        viewer: { role: 'minion', loyalty: 'evil', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [] },
      }),
      currentPlayerID: '1', selectedQuestCard: 'fail',
    })
    const observer = buildRoomScreenModel({
      ...readyInput('quest', common), currentPlayerID: '2', activeStage: undefined,
    })
    const submitted = buildRoomScreenModel({
      ...readyInput('quest', {
        ...common,
        viewer: {
          role: 'minion', loyalty: 'evil', knownEvilPlayerIDs: [], knownMerlinCandidatePlayerIDs: [],
          submittedQuestCard: 'fail',
        },
      }),
      currentPlayerID: '1', selectedQuestCard: null,
    })

    expect(good.center).toMatchObject({
      kind: 'questSummary', status: '队伍表决通过 · 4 同意 / 1 反对',
      detail: '任务牌 1 / 2', rule: null,
    })
    expect(good.phase).toMatchObject({
      kind: 'quest', title: '执行任务', isOnTeam: true, isEvil: false,
      selectedCard: 'success', canConfirm: true,
    })
    expect(evil.phase).toMatchObject({
      kind: 'quest', title: '执行任务', isOnTeam: true, isEvil: true,
      selectedCard: 'fail', canConfirm: true,
    })
    expect(observer.phase).toMatchObject({
      kind: 'quest', title: '等待任务结果', isOnTeam: false, canConfirm: false,
    })
    expect(submitted.phase).toMatchObject({
      kind: 'quest', title: '等待任务结果', submittedCard: 'fail', canConfirm: false,
    })
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
    expect(model.players.find(({ playerID }) => playerID === '3')).toMatchObject({
      markers: [{ kind: 'knownEvil' }],
      interaction: { kind: 'selectAssassinationTarget', disabled: true, selected: false },
    })
  })

  it('builds private Assassin selection without carrying round decorations into assassination', () => {
    const previousQuest = {
      questIndex: 2, team: ['0', '1'], successCount: 2, failCount: 0, succeeded: true,
    } as const
    const previousVote = {
      proposerID: '0', questIndex: 2, team: ['0', '1'], approved: true,
      votes: { '0': 'approve', '1': 'approve', '2': 'reject', '3': 'approve', '4': 'approve' },
    } as const
    const input = readyInput('assassination', {
      leaderID: '0', proposedTeam: ['0', '1'], submittedTeamVotePlayerIDs: ['2'],
      questIndex: 2, questHistory: [previousQuest], voteHistory: [previousVote], goodSuccesses: 3,
      viewer: {
        role: 'assassin', loyalty: 'evil', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [],
      },
    })
    const model = buildRoomScreenModel({
      ...input, activeStage: 'assassin', selectedTarget: '1', assassinationSubmissionPending: false,
    })

    expect(model.center).toEqual({
      kind: 'assassinationSummary', title: '刺杀梅林',
      status: '正义阵营已完成 3 次任务',
      detail: '刺客命中梅林，邪恶阵营即可逆转', statusTone: 'neutral',
    })
    expect(model.phase).toEqual({
      kind: 'assassination', title: '刺杀梅林', perspective: 'assassin',
      targetName: 'Bob', canSubmit: true, isSubmitting: false,
    })
    expect(model.playerInteractionMode).toBe('selectAssassinationTarget')
    expect(model.players.find(({ playerID }) => playerID === '1')).toMatchObject({
      emphasis: 'target',
      interaction: { kind: 'selectAssassinationTarget', disabled: false, selected: true },
    })
    expect(model.players.every(({ markers }) => markers.every(
      ({ kind }) => kind !== 'leader' && kind !== 'questMember' && kind !== 'vote',
    ))).toBe(true)
    expect(model.questProgress.every(({ state }) => state !== 'current')).toBe(true)
  })

  it('gives Evil allies and Good players waiting views without exposing a local target', () => {
    const evil = buildRoomScreenModel({
      ...readyInput('assassination', {
        goodSuccesses: 3,
        viewer: { role: 'minion', loyalty: 'evil', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [] },
      }),
      currentPlayerID: '3', activeStage: undefined, selectedTarget: '1',
    })
    const good = buildRoomScreenModel({
      ...readyInput('assassination', { goodSuccesses: 3 }),
      currentPlayerID: '1', activeStage: undefined, selectedTarget: '2',
    })

    expect(evil.phase).toEqual({
      kind: 'assassination', title: '协助刺杀', perspective: 'evil',
      targetName: null, canSubmit: false, isSubmitting: false,
    })
    expect(good.phase).toEqual({
      kind: 'assassination', title: '等待刺杀', perspective: 'good',
      targetName: null, canSubmit: false, isSubmitting: false,
    })
    expect(evil.players.every(({ emphasis }) => emphasis !== 'target')).toBe(true)
    expect(good.players.every(({ emphasis }) => emphasis !== 'target')).toBe(true)
  })

  it('locks the Assassin target while submission is pending', () => {
    const model = buildRoomScreenModel({
      ...readyInput('assassination', {
        goodSuccesses: 3,
        viewer: { role: 'assassin', loyalty: 'evil', knownEvilPlayerIDs: ['3'], knownMerlinCandidatePlayerIDs: [] },
      }),
      activeStage: 'assassin', selectedTarget: '1', assassinationSubmissionPending: true,
    })

    expect(model.playerInteractionMode).toBe('none')
    expect(model.phase).toMatchObject({
      kind: 'assassination', targetName: 'Bob', canSubmit: false, isSubmitting: true,
    })
  })

  it.each([
    [
      'an Evil three-failed-quest victory',
      { winner: 'evil', reason: 'three_quests' } as const,
      '破坏 3 次任务',
    ],
    [
      'a Good three-successful-quest legacy result',
      { winner: 'good', reason: 'three_quests' } as const,
      '完成 3 次任务',
    ],
    [
      'an assassination hit with the public target',
      { winner: 'evil', reason: 'assassination', targetID: '1' } as const,
      '刺杀命中梅林：Bob',
    ],
    [
      'an assassination miss with the public target',
      { winner: 'good', reason: 'assassination', targetID: '2' } as const,
      '刺杀未命中：Claire',
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
      questScore: '任务 0 成功 / 0 失败',
    })
    expect(model.phase).toMatchObject({
      kind: 'finished',
      message: '所有玩家身份已公开，可查看对局记录',
    })
  })

  it('cleans all in-progress seat markers and exposes final utilities and role reveals', () => {
    const disconnectedRoom: AvalonMatch = {
      ...room,
      players: room.players.map((player) => player.id === 1 ? { ...player, isConnected: false } : player),
    }
    const model = buildRoomScreenModel({
      ...readyInput('finished', {
        status: 'finished',
        leaderID: '0', proposedTeam: ['0', '1'],
        submittedTeamVotePlayerIDs: ['0', '1'],
        questHistory: [
          { questIndex: 0, team: ['0', '1'], successCount: 2, failCount: 0, succeeded: true },
          { questIndex: 1, team: ['1', '2', '3'], successCount: 2, failCount: 1, succeeded: false },
          { questIndex: 2, team: ['0', '2'], successCount: 2, failCount: 0, succeeded: true },
          { questIndex: 3, team: ['0', '1', '3'], successCount: 3, failCount: 0, succeeded: true },
        ],
        goodSuccesses: 3, evilFailures: 1,
        result: { winner: 'good', reason: 'assassination', targetID: '2' },
        revealedRoles: { '0': 'merlin', '1': 'percival', '2': 'loyal_servant', '3': 'assassin', '4': 'morgana' },
      }),
      room: disconnectedRoom,
      selectedTeam: ['1'], selectedTarget: '2', roleKnowledgeOpen: true,
    })

    expect(model.center).toEqual({
      kind: 'resultSummary', winner: 'good',
      reason: '刺杀未命中：Claire', questScore: '任务 3 成功 / 1 失败',
    })
    expect(model.players.every((player) => (
      player.portrait.kind === 'roleArtwork' &&
      player.markers.length === 0 &&
      player.caption.kind === 'role' &&
      player.emphasis === 'default' &&
      player.interaction.kind === 'none'
    ))).toBe(true)
    expect(model.questProgress.every(({ state }) => state !== 'current')).toBe(true)
    expect(model.utilities).toEqual({
      variant: 'game', showRoomExit: true, showIdentityKnowledge: false, roleKnowledgeOpen: false,
    })
  })
})
