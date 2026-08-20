import { LobbyClient } from 'boardgame.io/client'

import { webConfig } from './config'

export const AVALON_GAME_NAME = 'avalon'

export interface LobbyPlayer {
  id: number
  name?: string
  isConnected?: boolean
  data?: {
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
  gameover?: unknown
}

export function createAvalonLobbyClient() {
  return new LobbyClient({ server: webConfig.lobbyURL })
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
