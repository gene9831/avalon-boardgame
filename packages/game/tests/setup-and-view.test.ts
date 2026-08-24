import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'

import { AvalonGame, createAvalonGame } from '../src/game'
import { getAvalonPlayerView } from '../src/player-view'
import type { AvalonG } from '../src/types'
import { loyaltyForRole } from '../src/roles'

function createLocalClient(numPlayers = 5) {
  return Client({
    game: AvalonGame,
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
        : Object.entries(game.secret.roleByPlayer)
          .filter(([, role]) => role === 'merlin')
          .map(([playerID]) => playerID)

    for (const playerID of participantIDs) {
      client.updatePlayerID(playerID)
      client.moves.confirmIdentityRecognition()
    }
  }
}

describe('Avalon setup and player views', () => {
  it('replays role assignment and initial leader from the same RNG seed', () => {
    const first = Client({
      game: createAvalonGame({ seed: 'replay-seed' }),
      numPlayers: 7,
      playerID: '0',
    })
    const second = Client({
      game: createAvalonGame({ seed: 'replay-seed' }),
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

  it('starts in the lobby with only seat 0 able to start', () => {
    const client = createLocalClient()
    const state = client.store.getState()

    expect(state.ctx.phase).toBe('lobby')
    expect(state.ctx.currentPlayer).toBe('0')
    expect(state.ctx.activePlayers).toEqual({ '0': 'start' })
    expect(state.G.status).toBe('lobby')
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
})
