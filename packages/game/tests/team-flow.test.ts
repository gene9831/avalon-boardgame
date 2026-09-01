import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'

import { createAvalonGame } from '../src/game'
import { getAvalonPlayerView } from '../src/player-view'
import { loyaltyForRole } from '../src/roles'
import type { AvalonG, PlayerID, TeamVote } from '../src/types'

function createStartedClient(numPlayers = 5) {
  const game = createAvalonGame()
  const client = Client({
    game: {
      ...game,
      setup: (context) => game.setup?.(context, {
        ownerPlayerID: '0',
        occupiedPlayerIDs: Array.from(
          { length: numPlayers },
          (_, index) => String(index),
        ),
        roleConfiguration: { percivalMorgana: false },
      }) as AvalonG,
    },
    numPlayers,
    playerID: '0',
    credentials: 'test-credentials',
  })

  client.moves.startGame()
  while (client.store.getState().ctx.phase === 'identityRecognition') {
    const game = client.store.getState().G as AvalonG
    const step = game.identityRecognition?.step
    const participantIDs = step === 'roleReveal'
      ? client.store.getState().ctx.playOrder
      : step === 'evilRecognition'
        ? Object.entries(game.secret.roleByPlayer)
          .filter(([, role]) => loyaltyForRole(role) === 'evil')
          .map(([playerID]) => playerID)
        : Object.entries(game.secret.roleByPlayer)
          .filter(([, role]) => role === 'merlin')
          .map(([playerID]) => playerID)
    for (const playerID of participantIDs) {
      client.updatePlayerID(playerID)
      client.moves.confirmIdentityRecognition()
    }
  }
  return client
}

function getGame(client: ReturnType<typeof createStartedClient>) {
  return client.store.getState().G as AvalonG
}

function getLeader(client: ReturnType<typeof createStartedClient>) {
  const leaderID = getGame(client).leaderID
  expect(leaderID).not.toBeNull()
  return leaderID as PlayerID
}

function proposeTeam(
  client: ReturnType<typeof createStartedClient>,
  team: PlayerID[],
) {
  client.updatePlayerID(getLeader(client))
  client.moves.proposeTeam(team)
}

function castVotes(
  client: ReturnType<typeof createStartedClient>,
  votes: Record<PlayerID, TeamVote>,
) {
  for (const [playerID, vote] of Object.entries(votes)) {
    client.updatePlayerID(playerID)
    client.moves.castTeamVote(vote)
  }
}

function allVotes(playerCount: number, vote: TeamVote) {
  return Object.fromEntries(
    Array.from({ length: playerCount }, (_, index) => [String(index), vote]),
  ) as Record<PlayerID, TeamVote>
}

describe('Avalon team proposal and vote flow', () => {
  it('rejects a team proposal from a non-leader', () => {
    const client = createStartedClient()
    const gameBefore = getGame(client)
    const nonLeader = client
      .store
      .getState()
      .ctx.playOrder.find((playerID) => playerID !== gameBefore.leaderID)

    expect(nonLeader).toBeDefined()
    client.updatePlayerID(nonLeader as PlayerID)
    const stateIDBefore = client.store.getState()._stateID
    client.moves.proposeTeam(['0', '1'])

    expect(client.store.getState()._stateID).toBe(stateIDBefore)
    expect(getGame(client).proposedTeam).toBeNull()
    expect(client.store.getState().ctx.phase).toBe('teamProposal')
  })

  it('rejects wrong-size, duplicate, and unseated team proposals', () => {
    const client = createStartedClient()
    const leaderID = getLeader(client)
    client.updatePlayerID(leaderID)

    for (const team of [
      ['0'],
      ['0', '0'],
      ['0', '1', '99'],
    ]) {
      const stateIDBefore = client.store.getState()._stateID
      client.moves.proposeTeam(team)
      expect(client.store.getState()._stateID).toBe(stateIDBefore)
      expect(getGame(client).proposedTeam).toBeNull()
    }
  })

  it('puts every player into the vote stage after a valid proposal', () => {
    const client = createStartedClient()
    proposeTeam(client, ['0', '1'])

    expect(client.store.getState().ctx.phase).toBe('teamVote')
    expect(client.store.getState().ctx.activePlayers).toEqual({
      '0': 'vote',
      '1': 'vote',
      '2': 'vote',
      '3': 'vote',
      '4': 'vote',
    })
    expect(getGame(client).proposedTeam).toEqual(['0', '1'])
    expect(getGame(client).secret.pendingVotes).toEqual({})
  })

  it('approves a proposal only with a strict majority', () => {
    const client = createStartedClient()
    const leader = getGame(client).leaderID
    proposeTeam(client, ['0', '1'])
    castVotes(client, {
      '0': 'approve',
      '1': 'approve',
      '2': 'approve',
      '3': 'reject',
      '4': 'reject',
    })

    const game = getGame(client)
    expect(client.store.getState().ctx.phase).toBe('quest')
    expect(game.voteHistory).toEqual([
      {
        proposerID: leader,
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
      },
    ])
    expect(game.consecutiveRejectedTeams).toBe(0)
    expect(game.secret.pendingVotes).toEqual({})
  })

  it('rejects a proposal on a tie and rotates the leader', () => {
    const client = createStartedClient(6)
    const firstLeader = getLeader(client)
    proposeTeam(client, ['0', '1'])
    castVotes(client, {
      '0': 'approve',
      '1': 'approve',
      '2': 'approve',
      '3': 'reject',
      '4': 'reject',
      '5': 'reject',
    })

    const game = getGame(client)
    const leaderIndex = client.store.getState().ctx.playOrder.indexOf(firstLeader)
    const nextLeader = client.store.getState().ctx.playOrder[
      (leaderIndex + 1) % client.store.getState().ctx.playOrder.length
    ]

    expect(client.store.getState().ctx.phase).toBe('teamProposal')
    expect(game.voteHistory[0].approved).toBe(false)
    expect(game.consecutiveRejectedTeams).toBe(1)
    expect(game.proposedTeam).toBeNull()
    expect(game.leaderID).toBe(nextLeader)
    expect(client.store.getState().ctx.currentPlayer).toBe(nextLeader)
  })

  it('ends the game for Evil after five consecutive rejections', () => {
    const client = createStartedClient()

    for (let rejection = 0; rejection < 5; rejection += 1) {
      proposeTeam(client, ['0', '1'])
      castVotes(client, allVotes(5, 'reject'))
    }

    const game = getGame(client)
    expect(client.store.getState().ctx.gameover).toEqual({
      winner: 'evil',
      reason: 'five_rejections',
    })
    expect(game.status).toBe('finished')
    expect(game.result).toEqual({
      winner: 'evil',
      reason: 'five_rejections',
    })
    expect(game.consecutiveRejectedTeams).toBe(5)
  })

  it('publishes team-vote submitters without leaking pending choices', () => {
    const client = createStartedClient()
    proposeTeam(client, ['0', '1'])
    client.updatePlayerID('0')
    client.moves.castTeamVote('approve')

    const submitterView = getAvalonPlayerView(getGame(client), '0')
    const otherView = getAvalonPlayerView(getGame(client), '1')
    const anonymousView = getAvalonPlayerView(getGame(client), null)

    expect(submitterView.submittedTeamVotePlayerIDs).toEqual(['0'])
    expect(otherView.submittedTeamVotePlayerIDs).toEqual(['0'])
    expect(anonymousView.submittedTeamVotePlayerIDs).toEqual(['0'])
    expect(submitterView.viewer.submittedVote).toBe('approve')
    expect(otherView.viewer.submittedVote).toBeUndefined()
    expect(anonymousView.viewer.submittedVote).toBeUndefined()

    castVotes(client, {
      '1': 'approve',
      '2': 'approve',
      '3': 'reject',
      '4': 'reject',
    })

    expect(
      getAvalonPlayerView(getGame(client), '1').submittedTeamVotePlayerIDs,
    ).toEqual([])
    expect(getGame(client).voteHistory.at(-1)?.votes).toEqual({
      '0': 'approve',
      '1': 'approve',
      '2': 'approve',
      '3': 'reject',
      '4': 'reject',
    })
  })

  it('does not accept a second vote from the same player', () => {
    const client = createStartedClient()
    proposeTeam(client, ['0', '1'])
    client.updatePlayerID('0')
    client.moves.castTeamVote('approve')

    expect(getAvalonPlayerView(getGame(client), '0').viewer.submittedVote).toBe(
      'approve',
    )
    expect(
      getAvalonPlayerView(getGame(client), '1').viewer.submittedVote,
    ).toBeUndefined()

    const stateIDAfterFirstVote = client.store.getState()._stateID
    const pendingVotesAfterFirstVote = { ...getGame(client).secret.pendingVotes }
    client.moves.castTeamVote('reject')

    expect(client.store.getState()._stateID).toBe(stateIDAfterFirstVote)
    expect(getGame(client).secret.pendingVotes).toEqual(pendingVotesAfterFirstVote)
  })
})
