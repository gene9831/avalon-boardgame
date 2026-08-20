import type { StorageAPI } from 'boardgame.io'

export interface MatchDeletionGuard {
  readonly unavailableMatchIDs: Set<string>
  markMatchDeleted(matchID: string): void
}

interface DeletionSafeStorage<TStorage> {
  storage: TStorage
  deletionGuard: MatchDeletionGuard
}

function emptyFetch<O extends StorageAPI.FetchOpts>(opts: O): StorageAPI.FetchResult<O> {
  const result = {} as StorageAPI.FetchFields
  if (opts.state) result.state = undefined as unknown as StorageAPI.FetchFields['state']
  if (opts.initialState) {
    result.initialState = undefined as unknown as StorageAPI.FetchFields['initialState']
  }
  if (opts.metadata) {
    result.metadata = undefined as unknown as StorageAPI.FetchFields['metadata']
  }
  if (opts.log) result.log = []
  return result as StorageAPI.FetchResult<O>
}

export function createDeletionSafeStorage(
  rawStorage: StorageAPI.Sync,
): DeletionSafeStorage<StorageAPI.Sync>
export function createDeletionSafeStorage(
  rawStorage: StorageAPI.Async,
): DeletionSafeStorage<StorageAPI.Async>
export function createDeletionSafeStorage(
  rawStorage: StorageAPI.Sync | StorageAPI.Async,
): DeletionSafeStorage<StorageAPI.Sync | StorageAPI.Async> {
  const unavailableMatchIDs = new Set<string>()
  const deletionGuard: MatchDeletionGuard = {
    unavailableMatchIDs,
    markMatchDeleted: (matchID) => unavailableMatchIDs.add(matchID),
  }

  if (rawStorage.type() === 0) {
    const syncStorage = rawStorage as StorageAPI.Sync
    const storage: StorageAPI.Sync = {
      type: () => 0,
      connect: () => syncStorage.connect(),
      createMatch: (matchID, opts) => {
        if (!unavailableMatchIDs.has(matchID)) syncStorage.createMatch(matchID, opts)
      },
      setState: (matchID, state, deltalog) => {
        if (!unavailableMatchIDs.has(matchID)) {
          syncStorage.setState(matchID, state, deltalog)
        }
      },
      setMetadata: (matchID, metadata) => {
        if (!unavailableMatchIDs.has(matchID)) {
          syncStorage.setMetadata(matchID, metadata)
        }
      },
      fetch: (matchID, opts) => {
        if (unavailableMatchIDs.has(matchID)) return emptyFetch(opts)
        return syncStorage.fetch(matchID, opts)
      },
      wipe: (matchID) => {
        deletionGuard.markMatchDeleted(matchID)
        syncStorage.wipe(matchID)
      },
      listMatches: (opts) =>
        syncStorage.listMatches(opts).filter((matchID) => !unavailableMatchIDs.has(matchID)),
    }
    return { storage, deletionGuard }
  }

  const asyncStorage = rawStorage as StorageAPI.Async
  const storage: StorageAPI.Async = {
    type: () => 1,
    connect: () => asyncStorage.connect(),
    createMatch: async (matchID, opts) => {
      if (!unavailableMatchIDs.has(matchID)) await asyncStorage.createMatch(matchID, opts)
    },
    setState: async (matchID, state, deltalog) => {
      if (!unavailableMatchIDs.has(matchID)) {
        await asyncStorage.setState(matchID, state, deltalog)
      }
    },
    setMetadata: async (matchID, metadata) => {
      if (!unavailableMatchIDs.has(matchID)) {
        await asyncStorage.setMetadata(matchID, metadata)
      }
    },
    fetch: async (matchID, opts) => {
      if (unavailableMatchIDs.has(matchID)) return emptyFetch(opts)
      return asyncStorage.fetch(matchID, opts)
    },
    wipe: async (matchID) => {
      deletionGuard.markMatchDeleted(matchID)
      await asyncStorage.wipe(matchID)
    },
    listMatches: async (opts) => {
      const matchIDs = await asyncStorage.listMatches(opts)
      return matchIDs.filter((matchID) => !unavailableMatchIDs.has(matchID))
    },
  }
  return { storage, deletionGuard }
}
