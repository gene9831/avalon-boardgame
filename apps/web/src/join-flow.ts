import type {
  AvalonCreateRoomRequest,
  AvalonJoinRoomRequest,
  AvalonRoleConfiguration,
  AvalonRoomSessionResponse,
} from '@avalon/game'

import type { RoomSession } from './room-session'
import { createClientID } from './client-identity'
import { getPlayerNameValidationError } from './player-name'
import type { PlayerAvatarID } from './player-profile'

export type PendingJoin =
  | { type: 'create'; numPlayers: number; roleConfiguration: AvalonRoleConfiguration }
  | { type: 'join'; matchID: string }

export interface LobbyJoinClient {
  createRoomAndJoin: (
    request: AvalonCreateRoomRequest,
  ) => Promise<AvalonRoomSessionResponse>
  joinMatch: (
    gameName: 'avalon',
    matchID: string,
    request: AvalonJoinRoomRequest,
  ) => Promise<AvalonRoomSessionResponse>
}

export async function executePendingJoin(
  lobby: LobbyJoinClient,
  intent: PendingJoin,
  options: {
    avatarID: PlayerAvatarID
    clientID: string
    createSessionID?: () => string
    gameName: 'avalon'
    playerName: string
  },
): Promise<RoomSession> {
  const playerName = options.playerName.trim()
  const validationError = getPlayerNameValidationError(playerName)
  if (validationError !== null) throw new Error(validationError)
  const sessionID = options.createSessionID?.() ?? `join-${createClientID()}`

  const profile = {
    data: {
      avatarID: options.avatarID,
      clientID: options.clientID,
      sessionID,
    },
    playerName,
  }
  const joined = intent.type === 'create'
    ? await lobby.createRoomAndJoin({
      ...profile,
      numPlayers: intent.numPlayers,
      roleConfiguration: intent.roleConfiguration,
    })
    : await lobby.joinMatch(options.gameName, intent.matchID, profile)

  return {
    matchID: joined.matchID,
    playerID: joined.playerID,
    credentials: joined.playerCredentials,
    avatarID: options.avatarID,
    playerName,
    sessionID,
  }
}
