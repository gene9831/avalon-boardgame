import type { RoomSession } from './room-session'

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
      data: { clientID: string }
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
    gameName: string
    playerName: string
  },
): Promise<RoomSession> {
  const playerName = options.playerName.trim()
  if (playerName.length === 0) {
    throw new Error('玩家名称不能为空')
  }

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
    data: { clientID: options.clientID },
    playerID,
    playerName,
  })

  return {
    matchID,
    playerID: joined.playerID,
    credentials: joined.playerCredentials,
    playerName,
  }
}
