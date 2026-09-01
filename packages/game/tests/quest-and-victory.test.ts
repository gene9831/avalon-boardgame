import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'

import { getPlayerCountConfig } from '../src/config'
import { createAvalonGame } from '../src/game'
import { getAvalonPlayerView } from '../src/player-view'
import { loyaltyForRole } from '../src/roles'
import type {
  AvalonG,
  PlayerID,
  QuestCard,
  Role,
} from '../src/types'

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

function getRoleByPlayer(client: ReturnType<typeof createStartedClient>) {
  return getGame(client).secret.roleByPlayer
}

function getLeader(client: ReturnType<typeof createStartedClient>) {
  const leaderID = getGame(client).leaderID
  expect(leaderID).not.toBeNull()
  return leaderID as PlayerID
}

function getTeamSize(client: ReturnType<typeof createStartedClient>) {
  const state = client.store.getState()
  return getPlayerCountConfig(state.ctx.numPlayers).questTeamSizes[
    getGame(client).questIndex
  ]
}

function proposeAndApprove(
  client: ReturnType<typeof createStartedClient>,
  team: PlayerID[],
) {
  client.updatePlayerID(getLeader(client))
  client.moves.proposeTeam(team)

  for (const playerID of client.store.getState().ctx.playOrder) {
    client.updatePlayerID(playerID)
    client.moves.castTeamVote('approve')
  }
}

function playCards(
  client: ReturnType<typeof createStartedClient>,
  cards: Record<PlayerID, QuestCard>,
) {
  for (const [playerID, card] of Object.entries(cards)) {
    client.updatePlayerID(playerID)
    client.moves.playQuestCard(card)
  }
}

function chooseTeam(
  client: ReturnType<typeof createStartedClient>,
  options: { evilCount: number },
) {
  const roleByPlayer = getRoleByPlayer(client)
  const teamSize = getTeamSize(client)
  const evilIDs = Object.entries(roleByPlayer)
    .filter(([, role]) => loyaltyForRole(role) === 'evil')
    .map(([playerID]) => playerID)
  const goodIDs = Object.entries(roleByPlayer)
    .filter(([, role]) => loyaltyForRole(role) === 'good')
    .map(([playerID]) => playerID)

  return [
    ...evilIDs.slice(0, options.evilCount),
    ...goodIDs.slice(0, teamSize - options.evilCount),
  ]
}

function cardsForTeam(
  roleByPlayer: Record<PlayerID, Role>,
  team: PlayerID[],
  evilCard: QuestCard = 'success',
) {
  return Object.fromEntries(
    team.map((playerID) => [
      playerID,
      loyaltyForRole(roleByPlayer[playerID]) === 'evil'
        ? evilCard
        : 'success',
    ]),
  ) as Record<PlayerID, QuestCard>
}

function finishThreeGoodQuests(client: ReturnType<typeof createStartedClient>) {
  for (let quest = 0; quest < 3; quest += 1) {
    const team = chooseTeam(client, { evilCount: 0 })
    proposeAndApprove(client, team)
    playCards(client, cardsForTeam(getRoleByPlayer(client), team))
  }
}

describe('Avalon quest and victory flow', () => {
  it('activates only the proposed team for quest cards', () => {
    const client = createStartedClient()
    const team = chooseTeam(client, { evilCount: 0 })
    proposeAndApprove(client, team)

    expect(client.store.getState().ctx.phase).toBe('quest')
    expect(client.store.getState().ctx.activePlayers).toEqual(
      Object.fromEntries(team.map((playerID) => [playerID, 'quest'])),
    )
  })

  it('requires Good to play Success and rejects duplicate quest cards', () => {
    const client = createStartedClient()
    const team = chooseTeam(client, { evilCount: 0 })
    proposeAndApprove(client, team)
    const goodPlayerID = team[0]

    client.updatePlayerID(goodPlayerID)
    const stateIDBeforeInvalidCard = client.store.getState()._stateID
    client.moves.playQuestCard('fail')

    expect(client.store.getState()._stateID).toBe(stateIDBeforeInvalidCard)
    expect(getGame(client).secret.pendingQuestCards).toEqual({})

    client.moves.playQuestCard('success')
    expect(
      getAvalonPlayerView(getGame(client), goodPlayerID).viewer
        .submittedQuestCard,
    ).toBe('success')
    expect(
      getAvalonPlayerView(getGame(client), team[1]).viewer.submittedQuestCard,
    ).toBeUndefined()
    const stateIDAfterFirstCard = client.store.getState()._stateID
    client.moves.playQuestCard('success')

    expect(client.store.getState()._stateID).toBe(stateIDAfterFirstCard)
    expect(getGame(client).secret.pendingQuestCards[goodPlayerID]).toBe('success')
  })

  it('allows Evil to fail a quest and exposes only aggregate quest results', () => {
    const client = createStartedClient()
    const team = chooseTeam(client, { evilCount: 1 })
    proposeAndApprove(client, team)
    playCards(client, cardsForTeam(getRoleByPlayer(client), team, 'fail'))

    const game = getGame(client)
    expect(game.questHistory[0]).toEqual({
      questIndex: 0,
      team,
      successCount: team.length - 1,
      failCount: 1,
      succeeded: false,
    })
    expect(game.questHistory[0]).not.toHaveProperty('cards')
    expect(game.secret.pendingQuestCards).toEqual({})
    expect(getAvalonPlayerView(game, '0')).not.toHaveProperty('secret')
  })

  it('uses the two-Fail threshold on the fourth quest for seven players', () => {
    const clientWithOneFail = createStartedClient(7)

    const firstTeam = chooseTeam(clientWithOneFail, { evilCount: 1 })
    proposeAndApprove(clientWithOneFail, firstTeam)
    playCards(
      clientWithOneFail,
      cardsForTeam(getRoleByPlayer(clientWithOneFail), firstTeam, 'fail'),
    )

    for (let quest = 1; quest < 3; quest += 1) {
      const team = chooseTeam(clientWithOneFail, { evilCount: 0 })
      proposeAndApprove(clientWithOneFail, team)
      playCards(
        clientWithOneFail,
        cardsForTeam(getRoleByPlayer(clientWithOneFail), team),
      )
    }

    const fourthTeam = chooseTeam(clientWithOneFail, { evilCount: 1 })
    proposeAndApprove(clientWithOneFail, fourthTeam)
    playCards(
      clientWithOneFail,
      cardsForTeam(getRoleByPlayer(clientWithOneFail), fourthTeam, 'fail'),
    )
    expect(getGame(clientWithOneFail).questHistory[3].succeeded).toBe(true)

    const clientWithTwoFails = createStartedClient(7)
    const firstTeamForTwoFails = chooseTeam(clientWithTwoFails, { evilCount: 1 })
    proposeAndApprove(clientWithTwoFails, firstTeamForTwoFails)
    playCards(
      clientWithTwoFails,
      cardsForTeam(
        getRoleByPlayer(clientWithTwoFails),
        firstTeamForTwoFails,
        'fail',
      ),
    )

    for (let quest = 1; quest < 3; quest += 1) {
      const team = chooseTeam(clientWithTwoFails, { evilCount: 0 })
      proposeAndApprove(clientWithTwoFails, team)
      playCards(
        clientWithTwoFails,
        cardsForTeam(getRoleByPlayer(clientWithTwoFails), team),
      )
    }

    const fourthTeamForTwoFails = chooseTeam(clientWithTwoFails, {
      evilCount: 2,
    })
    proposeAndApprove(clientWithTwoFails, fourthTeamForTwoFails)
    playCards(
      clientWithTwoFails,
      cardsForTeam(
        getRoleByPlayer(clientWithTwoFails),
        fourthTeamForTwoFails,
        'fail',
      ),
    )
    expect(getGame(clientWithTwoFails).questHistory[3].succeeded).toBe(false)
  })

  it('ends for Evil after three failed quests', () => {
    const client = createStartedClient()

    for (let quest = 0; quest < 3; quest += 1) {
      const team = chooseTeam(client, { evilCount: 1 })
      proposeAndApprove(client, team)
      playCards(client, cardsForTeam(getRoleByPlayer(client), team, 'fail'))
    }

    expect(client.store.getState().ctx.gameover).toEqual({
      winner: 'evil',
      reason: 'three_quests',
    })
    expect(getGame(client).result).toEqual({
      winner: 'evil',
      reason: 'three_quests',
    })
  })

  it('enters assassination after three Good successes', () => {
    const client = createStartedClient()
    finishThreeGoodQuests(client)

    const assassinID = Object.entries(getRoleByPlayer(client)).find(
      ([, role]) => role === 'assassin',
    )?.[0]

    expect(client.store.getState().ctx.phase).toBe('assassination')
    expect(client.store.getState().ctx.activePlayers).toEqual({
      [assassinID as string]: 'assassin',
    })
  })

  it('rejects an Evil assassination target and lets Assassin identify Merlin', () => {
    const client = createStartedClient()
    finishThreeGoodQuests(client)
    const roleByPlayer = getRoleByPlayer(client)
    const assassinID = Object.entries(roleByPlayer).find(
      ([, role]) => role === 'assassin',
    )?.[0] as PlayerID
    const evilTarget = Object.entries(roleByPlayer).find(
      ([, role]) => loyaltyForRole(role) === 'evil' && role !== 'assassin',
    )?.[0] as PlayerID
    const merlinID = Object.entries(roleByPlayer).find(
      ([, role]) => role === 'merlin',
    )?.[0] as PlayerID

    client.updatePlayerID(assassinID)
    const stateIDBeforeInvalidTarget = client.store.getState()._stateID
    client.moves.assassinate(evilTarget)
    expect(client.store.getState()._stateID).toBe(stateIDBeforeInvalidTarget)
    expect(client.store.getState().ctx.gameover).toBeUndefined()

    client.moves.assassinate(merlinID)
    expect(client.store.getState().ctx.gameover).toEqual({
      winner: 'evil',
      reason: 'assassination',
      targetID: merlinID,
    })
    expect(getAvalonPlayerView(getGame(client), '0').revealedRoles).toEqual(
      roleByPlayer,
    )
  })

  it('gives Good the win when Assassin identifies another Good player', () => {
    const client = createStartedClient()
    finishThreeGoodQuests(client)
    const roleByPlayer = getRoleByPlayer(client)
    const assassinID = Object.entries(roleByPlayer).find(
      ([, role]) => role === 'assassin',
    )?.[0] as PlayerID
    const goodTarget = Object.entries(roleByPlayer).find(
      ([, role]) => loyaltyForRole(role) === 'good' && role !== 'merlin',
    )?.[0] as PlayerID

    client.updatePlayerID(assassinID)
    client.moves.assassinate(goodTarget)

    expect(client.store.getState().ctx.gameover).toEqual({
      winner: 'good',
      reason: 'assassination',
      targetID: goodTarget,
    })
  })
})
