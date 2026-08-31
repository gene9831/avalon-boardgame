import type { Server, State } from 'boardgame.io'

export interface LobbyMatchSnapshot {
  state: State
  metadata: Server.MatchData
}

export interface LobbyMatchMutation<T> extends LobbyMatchSnapshot {
  result: T
}

export interface AtomicLobbyStorage {
  mutateLobbyMatch<T>(
    matchID: string,
    mutate: (snapshot: LobbyMatchSnapshot) => LobbyMatchMutation<T>,
  ): Promise<T>
}

export function hasAtomicLobbyStorage(value: unknown): value is AtomicLobbyStorage {
  return typeof (value as Partial<AtomicLobbyStorage> | null)?.mutateLobbyMatch === 'function'
}
