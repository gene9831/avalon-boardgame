import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'

import { AvalonGame, createAvalonGame } from '../src/game'
import { getAvalonPlayerView } from '../src/player-view'
import type {
  AvalonG,
  AvalonSetupData,
  IdentityRecognitionStep,
} from '../src/types'
import { loyaltyForRole } from '../src/roles'

function createLocalClient(
  numPlayers = 5,
  setupData?: AvalonSetupData,
) {
  const resolvedSetupData = setupData ?? {
    ownerPlayerID: '0',
    occupiedPlayerIDs: Array.from(
      { length: numPlayers },
      (_, index) => String(index),
    ),
    roleConfiguration: { percivalMorgana: false },
  }
  const game = createAvalonGame()

  return Client({
    game: {
      ...game,
      setup: (context) => game.setup?.(context, resolvedSetupData) as AvalonG,
    },
    numPlayers,
    playerID: '0',
    credentials: 'test-credentials',
  })
}

function getAuthoritativeGame(client: ReturnType<typeof createLocalClient>) {
  return client.store.getState().G as AvalonG
}

function completeIdentityRecognition(
  client: ReturnType<typeof createLocalClient>,
) {
  while (client.store.getState().ctx.phase === 'identityRecognition') {
    const game = getAuthoritativeGame(client)
    const step = game.identityRecognition?.step
    const participantIDs = step === 'roleReveal'
      ? client.store.getState().ctx.playOrder
      : step === 'evilRecognition'
        ? Object.entries(game.secret.roleByPlayer)
          .filter(([, role]) => loyaltyForRole(role) === 'evil')
          .map(([playerID]) => playerID)
        : step === 'merlinRecognition'
          ? Object.entries(game.secret.roleByPlayer)
            .filter(([, role]) => role === 'merlin')
            .map(([playerID]) => playerID)
          : Object.entries(game.secret.roleByPlayer)
            .filter(([, role]) => role === 'percival')
            .map(([playerID]) => playerID)

    for (const playerID of participantIDs) {
      client.updatePlayerID(playerID)
      client.moves.confirmIdentityRecognition()
    }
  }
}

function createRecognitionStateAt(step: IdentityRecognitionStep) {
  const client = createLocalClient(5, {
    ownerPlayerID: '0',
    occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    roleConfiguration: { percivalMorgana: true },
  })
  client.moves.startGame()

  while (
    client.store.getState().ctx.phase === 'identityRecognition' &&
    getAuthoritativeGame(client).identityRecognition?.step !== step
  ) {
    const game = getAuthoritativeGame(client)
    const currentStep = game.identityRecognition?.step
    const participantIDs = currentStep === 'roleReveal'
      ? client.store.getState().ctx.playOrder
      : currentStep === 'evilRecognition'
        ? Object.entries(game.secret.roleByPlayer)
          .filter(([, role]) => loyaltyForRole(role) === 'evil')
          .map(([playerID]) => playerID)
        : currentStep === 'merlinRecognition'
          ? Object.entries(game.secret.roleByPlayer)
            .filter(([, role]) => role === 'merlin')
            .map(([playerID]) => playerID)
          : Object.entries(game.secret.roleByPlayer)
            .filter(([, role]) => role === 'percival')
            .map(([playerID]) => playerID)

    for (const playerID of participantIDs) {
      client.updatePlayerID(playerID)
      client.moves.confirmIdentityRecognition()
    }
  }

  return getAuthoritativeGame(client)
}

describe('Avalon setup and player views', () => {
  it('does not start an unprepared match without authoritative occupancy', () => {
    const client = Client({
      game: AvalonGame,
      numPlayers: 5,
      playerID: '0',
    })
    const beforeMove = client.store.getState()._stateID

    client.moves.startGame()

    expect(client.store.getState()._stateID).toBe(beforeMove)
    expect(getAuthoritativeGame(client).status).toBe('lobby')
    expect(getAuthoritativeGame(client).lobby.occupiedPlayerIDs).toEqual([])
  })

  it('replays role assignment and initial leader from the same RNG seed', () => {
    const setupData: AvalonSetupData = {
      ownerPlayerID: '0',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4', '5', '6'],
      roleConfiguration: { percivalMorgana: false },
    }
    const firstGame = createAvalonGame({ seed: 'replay-seed' })
    const secondGame = createAvalonGame({ seed: 'replay-seed' })
    const first = Client({
      game: {
        ...firstGame,
        setup: (context) => firstGame.setup?.(context, setupData) as AvalonG,
      },
      numPlayers: 7,
      playerID: '0',
    })
    const second = Client({
      game: {
        ...secondGame,
        setup: (context) => secondGame.setup?.(context, setupData) as AvalonG,
      },
      numPlayers: 7,
      playerID: '0',
    })

    first.moves.startGame()
    second.moves.startGame()

    expect(getAuthoritativeGame(first).secret.roleByPlayer).toEqual(
      getAuthoritativeGame(second).secret.roleByPlayer,
    )
    expect(getAuthoritativeGame(first).leaderID).toBe(
      getAuthoritativeGame(second).leaderID,
    )
  })

  it('starts in the lobby with the start move available to every waiting seat', () => {
    const client = createLocalClient()
    const state = client.store.getState()

    expect(state.ctx.phase).toBe('lobby')
    expect(state.ctx.currentPlayer).toBe('0')
    expect(state.ctx.activePlayers).toEqual({
      '0': 'start',
      '1': 'start',
      '2': 'start',
      '3': 'start',
      '4': 'start',
    })
    expect(state.G.status).toBe('lobby')
  })

  it('starts only when the credentialed mover is the owner and every seat is occupied', () => {
    const client = createLocalClient(5, {
      ownerPlayerID: '3',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
      roleConfiguration: { percivalMorgana: true },
    })
    client.updatePlayerID('3')
    client.moves.startGame()
    expect(getAuthoritativeGame(client).status).toBe('playing')
  })

  it('rejects a non-owner and an owner with an empty seat', () => {
    const nonOwner = createLocalClient(5, {
      ownerPlayerID: '3',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
      roleConfiguration: { percivalMorgana: true },
    })
    const beforeNonOwnerMove = nonOwner.store.getState()._stateID
    nonOwner.moves.startGame()
    expect(nonOwner.store.getState()._stateID).toBe(beforeNonOwnerMove)

    const incomplete = createLocalClient(5, {
      ownerPlayerID: '3',
      occupiedPlayerIDs: ['0', '1', '2', '3'],
      roleConfiguration: { percivalMorgana: true },
    })
    incomplete.updatePlayerID('3')
    const beforeIncompleteMove = incomplete.store.getState()._stateID
    incomplete.moves.startGame()
    expect(incomplete.store.getState()._stateID).toBe(beforeIncompleteMove)
  })

  it('rejects a direct legacy lobby state without authoritative lobby data', () => {
    const game = createAvalonGame()
    const client = Client({
      game: {
        ...game,
        setup: (context) => {
          const initialGame = game.setup?.(context, {
            ownerPlayerID: '0',
            occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
          }) as AvalonG
          const { lobby: _lobby, ...legacyGame } = initialGame
          return legacyGame as AvalonG
        },
      },
      numPlayers: 5,
      playerID: '0',
    })
    const beforeMove = client.store.getState()._stateID

    client.moves.startGame()

    expect(client.store.getState()._stateID).toBe(beforeMove)
    expect((client.store.getState().G as AvalonG).status).toBe('lobby')
  })

  it('rejects a full lobby with a newer authority version without mutating it', () => {
    const game = createAvalonGame()
    const client = Client({
      game: {
        ...game,
        setup: (context) => {
          const initialGame = game.setup?.(context, {
            ownerPlayerID: '0',
            occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
          }) as AvalonG
          return {
            ...initialGame,
            lobby: {
              authorityVersion: 2,
              ownerPlayerID: '0',
              occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
            },
          } as unknown as AvalonG
        },
      },
      numPlayers: 5,
      playerID: '0',
    })
    const beforeMove = client.store.getState()._stateID
    const beforeGame = structuredClone(client.store.getState().G)

    client.moves.startGame()

    expect(client.store.getState()._stateID).toBe(beforeMove)
    expect(client.store.getState().G).toEqual(beforeGame)
  })

  it('keeps rooms without an explicit role configuration on the base roles', () => {
    const client = createLocalClient()
    client.moves.startGame()

    const game = getAuthoritativeGame(client)
    expect(game.rules.roleConfiguration).toEqual({ percivalMorgana: false })
    expect(Object.values(game.secret.roleByPlayer)).not.toContain('percival')
    expect(Object.values(game.secret.roleByPlayer)).not.toContain('morgana')
  })

  it('normalizes a persisted room without role configuration in the player view', () => {
    const client = createLocalClient()
    const game = getAuthoritativeGame(client)
    const legacyGame = {
      ...game,
      rules: { timeouts: game.rules.timeouts },
    } as AvalonG

    expect(getAvalonPlayerView(legacyGame, null).rules.roleConfiguration).toEqual({
      percivalMorgana: false,
    })
  })

  it('assigns roles and enters team proposal after identity recognition', () => {
    const client = createLocalClient()

    client.moves.startGame()
    completeIdentityRecognition(client)

    const state = client.store.getState()
    const game = state.G as AvalonG
    const assignedRoles = Object.values(game.secret.roleByPlayer)

    expect(state.ctx.phase).toBe('teamProposal')
    expect(game.status).toBe('playing')
    expect(game.leaderID).toBeTypeOf('string')
    expect(state.ctx.playOrder).toContain(game.leaderID)
    expect(state.ctx.currentPlayer).toBe(game.leaderID)
    expect(state.ctx.activePlayers).toEqual({
      [game.leaderID as string]: 'leader',
    })
    expect(assignedRoles).toHaveLength(5)
    expect(assignedRoles.filter((role) => loyaltyForRole(role) === 'good')).toHaveLength(3)
    expect(assignedRoles.filter((role) => loyaltyForRole(role) === 'evil')).toHaveLength(2)
  })

  it('filters role visibility by the observing player', () => {
    const client = createLocalClient()
    client.moves.startGame()
    completeIdentityRecognition(client)

    const game = getAuthoritativeGame(client)
    const roleByPlayer = game.secret.roleByPlayer
    const evilIDs = Object.entries(roleByPlayer)
      .filter(([, role]) => loyaltyForRole(role) === 'evil')
      .map(([playerID]) => playerID)
    const merlinID = Object.entries(roleByPlayer).find(
      ([, role]) => role === 'merlin',
    )?.[0]
    const evilID = evilIDs[0]
    const goodID = Object.entries(roleByPlayer).find(
      ([, role]) => loyaltyForRole(role) === 'good' && role !== 'merlin',
    )?.[0]

    expect(merlinID).toBeDefined()
    expect(evilID).toBeDefined()
    expect(goodID).toBeDefined()

    const merlinView = getAvalonPlayerView(game, merlinID ?? null)
    const evilView = getAvalonPlayerView(game, evilID ?? null)
    const goodView = getAvalonPlayerView(game, goodID ?? null)
    const anonymousView = getAvalonPlayerView(game, null)

    expect('secret' in merlinView).toBe(false)
    expect('secret' in evilView).toBe(false)
    expect('secret' in goodView).toBe(false)
    expect('secret' in anonymousView).toBe(false)

    expect(merlinView.viewer.role).toBe('merlin')
    expect(merlinView.viewer.loyalty).toBe('good')
    expect(merlinView.viewer.knownEvilPlayerIDs).toEqual(evilIDs)
    expect(merlinView.revealedRoles).toBeUndefined()

    expect(evilView.viewer.role).toBe(roleByPlayer[evilID ?? ''])
    expect(evilView.viewer.loyalty).toBe('evil')
    expect(evilView.viewer.knownEvilPlayerIDs).toEqual(
      evilIDs.filter((playerID) => playerID !== evilID),
    )
    expect(evilView.viewer.knownEvilRoles).toBeUndefined()

    expect(goodView.viewer.role).toBe(roleByPlayer[goodID ?? ''])
    expect(goodView.viewer.loyalty).toBe('good')
    expect(goodView.viewer.knownEvilPlayerIDs).toEqual([])
    expect(anonymousView.viewer.role).toBeNull()
    expect(anonymousView.viewer.knownEvilPlayerIDs).toEqual([])
  })

  it('shows exactly Merlin and Morgana to Percival after the Percival step begins', () => {
    const G = createRecognitionStateAt('percivalRecognition')
    const percivalID = Object.entries(G.secret.roleByPlayer)
      .find(([, role]) => role === 'percival')?.[0]
    expect(percivalID).toBeDefined()
    const view = getAvalonPlayerView(G, percivalID ?? null)
    expect(view.viewer.role).toBe('percival')
    const expectedCandidates = Object.entries(G.secret.roleByPlayer)
      .filter(([, role]) => role === 'merlin' || role === 'morgana')
      .map(([playerID]) => playerID)
      .sort()
    expect(view.viewer.knownMerlinCandidatePlayerIDs.sort()).toEqual(expectedCandidates)
    expect(view.viewer.knownEvilPlayerIDs).toEqual([])
  })

  it('does not send Percival candidates to any other role', () => {
    const G = createRecognitionStateAt('percivalRecognition')
    const loyalServantID = Object.entries(G.secret.roleByPlayer)
      .find(([, role]) => role === 'loyal_servant')?.[0]
    const view = getAvalonPlayerView(G, loyalServantID ?? null)
    expect(view.viewer.knownMerlinCandidatePlayerIDs).toEqual([])
  })

  it('withholds Merlin candidates from Percival before the Percival step', () => {
    const G = createRecognitionStateAt('merlinRecognition')
    const percivalID = Object.entries(G.secret.roleByPlayer)
      .find(([, role]) => role === 'percival')?.[0]

    expect(
      getAvalonPlayerView(G, percivalID ?? null).viewer
      .knownMerlinCandidatePlayerIDs,
    ).toEqual([])
  })

  it('keeps Merlin candidates available to Percival after recognition ends', () => {
    const client = createLocalClient(5, {
      ownerPlayerID: '0',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
      roleConfiguration: { percivalMorgana: true },
    })
    client.moves.startGame()
    completeIdentityRecognition(client)
    const game = getAuthoritativeGame(client)
    const percivalID = Object.entries(game.secret.roleByPlayer)
      .find(([, role]) => role === 'percival')?.[0]
    const expectedCandidates = Object.entries(game.secret.roleByPlayer)
      .filter(([, role]) => role === 'merlin' || role === 'morgana')
      .map(([playerID]) => playerID)
      .sort()

    expect(client.store.getState().ctx.phase).toBe('teamProposal')
    expect(
      getAvalonPlayerView(game, percivalID ?? null).viewer
        .knownMerlinCandidatePlayerIDs.sort(),
    ).toEqual(expectedCandidates)
  })
})
