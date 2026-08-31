import type { Server, StorageAPI } from 'boardgame.io'

import {
  hasAtomicLobbyStorage,
  type AtomicLobbyStorage,
  type LobbyMatchMutation,
  type LobbyMatchSnapshot,
} from './lobby-storage'

export interface MatchDeletionGuard {
  readonly unavailableMatchIDs: Set<string>
  markMatchDeleted(matchID: string): void
}

interface DeletionSafeStorage<TStorage> {
  storage: TStorage
  deletionGuard: MatchDeletionGuard
  forceUpdateMetadata(
    matchID: string,
    update: (metadata: Server.MatchData) => void,
  ): Server.MatchData | undefined | Promise<Server.MatchData | undefined>
}

function matchNotFound(matchID: string) {
  return new Error(`Match ${matchID} was not found`)
}

export interface DeletionSafeStorageOptions {
  prepareMetadata?: (metadata: Server.MatchData) => void
  getStaleMetadataError?: (
    currentMetadata: Server.MatchData,
    staleMetadata: Server.MatchData,
  ) => Error | undefined
}

interface MetadataVersion {
  matchID: string
  version: number
}

type VersionedMetadata = Server.MatchData & {
  [metadataVersionKey]?: MetadataVersion
}

// This symbol is enumerable so boardgame.io's `{ ...metadata }` game updates
// retain the version, while it remains absent from JSON responses.
const metadataVersionKey = Symbol('avalon.metadataVersion')

function getMetadataVersion(metadata: Server.MatchData): MetadataVersion | undefined {
  return (metadata as VersionedMetadata)[metadataVersionKey]
}

function cloneMetadata(
  metadata: Server.MatchData,
  matchID: string,
  version: number,
  prepareMetadata?: (metadata: Server.MatchData) => void,
): Server.MatchData {
  const clone = structuredClone(metadata) as VersionedMetadata
  prepareMetadata?.(clone)
  Object.defineProperty(clone, metadataVersionKey, {
    configurable: true,
    enumerable: true,
    value: Object.freeze({ matchID, version }),
    writable: false,
  })
  return clone
}

function hasCurrentMetadataVersion(
  matchID: string,
  metadata: Server.MatchData,
  metadataVersions: Map<string, number>,
) {
  const marker = getMetadataVersion(metadata)
  return (
    marker?.matchID === matchID &&
    marker.version === (metadataVersions.get(matchID) ?? 0)
  )
}

function versionFetchedMetadata<O extends StorageAPI.FetchOpts>(
  matchID: string,
  result: StorageAPI.FetchResult<O>,
  version: number,
  prepareMetadata?: (metadata: Server.MatchData) => void,
): StorageAPI.FetchResult<O> {
  const resultWithMetadata = result as StorageAPI.FetchResult<O> & {
    metadata?: Server.MatchData
  }
  if (resultWithMetadata.metadata === undefined) return result

  return {
    ...result,
    metadata: cloneMetadata(
      resultWithMetadata.metadata,
      matchID,
      version,
      prepareMetadata,
    ),
  } as StorageAPI.FetchResult<O>
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
  rawStorage: StorageAPI.Sync & AtomicLobbyStorage,
  options?: DeletionSafeStorageOptions,
): DeletionSafeStorage<StorageAPI.Sync & AtomicLobbyStorage>
export function createDeletionSafeStorage(
  rawStorage: StorageAPI.Async & AtomicLobbyStorage,
  options?: DeletionSafeStorageOptions,
): DeletionSafeStorage<StorageAPI.Async & AtomicLobbyStorage>
export function createDeletionSafeStorage(
  rawStorage: StorageAPI.Sync,
  options?: DeletionSafeStorageOptions,
): DeletionSafeStorage<StorageAPI.Sync>
export function createDeletionSafeStorage(
  rawStorage: StorageAPI.Async,
  options?: DeletionSafeStorageOptions,
): DeletionSafeStorage<StorageAPI.Async>
export function createDeletionSafeStorage(
  rawStorage: StorageAPI.Sync | StorageAPI.Async,
  options: DeletionSafeStorageOptions = {},
): DeletionSafeStorage<StorageAPI.Sync | StorageAPI.Async> {
  const unavailableMatchIDs = new Set<string>()
  const metadataVersions = new Map<string, number>()
  const metadataWriteQueues = new Map<string, Promise<void>>()
  const enqueueMetadataWrite = <T>(
    matchID: string,
    write: () => Promise<T>,
  ): Promise<T> => {
    const previousWrite = metadataWriteQueues.get(matchID) ?? Promise.resolve()
    const currentWrite = previousWrite.then(write)
    metadataWriteQueues.set(matchID, currentWrite.then(() => undefined, () => undefined))
    return currentWrite
  }
  const deletionGuard: MatchDeletionGuard = {
    unavailableMatchIDs,
    markMatchDeleted: (matchID) => unavailableMatchIDs.add(matchID),
  }

  if (rawStorage.type() === 0) {
    const syncStorage = rawStorage as StorageAPI.Sync
    const atomicStorage = hasAtomicLobbyStorage(rawStorage) ? rawStorage : undefined
    const forceUpdateMetadata = (
      matchID: string,
      update: (metadata: Server.MatchData) => void,
    ): Server.MatchData | undefined => {
      if (unavailableMatchIDs.has(matchID)) return undefined

      const version = metadataVersions.get(matchID) ?? 0
      const result = syncStorage.fetch(matchID, { metadata: true })
      if (unavailableMatchIDs.has(matchID) || result.metadata === undefined) {
        return undefined
      }

      const updatedMetadata = cloneMetadata(
        result.metadata,
        matchID,
        version,
        options.prepareMetadata,
      )
      update(updatedMetadata)
      const nextVersion = version + 1
      syncStorage.setMetadata(
        matchID,
        cloneMetadata(
          updatedMetadata,
          matchID,
          nextVersion,
          options.prepareMetadata,
        ),
      )
      metadataVersions.set(matchID, nextVersion)
      return cloneMetadata(
        updatedMetadata,
        matchID,
        nextVersion,
        options.prepareMetadata,
      )
    }
    const storage: StorageAPI.Sync & Partial<AtomicLobbyStorage> = {
      type: () => 0,
      connect: () => syncStorage.connect(),
      createMatch: (matchID, opts) => {
        if (unavailableMatchIDs.has(matchID)) return
        syncStorage.createMatch(matchID, {
          ...opts,
          metadata: cloneMetadata(
            opts.metadata,
            matchID,
            0,
            options.prepareMetadata,
          ),
        })
        metadataVersions.set(matchID, 0)
      },
      setState: (matchID, state, deltalog) => {
        if (!unavailableMatchIDs.has(matchID)) {
          syncStorage.setState(matchID, state, deltalog)
        }
      },
      setMetadata: (matchID, metadata) => {
        if (unavailableMatchIDs.has(matchID)) return
        if (!hasCurrentMetadataVersion(matchID, metadata, metadataVersions)) {
          const currentMetadata = syncStorage.fetch(
            matchID,
            { metadata: true },
          ).metadata
          if (currentMetadata !== undefined) {
            const staleError = options.getStaleMetadataError?.(
              currentMetadata,
              metadata,
            )
            if (staleError !== undefined) throw staleError
          }
          return
        }

        const version = metadataVersions.get(matchID) ?? 0
        syncStorage.setMetadata(
          matchID,
          cloneMetadata(metadata, matchID, version + 1, options.prepareMetadata),
        )
        metadataVersions.set(matchID, version + 1)
      },
      fetch: (matchID, opts) => {
        if (unavailableMatchIDs.has(matchID)) return emptyFetch(opts)
        const version = metadataVersions.get(matchID) ?? 0
        const result = syncStorage.fetch(matchID, opts)
        if (unavailableMatchIDs.has(matchID)) return emptyFetch(opts)
        return versionFetchedMetadata(
          matchID,
          result,
          version,
          options.prepareMetadata,
        )
      },
      wipe: (matchID) => {
        deletionGuard.markMatchDeleted(matchID)
        syncStorage.wipe(matchID)
      },
      listMatches: (opts) =>
        syncStorage.listMatches(opts).filter((matchID) => !unavailableMatchIDs.has(matchID)),
    }
    if (atomicStorage !== undefined) {
      storage.mutateLobbyMatch = <T>(
        matchID: string,
        mutate: (snapshot: LobbyMatchSnapshot) => LobbyMatchMutation<T>,
      ) => {
        if (unavailableMatchIDs.has(matchID)) {
          return Promise.reject(matchNotFound(matchID))
        }

        const version = metadataVersions.get(matchID) ?? 0
        const nextVersion = version + 1
        return atomicStorage.mutateLobbyMatch(matchID, (snapshot) => {
          if (unavailableMatchIDs.has(matchID)) throw matchNotFound(matchID)
          const next = mutate({
            state: snapshot.state,
            metadata: cloneMetadata(
              snapshot.metadata,
              matchID,
              version,
              options.prepareMetadata,
            ),
          })
          metadataVersions.set(matchID, nextVersion)
          return {
            ...next,
            metadata: cloneMetadata(
              next.metadata,
              matchID,
              nextVersion,
              options.prepareMetadata,
            ),
          }
        }).catch((error: unknown) => {
          if (metadataVersions.get(matchID) === nextVersion) {
            metadataVersions.set(matchID, version)
          }
          throw error
        })
      }
    }
    return { storage, deletionGuard, forceUpdateMetadata }
  }

  const asyncStorage = rawStorage as StorageAPI.Async
  const atomicStorage = hasAtomicLobbyStorage(rawStorage) ? rawStorage : undefined
  const forceUpdateMetadata = async (
    matchID: string,
    update: (metadata: Server.MatchData) => void,
  ): Promise<Server.MatchData | undefined> => {
    let updatedMetadata: Server.MatchData | undefined
    await enqueueMetadataWrite(matchID, async () => {
      const version = metadataVersions.get(matchID) ?? 0
      const wasUnavailable = unavailableMatchIDs.has(matchID)
      if (wasUnavailable) return

      const result = await asyncStorage.fetch(matchID, { metadata: true })
      if (unavailableMatchIDs.has(matchID) || result.metadata === undefined) {
        return
      }

      const currentMetadata = cloneMetadata(
        result.metadata,
        matchID,
        version,
        options.prepareMetadata,
      )
      update(currentMetadata)
      const nextVersion = version + 1
      await asyncStorage.setMetadata(
        matchID,
        cloneMetadata(
          currentMetadata,
          matchID,
          nextVersion,
          options.prepareMetadata,
        ),
      )
      metadataVersions.set(matchID, nextVersion)
      updatedMetadata = cloneMetadata(
        currentMetadata,
        matchID,
        nextVersion,
        options.prepareMetadata,
      )
    })
    return updatedMetadata
  }
  const storage: StorageAPI.Async & Partial<AtomicLobbyStorage> = {
    type: () => 1,
    connect: () => asyncStorage.connect(),
    createMatch: async (matchID, opts) => {
      if (unavailableMatchIDs.has(matchID)) return
      await asyncStorage.createMatch(matchID, {
        ...opts,
        metadata: cloneMetadata(
          opts.metadata,
          matchID,
          0,
          options.prepareMetadata,
        ),
      })
      metadataVersions.set(matchID, 0)
    },
    setState: async (matchID, state, deltalog) => {
      if (!unavailableMatchIDs.has(matchID)) {
        await asyncStorage.setState(matchID, state, deltalog)
      }
    },
    setMetadata: async (matchID, metadata) => {
      await enqueueMetadataWrite(matchID, async () => {
        if (unavailableMatchIDs.has(matchID)) return
        if (!hasCurrentMetadataVersion(matchID, metadata, metadataVersions)) {
          const currentMetadata = (
            await asyncStorage.fetch(matchID, { metadata: true })
          ).metadata
          if (currentMetadata !== undefined) {
            const staleError = options.getStaleMetadataError?.(
              currentMetadata,
              metadata,
            )
            if (staleError !== undefined) throw staleError
          }
          return
        }

        const version = metadataVersions.get(matchID) ?? 0
        await asyncStorage.setMetadata(
          matchID,
          cloneMetadata(
            metadata,
            matchID,
            version + 1,
            options.prepareMetadata,
          ),
        )
        metadataVersions.set(matchID, version + 1)
      })
    },
    fetch: async (matchID, opts) => {
      const version = metadataVersions.get(matchID) ?? 0
      const wasUnavailable = unavailableMatchIDs.has(matchID)
      if (wasUnavailable) return emptyFetch(opts)
      const result = await asyncStorage.fetch(matchID, opts)
      if (unavailableMatchIDs.has(matchID)) return emptyFetch(opts)
      return versionFetchedMetadata(
        matchID,
        result,
        version,
        options.prepareMetadata,
      )
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
  if (atomicStorage !== undefined) {
    storage.mutateLobbyMatch = <T>(
      matchID: string,
      mutate: (snapshot: LobbyMatchSnapshot) => LobbyMatchMutation<T>,
    ) => enqueueMetadataWrite(matchID, async () => {
      if (unavailableMatchIDs.has(matchID)) throw matchNotFound(matchID)

      const version = metadataVersions.get(matchID) ?? 0
      const nextVersion = version + 1
      const result = await atomicStorage.mutateLobbyMatch(matchID, (snapshot) => {
        if (unavailableMatchIDs.has(matchID)) throw matchNotFound(matchID)
        const next = mutate({
          state: snapshot.state,
          metadata: cloneMetadata(
            snapshot.metadata,
            matchID,
            version,
            options.prepareMetadata,
          ),
        })
        return {
          ...next,
          metadata: cloneMetadata(
            next.metadata,
            matchID,
            nextVersion,
            options.prepareMetadata,
          ),
        }
      })
      metadataVersions.set(matchID, nextVersion)
      return result
    })
  }
  return { storage, deletionGuard, forceUpdateMetadata }
}
