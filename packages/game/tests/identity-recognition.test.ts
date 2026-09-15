import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'

import { createAvalonGame } from '../src/game'
import { getAvalonPlayerView } from '../src/player-view'
import { loyaltyForRole } from '../src/roles'
import type { AvalonG, PlayerID, Role } from '../src/types'

function createRecognitionClient() {
  const game = createAvalonGame({ seed: 'concurrent-recognition' })

  return Client({
    game: {
      ...game,
      setup: (context) => game.setup?.(context, {
        ownerPlayerID: '0',
        occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
        roleConfiguration: { percivalMorgana: false },
      }) as AvalonG,
    },
    numPlayers: 5,
    playerID: '0',
  })
}

function roleID(game: AvalonG, predicate: (role: Role) => boolean): PlayerID {
  const playerID = Object.entries(game.secret.roleByPlayer).find(([, role]) =>
    predicate(role),
  )?.[0]
  if (playerID === undefined) throw new Error('Expected assigned role was absent')
  return playerID
}

function confirm(
  client: ReturnType<typeof createRecognitionClient>,
  playerID: PlayerID,
) {
  client.updatePlayerID(playerID)
  client.moves.confirmIdentityRecognition()
}

describe('Avalon identity recognition', () => {
  it('starts every player in an independent identity-confirmation stage', () => {
    const client = createRecognitionClient()

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
      stage: 'identityConfirmation',
      completedCount: 0,
      participantCount: 5,
    })
    expect(game.secret.identityRecognitionStageByPlayerID).toEqual({
      '0': 'identityConfirmation',
      '1': 'identityConfirmation',
      '2': 'identityConfirmation',
      '3': 'identityConfirmation',
      '4': 'identityConfirmation',
    })
  })

  it('keeps every player behind the identity-confirmation barrier until all confirm', () => {
    const client = createRecognitionClient()
    client.moves.startGame()
    const initial = client.store.getState().G as AvalonG
    const merlinID = roleID(initial, (role) => role === 'merlin')
    const evilID = roleID(initial, (role) => loyaltyForRole(role) === 'evil')
    const servantIDs = Object.entries(initial.secret.roleByPlayer)
      .filter(([, role]) => role === 'loyal_servant')
      .map(([playerID]) => playerID)
    const [completeID, untouchedID] = servantIDs
    expect(completeID).toBeDefined()
    expect(untouchedID).toBeDefined()

    confirm(client, completeID)
    confirm(client, merlinID)
    confirm(client, evilID)

    const game = client.store.getState().G as AvalonG
    expect(game.secret.identityRecognitionStageByPlayerID[completeID]).toBe('waitingForClueRecognition')
    expect(game.secret.identityRecognitionStageByPlayerID[merlinID]).toBe('waitingForClueRecognition')
    expect(game.secret.identityRecognitionStageByPlayerID[evilID]).toBe('waitingForClueRecognition')
    expect(game.secret.identityRecognitionStageByPlayerID[untouchedID]).toBe('identityConfirmation')
    expect(game.identityRecognition).toEqual({
      stage: 'identityConfirmation',
      completedCount: 3,
      participantCount: 5,
    })
    expect(getAvalonPlayerView(game, merlinID).viewer.knownEvilPlayerIDs).toEqual([])
    expect(getAvalonPlayerView(game, evilID).viewer.knownEvilPlayerIDs).toEqual([])
  })

  it('opens clue recognition for every clue role only after the last identity confirmation', () => {
    const client = createRecognitionClient()
    client.moves.startGame()
    const initial = client.store.getState().G as AvalonG
    const merlinID = roleID(initial, (role) => role === 'merlin')

    confirm(client, merlinID)
    let game = client.store.getState().G as AvalonG
    expect(game.secret.identityRecognitionStageByPlayerID[merlinID]).toBe('waitingForClueRecognition')
    expect(game.identityRecognition).toEqual({
      stage: 'identityConfirmation', completedCount: 1, participantCount: 5,
    })

    const stateIDBeforeDuplicateIdentity = client.store.getState()._stateID
    confirm(client, merlinID)
    expect(client.store.getState()._stateID).toBe(stateIDBeforeDuplicateIdentity)

    for (const playerID of client.store.getState().ctx.playOrder) {
      if (playerID !== merlinID) confirm(client, playerID)
    }
    game = client.store.getState().G as AvalonG
    const cluePlayerIDs = Object.entries(game.secret.roleByPlayer)
      .filter(([, role]) => role === 'merlin' || loyaltyForRole(role) === 'evil')
      .map(([playerID]) => playerID)
    expect(game.identityRecognition).toEqual({
      stage: 'clueRecognition', completedCount: 0,
      participantCount: cluePlayerIDs.length,
    })
    for (const playerID of client.store.getState().ctx.playOrder) {
      expect(game.secret.identityRecognitionStageByPlayerID[playerID]).toBe(
        cluePlayerIDs.includes(playerID) ? 'clueRecognition' : 'complete',
      )
    }

    confirm(client, merlinID)
    game = client.store.getState().G as AvalonG
    expect(game.secret.identityRecognitionStageByPlayerID[merlinID]).toBe('complete')
    expect(game.identityRecognition?.completedCount).toBe(1)

    const stateIDBeforeDuplicate = client.store.getState()._stateID
    confirm(client, merlinID)
    expect(client.store.getState()._stateID).toBe(stateIDBeforeDuplicate)
    expect((client.store.getState().G as AvalonG).identityRecognition?.completedCount).toBe(1)
  })

  it('advances atomically after all clue participants complete in parallel', () => {
    const client = createRecognitionClient()
    client.moves.startGame()
    const playerIDs = client.store.getState().ctx.playOrder

    for (const playerID of playerIDs) confirm(client, playerID)

    let game = client.store.getState().G as AvalonG
    expect(client.store.getState().ctx.phase).toBe('identityRecognition')
    expect(game.identityRecognition?.stage).toBe('clueRecognition')
    expect(game.identityRecognition?.completedCount).toBe(0)

    for (const playerID of playerIDs) {
      if (game.secret.identityRecognitionStageByPlayerID[playerID] === 'clueRecognition') {
        confirm(client, playerID)
        game = client.store.getState().G as AvalonG
      }
    }

    expect(client.store.getState().ctx.phase).toBe('teamProposal')
    expect(game.identityRecognition).toBeNull()
    expect(client.store.getState().ctx.activePlayers).toEqual({
      [game.leaderID as string]: 'leader',
    })
  })

  it('releases viewer knowledge only after the room enters clue recognition', () => {
    const client = createRecognitionClient()
    client.moves.startGame()
    let game = client.store.getState().G as AvalonG
    const merlinID = roleID(game, (role) => role === 'merlin')
    const evilID = roleID(game, (role) => loyaltyForRole(role) === 'evil')
    const servantID = roleID(game, (role) => role === 'loyal_servant')

    expect(getAvalonPlayerView(game, merlinID).viewer.knownEvilPlayerIDs).toEqual([])
    expect(getAvalonPlayerView(game, evilID).viewer.knownEvilPlayerIDs).toEqual([])
    expect(getAvalonPlayerView(game, servantID).viewer.identityRecognition).toEqual({
      personalStage: 'identityConfirmation',
    })

    confirm(client, merlinID)
    confirm(client, evilID)
    confirm(client, servantID)
    game = client.store.getState().G as AvalonG

    expect(getAvalonPlayerView(game, merlinID).viewer.knownEvilPlayerIDs).toEqual([])
    expect(getAvalonPlayerView(game, evilID).viewer.knownEvilPlayerIDs).toEqual([])
    expect(getAvalonPlayerView(game, servantID).viewer.identityRecognition).toEqual({
      personalStage: 'waitingForClueRecognition',
    })

    for (const playerID of client.store.getState().ctx.playOrder) {
      if (
        game.secret.identityRecognitionStageByPlayerID[playerID] ===
        'identityConfirmation'
      ) confirm(client, playerID)
    }
    game = client.store.getState().G as AvalonG

    const evilIDs = Object.entries(game.secret.roleByPlayer)
      .filter(([, role]) => loyaltyForRole(role) === 'evil')
      .map(([playerID]) => playerID)
    expect(getAvalonPlayerView(game, merlinID).viewer.knownEvilPlayerIDs).toEqual(evilIDs)
    expect(getAvalonPlayerView(game, evilID).viewer.knownEvilPlayerIDs).toEqual(
      evilIDs.filter((playerID) => playerID !== evilID),
    )
    expect(getAvalonPlayerView(game, servantID).viewer.identityRecognition).toEqual({
      personalStage: 'complete',
    })
    expect('identityRecognitionStageByPlayerID' in getAvalonPlayerView(game, servantID)).toBe(false)
  })

  it('omits identity-recognition actors from the public game log', () => {
    const client = createRecognitionClient()
    client.moves.startGame()
    confirm(client, '0')

    const actionTypes = (client.store.getState().deltalog ?? []).map(
      (entry) => entry.action.payload.type,
    )
    expect(actionTypes).toEqual([])
  })
})
