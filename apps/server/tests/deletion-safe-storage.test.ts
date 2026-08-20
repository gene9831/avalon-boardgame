import type { LogEntry, Server, State, StorageAPI } from 'boardgame.io'
import { describe, expect, it } from 'vitest'

import { createDeletionSafeStorage } from '../src/storage/deletion-safe'
import { MemoryStorage } from '../src/storage/memory'

function createState(value: string): State {
  return {
    G: { value },
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
    players: { 0: { id: 0, name } },
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

function createAsyncMemoryStorage(): StorageAPI.Async {
  const storage = new MemoryStorage()
  return {
    type: () => 1,
    connect: async () => storage.connect(),
    createMatch: async (matchID, opts) => storage.createMatch(matchID, opts),
    setState: async (matchID, state, deltalog) => storage.setState(matchID, state, deltalog),
    setMetadata: async (matchID, metadata) => storage.setMetadata(matchID, metadata),
    fetch: async (matchID, opts) => storage.fetch(matchID, opts),
    wipe: async (matchID) => storage.wipe(matchID),
    listMatches: async (opts) => storage.listMatches(opts),
  }
}

describe('deletion-safe storage', () => {
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
    const { storage, deletionGuard } = createDeletionSafeStorage(createAsyncMemoryStorage())
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
