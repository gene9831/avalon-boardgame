import type { RoomSession } from './room-session'
import { createClientID } from './client-identity'
import { getPlayerNameValidationError } from './player-name'

export type PendingJoin =
  | { type: 'create'; numPlayers: number }
  | { type: 'join'; matchID: string; playerID: string }

export interface LobbyJoinClient {
  createMatch: (
    gameName: string,
    options: { numPlayers: number },
  ) => Promise<{ matchID: string }>
  joinMatch: (
    gameName: string,
    matchID: string,
    options: {
      data: { clientID: string; sessionID: string }
      playerID: string
      playerName: string
    },
  ) => Promise<{ playerID: string; playerCredentials: string }>
}

export async function executePendingJoin(
  lobby: LobbyJoinClient,
  intent: PendingJoin,
  options: {
    clientID: string
    createSessionID?: () => string
    gameName: string
    playerName: string
  },
): Promise<RoomSession> {
  const playerName = options.playerName.trim()
  const validationError = getPlayerNameValidationError(playerName)
  if (validationError !== null) throw new Error(validationError)
  const sessionID = options.createSessionID?.() ?? `join-${createClientID()}`

  let matchID: string
  let playerID: string

  if (intent.type === 'create') {
    const created = await lobby.createMatch(options.gameName, {
      numPlayers: intent.numPlayers,
    })
    matchID = created.matchID
    playerID = '0'
  } else {
    matchID = intent.matchID
    playerID = intent.playerID
  }

  const joined = await lobby.joinMatch(options.gameName, matchID, {
    data: { clientID: options.clientID, sessionID },
    playerID,
    playerName,
  })

  return {
    matchID,
    playerID: joined.playerID,
    credentials: joined.playerCredentials,
    playerName,
    sessionID,
  }
}
