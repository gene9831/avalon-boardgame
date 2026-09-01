import type { LogEntry, Server, State, StorageAPI } from 'boardgame.io'

import type {
  AtomicLobbyStorage,
  LobbyMatchMutation,
  LobbyMatchSnapshot,
} from './lobby-storage'

function matchNotFound(matchID: string) {
  return new Error(`Match ${matchID} was not found`)
}

export class MemoryStorage implements StorageAPI.Sync, AtomicLobbyStorage {
  private readonly state = new Map<string, State>()
  private readonly initial = new Map<string, State>()
  private readonly metadata = new Map<string, Server.MatchData>()
  private readonly log = new Map<string, LogEntry[]>()

  type(): 0 {
    return 0
  }

  connect() {
    return undefined
  }

  createMatch(matchID: string, opts: StorageAPI.CreateMatchOpts) {
    this.initial.set(matchID, opts.initialState)
    this.setState(matchID, opts.initialState)
    this.setMetadata(matchID, opts.metadata)
  }

  setState(matchID: string, state: State, deltalog?: LogEntry[]) {
    if (deltalog && deltalog.length > 0) {
      const previousLog = this.log.get(matchID) ?? []
      this.log.set(matchID, [...previousLog, ...deltalog])
    }
    this.state.set(matchID, state)
  }

  setMetadata(matchID: string, metadata: Server.MatchData) {
    this.metadata.set(matchID, metadata)
  }

  mutateLobbyMatch<T>(
    matchID: string,
    mutate: (snapshot: LobbyMatchSnapshot) => LobbyMatchMutation<T>,
  ): Promise<T> {
    const state = this.state.get(matchID)
    const metadata = this.metadata.get(matchID)
    if (state === undefined || metadata === undefined) {
      return Promise.reject(matchNotFound(matchID))
    }

    let next: LobbyMatchMutation<T>
    try {
      next = mutate({
        state: structuredClone(state),
        metadata: structuredClone(metadata),
      })
    } catch (error) {
      return Promise.reject(error)
    }

    this.state.set(matchID, next.state)
    this.metadata.set(matchID, next.metadata)
    return Promise.resolve(next.result)
  }

  fetch<O extends StorageAPI.FetchOpts>(
    matchID: string,
    opts: O,
  ): StorageAPI.FetchResult<O> {
    const result = {} as StorageAPI.FetchFields

    if (opts.state) result.state = this.state.get(matchID) as State
    if (opts.log) result.log = this.log.get(matchID) ?? []
    if (opts.metadata) result.metadata = this.metadata.get(matchID) as Server.MatchData
    if (opts.initialState) result.initialState = this.initial.get(matchID) as State

    return result as StorageAPI.FetchResult<O>
  }

  wipe(matchID: string) {
    this.state.delete(matchID)
    this.initial.delete(matchID)
    this.metadata.delete(matchID)
    this.log.delete(matchID)
  }

  listMatches(opts?: StorageAPI.ListMatchesOpts) {
    return [...this.metadata.entries()]
      .filter(([, metadata]) => {
        if (opts?.gameName !== undefined && metadata.gameName !== opts.gameName) {
          return false
        }

        const where = opts?.where
        if (where?.isGameover !== undefined) {
          const isGameover = metadata.gameover !== undefined
          if (isGameover !== where.isGameover) return false
        }
        if (where?.updatedBefore !== undefined && metadata.updatedAt >= where.updatedBefore) {
          return false
        }
        if (where?.updatedAfter !== undefined && metadata.updatedAt <= where.updatedAfter) {
          return false
        }

        return true
      })
      .map(([matchID]) => matchID)
  }
}
