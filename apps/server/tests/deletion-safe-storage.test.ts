import type { LogEntry, Server, State, StorageAPI } from 'boardgame.io'
import { describe, expect, it } from 'vitest'

import { createDeletionSafeStorage } from '../src/storage/deletion-safe'
import {
  hasAtomicLobbyStorage,
  type AtomicLobbyStorage,
} from '../src/storage/lobby-storage'
import { MemoryStorage } from '../src/storage/memory'

function createState(value: string): State {
  return {
    G: { value, status: 'lobby' },
    ctx: {
      numPlayers: 5,
      playOrder: ['0', '1', '2', '3', '4'],
      playOrderPos: 0,
      activePlayers: null,
      currentPlayer: '0',
      turn: 0,
      phase: 'lobby',
    },
    plugins: {},
    _undo: [],
    _redo: [],
    _stateID: 0,
  }
}

function createMetadata(createdAt: number, name: string): Server.MatchData {
  return {
    gameName: 'avalon',
    players: { 0: { id: 0, name, credentials: 'old-credential' } },
    createdAt,
    updatedAt: createdAt,
  }
}

const lateLogEntry = {
  action: { type: 'MAKE_MOVE', payload: { type: 'lateMove', args: [] } },
  _stateID: 1,
  turn: 0,
  phase: 'lobby',
} as unknown as LogEntry

function createControlledAsyncMemoryStorage() {
  const storage = new MemoryStorage()
  const pendingMetadataWrites: Array<() => void> = []
  const pendingMetadataFetches: Array<() => void> = []
  let deferNextMetadataWrite = false
  let deferNextMetadataFetch = false
  const asyncStorage: StorageAPI.Async & AtomicLobbyStorage = {
    type: () => 1,
    connect: async () => storage.connect(),
    createMatch: async (matchID, opts) => storage.createMatch(matchID, opts),
    setState: async (matchID, state, deltalog) => storage.setState(matchID, state, deltalog),
    setMetadata: async (matchID, metadata) => {
      if (!deferNextMetadataWrite) {
        storage.setMetadata(matchID, metadata)
        return
      }
      deferNextMetadataWrite = false
      await new Promise<void>((resolve) => {
        pendingMetadataWrites.push(() => {
          storage.setMetadata(matchID, metadata)
          resolve()
        })
      })
    },
    fetch: async (matchID, opts) => {
      const result = storage.fetch(matchID, opts)
      if (!deferNextMetadataFetch || !opts.metadata) return result
      deferNextMetadataFetch = false
      await new Promise<void>((resolve) => pendingMetadataFetches.push(resolve))
      return result
    },
    wipe: async (matchID) => storage.wipe(matchID),
    listMatches: async (opts) => storage.listMatches(opts),
    mutateLobbyMatch: (matchID, mutate) =>
      storage.mutateLobbyMatch(matchID, mutate),
  }
  return {
    storage: asyncStorage,
    deferNextMetadataWrite() {
      deferNextMetadataWrite = true
    },
    deferNextMetadataFetch() {
      deferNextMetadataFetch = true
    },
    get pendingMetadataWrites() {
      return pendingMetadataWrites.length
    },
    releaseNextMetadataWrite() {
      const release = pendingMetadataWrites.shift()
      if (release === undefined) throw new Error('no deferred metadata write')
      release()
    },
    releaseNextMetadataFetch() {
      const release = pendingMetadataFetches.shift()
      if (release === undefined) throw new Error('no deferred metadata fetch')
      release()
    },
  }
}

describe('deletion-safe storage', () => {
  it('commits lobby state and metadata together through the sync wrapper', async () => {
    const { storage } = createDeletionSafeStorage(new MemoryStorage())
    storage.createMatch('room-1', {
      initialState: createState('old'),
      metadata: createMetadata(100, 'Alice'),
    })

    expect(hasAtomicLobbyStorage(storage)).toBe(true)
    if (!hasAtomicLobbyStorage(storage)) throw new Error('atomic storage required')

    const result = await storage.mutateLobbyMatch(
      'room-1',
      ({ state, metadata }) => ({
        state: { ...state, G: { ...state.G, value: 'new' } },
        metadata: { ...metadata, updatedAt: 200 },
        result: 'committed',
      }),
    )

    expect(result).toBe('committed')
    expect(storage.fetch('room-1', { state: true, metadata: true })).toMatchObject({
      state: { G: { value: 'new' } },
      metadata: { updatedAt: 200 },
    })
  })

  it('rolls back lobby state and metadata when a sync mutation throws', async () => {
    const { storage } = createDeletionSafeStorage(new MemoryStorage())
    const originalState = createState('old')
    const originalMetadata = createMetadata(100, 'Alice')
    storage.createMatch('room-1', {
      initialState: originalState,
      metadata: originalMetadata,
    })

    if (!hasAtomicLobbyStorage(storage)) throw new Error('atomic storage required')
    await expect(storage.mutateLobbyMatch('room-1', ({ state, metadata }) => {
      ;(state.G as { value: string }).value = 'leaked'
      metadata.updatedAt = 200
      throw new Error('stop')
    })).rejects.toThrow('stop')

    expect(storage.fetch('room-1', { state: true, metadata: true })).toMatchObject({
      state: { G: { value: 'old' } },
      metadata: { updatedAt: 100 },
    })
  })

  it('blocks atomic lobby mutation after deletion', async () => {
    const { storage, deletionGuard } = createDeletionSafeStorage(new MemoryStorage())
    storage.createMatch('room-1', {
      initialState: createState('old'),
      metadata: createMetadata(100, 'Alice'),
    })
    deletionGuard.markMatchDeleted('room-1')
    storage.wipe('room-1')

    if (!hasAtomicLobbyStorage(storage)) throw new Error('atomic storage required')
    await expect(storage.mutateLobbyMatch('room-1', ({ state, metadata }) => ({
      state: { ...state, G: { ...state.G, value: 'replacement' } },
      metadata: { ...metadata, updatedAt: 200 },
      result: undefined,
    }))).rejects.toThrow('Match room-1 was not found')

    expect(storage.fetch('room-1', { state: true, metadata: true })).toEqual({
      state: undefined,
      metadata: undefined,
    })
  })

  it('preserves atomic lobby mutation through the async wrapper', async () => {
    const { storage } = createDeletionSafeStorage(
      createControlledAsyncMemoryStorage().storage,
    )
    await storage.createMatch('room-1', {
      initialState: createState('old'),
      metadata: createMetadata(100, 'Alice'),
    })

    expect(hasAtomicLobbyStorage(storage)).toBe(true)
    if (!hasAtomicLobbyStorage(storage)) throw new Error('atomic storage required')
    await expect(storage.mutateLobbyMatch('room-1', ({ state, metadata }) => ({
      state: { ...state, G: { ...state.G, value: 'new' } },
      metadata: { ...metadata, updatedAt: 200 },
      result: 42,
    }))).resolves.toBe(42)

    await expect(storage.fetch('room-1', {
      state: true,
      metadata: true,
    })).resolves.toMatchObject({
      state: { G: { value: 'new' } },
      metadata: { updatedAt: 200 },
    })
  })

  it('rejects a stale sync metadata snapshot after an accepted replacement write', () => {
    const rawStorage = new MemoryStorage()
    const { storage } = createDeletionSafeStorage(rawStorage)
    const initialMetadata = createMetadata(100, 'Alice')

    storage.createMatch('room-1', {
      initialState: createState('old'),
      metadata: initialMetadata,
    })
    const staleMetadata = storage.fetch('room-1', { metadata: true }).metadata
    const replacementMetadata = storage.fetch('room-1', { metadata: true }).metadata

    expect(staleMetadata).toBeDefined()
    expect(replacementMetadata).toBeDefined()
    expect(replacementMetadata).not.toBe(staleMetadata)

    replacementMetadata!.players[0].name = 'Bob'
    replacementMetadata!.players[0].credentials = 'new-credential'
    storage.setMetadata('room-1', replacementMetadata!)
    storage.setMetadata('room-1', staleMetadata!)

    expect(storage.fetch('room-1', { metadata: true }).metadata).toMatchObject({
      players: { 0: { name: 'Bob', credentials: 'new-credential' } },
    })
  })

  it('accepts a sync metadata snapshot derived with boardgame-style object spread', () => {
    const rawStorage = new MemoryStorage()
    const { storage } = createDeletionSafeStorage(rawStorage)

    storage.createMatch('room-1', {
      initialState: createState('old'),
      metadata: createMetadata(100, 'Alice'),
    })
    const currentMetadata = storage.fetch('room-1', { metadata: true }).metadata!
    const gameMetadata = { ...currentMetadata, updatedAt: 101 }

    storage.setMetadata('room-1', gameMetadata)

    expect(storage.fetch('room-1', { metadata: true }).metadata).toMatchObject({
      updatedAt: 101,
      players: { 0: { name: 'Alice' } },
    })
  })

  it('rejects a stale async metadata snapshot after an accepted replacement write', async () => {
    const deferredStorage = createControlledAsyncMemoryStorage()
    const { storage } = createDeletionSafeStorage(deferredStorage.storage)

    await storage.createMatch('room-1', {
      initialState: createState('old'),
      metadata: createMetadata(100, 'Alice'),
    })
    const staleMetadata = (await storage.fetch('room-1', { metadata: true })).metadata
    const replacementMetadata = (await storage.fetch('room-1', { metadata: true })).metadata

    expect(staleMetadata).toBeDefined()
    expect(replacementMetadata).toBeDefined()
    expect(replacementMetadata).not.toBe(staleMetadata)

    replacementMetadata!.players[0].name = 'Bob'
    replacementMetadata!.players[0].credentials = 'new-credential'
    deferredStorage.deferNextMetadataWrite()
    const replacementWrite = storage.setMetadata('room-1', replacementMetadata!)
    await Promise.resolve()
    const staleWrite = storage.setMetadata('room-1', staleMetadata!)
    await Promise.resolve()

    expect(deferredStorage.pendingMetadataWrites).toBe(1)
    deferredStorage.releaseNextMetadataWrite()
    await expect(replacementWrite).resolves.toBeUndefined()
    await expect(staleWrite).resolves.toBeUndefined()
    expect(deferredStorage.pendingMetadataWrites).toBe(0)

    await expect(storage.fetch('room-1', { metadata: true })).resolves.toMatchObject({
      metadata: { players: { 0: { name: 'Bob', credentials: 'new-credential' } } },
    })
  })

  it('binds a delayed async fetch to the version at fetch start', async () => {
    const delayedStorage = createControlledAsyncMemoryStorage()
    const { storage } = createDeletionSafeStorage(delayedStorage.storage)

    await storage.createMatch('room-1', {
      initialState: createState('old'),
      metadata: createMetadata(100, 'Alice'),
    })
    delayedStorage.deferNextMetadataFetch()
    const staleFetch = storage.fetch('room-1', { metadata: true })
    await Promise.resolve()

    const replacementMetadata = (await storage.fetch('room-1', { metadata: true })).metadata!
    replacementMetadata.players[0].name = 'Bob'
    replacementMetadata.players[0].credentials = 'new-credential'
    await storage.setMetadata('room-1', replacementMetadata)
    const currentMetadata = (await storage.fetch('room-1', { metadata: true })).metadata!
    currentMetadata.updatedAt = 102
    await storage.setMetadata('room-1', currentMetadata)

    delayedStorage.releaseNextMetadataFetch()
    const staleMetadata = (await staleFetch).metadata!
    expect(staleMetadata.players[0].name).toBe('Alice')
    expect(staleMetadata.players[0].credentials).toBe('old-credential')
    await storage.setMetadata('room-1', staleMetadata)

    await expect(storage.fetch('room-1', { metadata: true })).resolves.toMatchObject({
      metadata: { players: { 0: { name: 'Bob', credentials: 'new-credential' } } },
    })
  })

  it('suppresses late writes and permanently rejects reuse after deletion', () => {
    const rawStorage = new MemoryStorage()
    const { storage, deletionGuard } = createDeletionSafeStorage(rawStorage)
    const oldState = createState('old')
    const oldMetadata = createMetadata(100, 'Alice')
    const replacementState = createState('replacement')
    const replacementMetadata = createMetadata(200, 'Bob')

    storage.createMatch('room-1', { initialState: oldState, metadata: oldMetadata })
    deletionGuard.markMatchDeleted('room-1')
    storage.wipe('room-1')
    storage.setState('room-1', oldState, [lateLogEntry])
    storage.setMetadata('room-1', oldMetadata)

    expect(storage.fetch('room-1', { state: true, metadata: true, log: true })).toEqual({
      state: undefined,
      metadata: undefined,
      log: [],
    })
    expect(storage.listMatches({ gameName: 'avalon' })).toEqual([])

    storage.createMatch('room-1', {
      initialState: replacementState,
      metadata: replacementMetadata,
    })
    storage.setState('room-1', replacementState, [lateLogEntry])
    storage.setMetadata('room-1', replacementMetadata)

    expect(storage.fetch('room-1', { state: true, metadata: true, log: true })).toEqual({
      state: undefined,
      metadata: undefined,
      log: [],
    })
    expect(storage.listMatches({ gameName: 'avalon' })).toEqual([])
  })

  it('suppresses late writes for asynchronous storage adapters', async () => {
    const { storage, deletionGuard } = createDeletionSafeStorage(
      createControlledAsyncMemoryStorage().storage,
    )
    const state = createState('old')
    const metadata = createMetadata(100, 'Alice')

    await storage.createMatch('room-1', { initialState: state, metadata })
    deletionGuard.markMatchDeleted('room-1')
    await storage.wipe('room-1')
    await storage.setState('room-1', state, [lateLogEntry])
    await storage.setMetadata('room-1', metadata)
    await storage.createMatch('room-1', {
      initialState: createState('replacement'),
      metadata: createMetadata(200, 'Bob'),
    })

    await expect(storage.fetch('room-1', {
      state: true,
      metadata: true,
      log: true,
    })).resolves.toEqual({
      state: undefined,
      metadata: undefined,
      log: [],
    })
    await expect(storage.listMatches({ gameName: 'avalon' })).resolves.toEqual([])
  })
})
