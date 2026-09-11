import { describe, expect, it } from 'vitest'

import { buildLobbyPreviewState } from '../src/room-lobby-preview-model'

describe('buildLobbyPreviewState', () => {
  it.each([5, 6, 7, 8, 9, 10])('builds exactly %i public seats', (playerCount) => {
    const preview = buildLobbyPreviewState({
      scenarioID: 'member-incomplete', playerCount,
      reconnectMode: 'automatic', seatChangeTargetID: null, startPending: false,
    })

    expect(preview.room.players).toHaveLength(playerCount)
    expect(preview.room.ownerPlayerID).not.toBe(preview.currentPlayerID)
    expect(preview.room.players.some((player) => player.name != null && player.isConnected === false)).toBe(true)
    expect(preview.room.players.some((player) => player.name == null)).toBe(true)
    expect(preview.game.viewer.role).toBeNull()
    expect(preview.game.viewer.loyalty).toBeNull()
    expect(preview.game.revealedRoles).toBeUndefined()
  })

  it('uses the manual reconnect phase only on the disconnected scenario', () => {
    const preview = buildLobbyPreviewState({
      scenarioID: 'current-player-disconnected', playerCount: 5,
      reconnectMode: 'manual', seatChangeTargetID: null, startPending: false,
    })

    expect(preview.connected).toBe(false)
    expect(preview.manualReconnectAvailable).toBe(true)
  })

  it.each([
    ['member-incomplete', ['1']],
    ['owner-incomplete', ['1']],
    ['member-full', []],
    ['owner-full', []],
    ['current-player-disconnected', ['2']],
  ] as const)('uses the intended disconnected seats for %s', (scenarioID, expectedPlayerIDs) => {
    const preview = buildLobbyPreviewState({
      scenarioID, playerCount: 5,
      reconnectMode: 'automatic', seatChangeTargetID: null, startPending: false,
    })

    const disconnectedPlayerIDs = preview.room.players
      .filter((player) => player.name != null && player.isConnected === false)
      .map((player) => String(player.id))

    expect(disconnectedPlayerIDs).toEqual(expectedPlayerIDs)
  })
})
