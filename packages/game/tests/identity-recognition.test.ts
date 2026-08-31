import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'

import { createAvalonGame } from '../src/game'
import { getAvalonPlayerView } from '../src/player-view'
import { loyaltyForRole } from '../src/roles'
import type { AvalonG } from '../src/types'

function createRecognitionClient(
  now: () => number,
  identityRecognitionDeadlineEnabled = false,
) {
  const game = createAvalonGame({
    identityRecognitionDeadlineEnabled,
    identityRecognitionStepMs: 10_000,
    now,
    serverInstanceID: 'server-one',
  })

  return Client({
    game: {
      ...game,
      setup: (context) => game.setup?.(context, {
        ownerPlayerID: '0',
        occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
      }) as AvalonG,
    },
    numPlayers: 5,
    playerID: '0',
  })
}

function confirmPlayers(
  client: ReturnType<typeof createRecognitionClient>,
  playerIDs: readonly string[],
) {
  for (const playerID of playerIDs) {
    client.updatePlayerID(playerID)
    client.moves.confirmIdentityRecognition()
  }
}

describe('Avalon identity recognition', () => {
  it('enters a timed identity reveal before the first team proposal', () => {
    const client = createRecognitionClient(() => 1_000)

    client.moves.startGame()

    const state = client.store.getState()
    const game = state.G as AvalonG
    expect(state.ctx.phase).toBe('identityRecognition')
    expect(state.ctx.activePlayers).toEqual({
      '0': 'identityRecognition',
      '1': 'identityRecognition',
      '2': 'identityRecognition',
      '3': 'identityRecognition',
      '4': 'identityRecognition',
    })
    expect(game.identityRecognition).toEqual({
      step: 'roleReveal',
      deadlineAt: 11_000,
      confirmedCount: 0,
      participantCount: 5,
    })
  })

  it('withholds recognition knowledge until the matching step', () => {
    const client = createRecognitionClient(() => 1_000)
    client.moves.startGame()

    const game = client.store.getState().G as AvalonG
    const merlinID = Object.entries(game.secret.roleByPlayer).find(
      ([, role]) => role === 'merlin',
    )?.[0]
    const evilID = Object.entries(game.secret.roleByPlayer).find(
      ([, role]) => loyaltyForRole(role) === 'evil',
    )?.[0]

    expect(merlinID).toBeDefined()
    expect(evilID).toBeDefined()

    const merlinView = getAvalonPlayerView(game, merlinID ?? null)
    const evilView = getAvalonPlayerView(game, evilID ?? null)
    expect(merlinView.viewer.role).toBe('merlin')
    expect(merlinView.viewer.knownEvilPlayerIDs).toEqual([])
    expect(evilView.viewer.knownEvilPlayerIDs).toEqual([])
    expect(merlinView.viewer.identityRecognition).toEqual({
      isParticipant: true,
      confirmed: false,
      deadlineRefreshRequired: false,
      serverNow: expect.any(Number),
    })
    expect(
      getAvalonPlayerView(game, merlinID ?? null, 'server-one').viewer
        .identityRecognition?.deadlineRefreshRequired,
    ).toBe(false)
    expect(
      getAvalonPlayerView(
        game,
        merlinID ?? null,
        'server-two',
        1_000,
        true,
      ).viewer
        .identityRecognition?.deadlineRefreshRequired,
    ).toBe(true)
  })

  it('advances early after every participant confirms the current step', () => {
    const client = createRecognitionClient(() => 1_000)
    client.moves.startGame()

    expect(client.moves.confirmIdentityRecognition).toBeTypeOf('function')

    for (const playerID of ['0', '1', '2', '3']) {
      client.updatePlayerID(playerID)
      client.moves.confirmIdentityRecognition()
    }

    let game = client.store.getState().G as AvalonG
    expect(client.store.getState().ctx.phase).toBe('identityRecognition')
    expect(game.identityRecognition).toEqual({
      step: 'roleReveal',
      deadlineAt: 11_000,
      confirmedCount: 4,
      participantCount: 5,
    })
    expect(
      getAvalonPlayerView(game, '3').viewer.identityRecognition,
    ).toEqual({
      isParticipant: true,
      confirmed: true,
      deadlineRefreshRequired: false,
      serverNow: expect.any(Number),
    })
    expect(
      getAvalonPlayerView(game, '4').viewer.identityRecognition,
    ).toEqual({
      isParticipant: true,
      confirmed: false,
      deadlineRefreshRequired: false,
      serverNow: expect.any(Number),
    })

    client.updatePlayerID('4')
    client.moves.confirmIdentityRecognition()

    game = client.store.getState().G as AvalonG
    expect(client.store.getState().ctx.phase).toBe('identityRecognition')
    expect(game.identityRecognition).toEqual({
      step: 'evilRecognition',
      deadlineAt: 11_000,
      confirmedCount: 0,
      participantCount: 2,
    })
  })

  it('uses the rule-defined Evil and Merlin participant groups', () => {
    const client = createRecognitionClient(() => 1_000)
    client.moves.startGame()
    const playerIDs = client.store.getState().ctx.playOrder
    confirmPlayers(client, playerIDs)

    let game = client.store.getState().G as AvalonG
    const evilIDs = Object.entries(game.secret.roleByPlayer)
      .filter(([, role]) => loyaltyForRole(role) === 'evil')
      .map(([playerID]) => playerID)
    const merlinID = Object.entries(game.secret.roleByPlayer).find(
      ([, role]) => role === 'merlin',
    )?.[0]
    const ordinaryGoodID = Object.entries(game.secret.roleByPlayer).find(
      ([, role]) => role === 'loyal_servant',
    )?.[0]
    expect(merlinID).toBeDefined()
    expect(ordinaryGoodID).toBeDefined()

    expect(
      getAvalonPlayerView(game, evilIDs[0]).viewer.knownEvilPlayerIDs,
    ).toEqual(evilIDs.filter((playerID) => playerID !== evilIDs[0]))
    expect(
      getAvalonPlayerView(game, merlinID ?? null).viewer.knownEvilPlayerIDs,
    ).toEqual([])
    expect(
      getAvalonPlayerView(game, ordinaryGoodID ?? null).viewer
        .identityRecognition,
    ).toEqual({
      isParticipant: false,
      confirmed: false,
      deadlineRefreshRequired: false,
      serverNow: expect.any(Number),
    })

    client.updatePlayerID(ordinaryGoodID ?? '')
    const stateIDBeforeInvalidConfirmation = client.store.getState()._stateID
    client.moves.confirmIdentityRecognition()
    expect(client.store.getState()._stateID).toBe(
      stateIDBeforeInvalidConfirmation,
    )

    confirmPlayers(client, evilIDs)
    game = client.store.getState().G as AvalonG
    expect(game.identityRecognition).toEqual({
      step: 'merlinRecognition',
      deadlineAt: 11_000,
      confirmedCount: 0,
      participantCount: 1,
    })
    expect(
      getAvalonPlayerView(game, merlinID ?? null).viewer.knownEvilPlayerIDs,
    ).toEqual(evilIDs)

    confirmPlayers(client, [merlinID ?? ''])
    game = client.store.getState().G as AvalonG
    expect(client.store.getState().ctx.phase).toBe('teamProposal')
    expect(client.store.getState().ctx.activePlayers).toEqual({
      [game.leaderID as string]: 'leader',
    })
    expect(game.identityRecognition).toBeNull()
    expect(
      getAvalonPlayerView(game, merlinID ?? null).viewer.knownEvilPlayerIDs,
    ).toEqual(evilIDs)
  })

  it('advances at the server deadline without waiting for confirmations', () => {
    let now = 1_000
    const client = createRecognitionClient(() => now, true)
    client.moves.startGame()

    expect(client.moves.advanceIdentityRecognition).toBeTypeOf('function')

    const stateIDBeforeDeadline = client.store.getState()._stateID
    client.moves.advanceIdentityRecognition('roleReveal', 11_000)
    expect(client.store.getState()._stateID).toBe(stateIDBeforeDeadline)

    now = 11_000
    client.moves.advanceIdentityRecognition('roleReveal', 11_000)
    let game = client.store.getState().G as AvalonG
    expect(game.identityRecognition).toEqual({
      step: 'evilRecognition',
      deadlineAt: 21_000,
      confirmedCount: 0,
      participantCount: 2,
    })

    now = 21_000
    client.moves.advanceIdentityRecognition('evilRecognition', 21_000)
    game = client.store.getState().G as AvalonG
    expect(game.identityRecognition?.step).toBe('merlinRecognition')

    now = 31_000
    client.moves.advanceIdentityRecognition('merlinRecognition', 31_000)
    expect(client.store.getState().ctx.phase).toBe('teamProposal')
  })

  it('catches up expired steps on the original timeline after reconnect', () => {
    let now = 1_000
    const client = createRecognitionClient(() => now, true)
    client.moves.startGame()

    now = 31_000
    client.moves.advanceIdentityRecognition('roleReveal', 11_000)
    expect(
      (client.store.getState().G as AvalonG).identityRecognition?.deadlineAt,
    ).toBe(21_000)

    client.moves.advanceIdentityRecognition('evilRecognition', 21_000)
    expect(
      (client.store.getState().G as AvalonG).identityRecognition?.deadlineAt,
    ).toBe(31_000)

    client.moves.advanceIdentityRecognition('merlinRecognition', 31_000)
    expect(client.store.getState().ctx.phase).toBe('teamProposal')
  })

  it('advances an expired step on its original timeline without counting a late confirmation', () => {
    let now = 1_000
    const client = createRecognitionClient(() => now, true)
    client.moves.startGame()

    now = 12_000
    client.updatePlayerID('0')
    client.moves.confirmIdentityRecognition()

    const game = client.store.getState().G as AvalonG
    expect(game.identityRecognition).toEqual({
      step: 'evilRecognition',
      deadlineAt: 21_000,
      confirmedCount: 0,
      participantCount: 2,
    })
    expect(game.secret.identityRecognitionConfirmedPlayerIDs).toEqual([])
  })

  it('waits for confirmations when the identity deadline is disabled by default', () => {
    let now = 1_000
    const client = createRecognitionClient(() => now)
    client.moves.startGame()

    now = 12_000
    client.updatePlayerID('0')
    client.moves.confirmIdentityRecognition()

    let game = client.store.getState().G as AvalonG
    expect(game.identityRecognition).toEqual({
      step: 'roleReveal',
      deadlineAt: 11_000,
      confirmedCount: 1,
      participantCount: 5,
    })

    const stateIDBeforeWake = client.store.getState()._stateID
    client.moves.advanceIdentityRecognition('roleReveal', 11_000)
    game = client.store.getState().G as AvalonG
    expect(client.store.getState()._stateID).toBe(stateIDBeforeWake)
    expect(game.identityRecognition?.step).toBe('roleReveal')
  })

  it('omits secret identity-recognition actors from the game log', () => {
    const client = createRecognitionClient(() => 1_000)
    client.moves.startGame()
    confirmPlayers(client, client.store.getState().ctx.playOrder)

    const game = client.store.getState().G as AvalonG
    const evilID = Object.entries(game.secret.roleByPlayer).find(
      ([, role]) => loyaltyForRole(role) === 'evil',
    )?.[0]
    client.updatePlayerID(evilID ?? '')
    client.moves.confirmIdentityRecognition()

    const actionTypes = (client.store.getState().deltalog ?? []).map(
      (entry) => entry.action.payload.type,
    )
    expect(actionTypes).toEqual([])
  })
})
