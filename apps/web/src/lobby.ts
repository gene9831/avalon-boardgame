import { LobbyClient } from 'boardgame.io/client'
import type { AvalonCreateRoomRequest, AvalonJoinRoomRequest, AvalonRoomSessionResponse } from '@avalon/game'

import { webConfig } from './config'
import type { PlayerAvatarID } from './player-profile'

export const AVALON_GAME_NAME = 'avalon'

export interface LobbyPlayer {
  id: number
  name?: string
  isConnected?: boolean
  data?: {
    avatarID?: PlayerAvatarID
    clientID?: string
    sessionID?: string
    [key: string]: unknown
  }
}

export interface AvalonMatch {
  matchID: string
  gameName: string
  players: LobbyPlayer[]
  setupData?: {
    numPlayers?: number
  }
  ownerPlayerID: string | null
  occupiedPlayerIDs: string[]
  roleConfiguration: { percivalMorgana: boolean }
  gameover?: unknown
}

class LobbyRequestError extends Error {
  details: { error?: unknown }

  constructor(details: { error?: unknown }) {
    super('Lobby request failed')
    this.details = details
  }
}

export function createAvalonLobbyClient() {
  const client = new LobbyClient({ server: webConfig.lobbyURL })
  const request = async (path: string, body: unknown) => {
    const response = await fetch(`${webConfig.lobbyURL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result: unknown = await response.json()
    if (!response.ok) {
      throw new LobbyRequestError(
        typeof result === 'object' && result !== null
          ? result as { error?: unknown }
          : { error: result },
      )
    }
    return result as AvalonRoomSessionResponse
  }

  return {
    createRoomAndJoin: (requestBody: AvalonCreateRoomRequest) => request('/games/avalon/create', requestBody),
    getMatch: client.getMatch.bind(client),
    joinMatch: (_gameName: 'avalon', matchID: string, requestBody: AvalonJoinRoomRequest) =>
      request(`/games/avalon/${encodeURIComponent(matchID)}/join`, requestBody),
  }
}

export function getMatchPlayerCount(match: AvalonMatch) {
  const configuredCount = match.setupData?.numPlayers
  if (configuredCount !== undefined) return configuredCount
  return match.players.length
}

export function getOccupiedPlayerIDs(match: AvalonMatch) {
  return match.players
    .filter((player) => player.name !== undefined && player.name !== null)
    .map(({ id }) => String(id))
}

export function isMatchFull(match: AvalonMatch) {
  return getOccupiedPlayerIDs(match).length >= getMatchPlayerCount(match)
}
