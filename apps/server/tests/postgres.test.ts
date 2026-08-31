import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

import type { LogEntry, Server, State } from 'boardgame.io'
import type { Pool } from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { PostgresStorage } from '../src/storage/postgres'

const envFile = new URL('../.env.local', import.meta.url)
if (existsSync(envFile)) loadEnvFile(envFile)

const databaseUrl = process.env.DATABASE_URL
if (
  process.env.AVALON_REQUIRE_POSTGRES_TESTS === '1' &&
  databaseUrl === undefined
) {
  throw new Error('DATABASE_URL is required for PostgreSQL integration tests')
}
const describeDatabase = databaseUrl === undefined ? describe.skip : describe

function createState(value: number, stateID: number): State {
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
    _stateID: stateID,
  }
}

function createMetadata(
  gameName: string,
  createdAt: number,
  updatedAt = createdAt,
  gameover?: Server.MatchData['gameover'],
): Server.MatchData {
  return {
    gameName,
    players: {
      0: { id: 0, name: 'Alice', credentials: 'credential-0' },
      1: { id: 1, name: 'Bob', credentials: 'credential-1' },
    },
    setupData: { numPlayers: 5 },
    ...(gameover === undefined ? {} : { gameover }),
    createdAt,
    updatedAt,
  }
}

const initialState = createState(0, 0)
const currentState = createState(1, 1)
const logEntry = {
  action: { type: 'MAKE_MOVE', payload: { type: 'increment', args: [] } },
  _stateID: 1,
  turn: 0,
  phase: 'lobby',
} as unknown as LogEntry

interface FakeMatchRow {
  state: State
  metadata: Server.MatchData
}

class AtomicTransactionPool {
  private row: FakeMatchRow
  private lock = Promise.resolve()

  constructor(row: FakeMatchRow) {
    this.row = structuredClone(row)
  }

  on() {}

  off() {}

  async end() {}

  async query(sql: string) {
    if (/SELECT .*state.*metadata.*FROM matches/i.test(sql)) {
      return {
        rowCount: 1,
        rows: [{ match_id: 'room-a', ...structuredClone(this.row) }],
      }
    }
    throw new Error(`Unexpected pool query: ${sql}`)
  }

  async connect() {
    let transactionRow: FakeMatchRow | undefined
    let releaseLock: (() => void) | undefined
    const release = () => {
      releaseLock?.()
      releaseLock = undefined
      transactionRow = undefined
    }

    return {
      query: async (sql: string, values?: unknown[]) => {
        if (sql === 'BEGIN') return { rowCount: null, rows: [] }
        if (/SELECT state, metadata FROM matches .*FOR UPDATE/i.test(sql)) {
          const previousLock = this.lock
          this.lock = new Promise<void>((resolve) => {
            releaseLock = resolve
          })
          await previousLock
          transactionRow = structuredClone(this.row)
          return { rowCount: 1, rows: [structuredClone(transactionRow)] }
        }
        if (/UPDATE matches\s+SET state/i.test(sql)) {
          if (transactionRow === undefined || values === undefined) {
            throw new Error('UPDATE requires a locked transaction row')
          }
          transactionRow = {
            state: JSON.parse(values[1] as string) as State,
            metadata: JSON.parse(values[2] as string) as Server.MatchData,
          }
          return { rowCount: 1, rows: [] }
        }
        if (sql === 'COMMIT') {
          if (transactionRow === undefined) throw new Error('no transaction row')
          this.row = structuredClone(transactionRow)
          release()
          return { rowCount: null, rows: [] }
        }
        if (sql === 'ROLLBACK') {
          release()
          return { rowCount: null, rows: [] }
        }
        throw new Error(`Unexpected client query: ${sql}`)
      },
      release,
    }
  }
}

function createAtomicPostgresStorage() {
  const pool = new AtomicTransactionPool({
    state: createState(0, 0),
    metadata: createMetadata('avalon', 100),
  })
  return new PostgresStorage({ pool: pool as unknown as Pool })
}

describe('PostgresStorage atomic lobby mutation', () => {
  it('commits state and metadata together and returns the callback result', async () => {
    const storage = createAtomicPostgresStorage()

    await expect(storage.mutateLobbyMatch('room-a', ({ state, metadata }) => ({
      state: { ...state, G: { value: 1 } },
      metadata: { ...metadata, updatedAt: 200 },
      result: 'committed',
    }))).resolves.toBe('committed')

    await expect(storage.fetch('room-a', {
      state: true,
      metadata: true,
    })).resolves.toMatchObject({
      state: { G: { value: 1 } },
      metadata: { updatedAt: 200 },
    })
  })

  it('rolls back state and metadata when the callback throws', async () => {
    const storage = createAtomicPostgresStorage()

    await expect(storage.mutateLobbyMatch('room-a', ({ state, metadata }) => {
      ;(state.G as { value: number }).value = 99
      metadata.updatedAt = 999
      throw new Error('stop')
    })).rejects.toThrow('stop')

    await expect(storage.fetch('room-a', {
      state: true,
      metadata: true,
    })).resolves.toMatchObject({
      state: { G: { value: 0 } },
      metadata: { updatedAt: 100 },
    })
  })

  it('serializes concurrent callbacks on the committed row', async () => {
    const storage = createAtomicPostgresStorage()
    const observedValues: number[] = []
    const increment = () => storage.mutateLobbyMatch('room-a', ({ state, metadata }) => {
      const value = (state.G as { value: number }).value
      observedValues.push(value)
      return {
        state: { ...state, G: { value: value + 1 } },
        metadata: { ...metadata, updatedAt: metadata.updatedAt + 1 },
        result: value + 1,
      }
    })

    await expect(Promise.all([increment(), increment()])).resolves.toEqual([1, 2])
    expect(observedValues).toEqual([0, 1])
    await expect(storage.fetch('room-a', {
      state: true,
      metadata: true,
    })).resolves.toMatchObject({
      state: { G: { value: 2 } },
      metadata: { updatedAt: 102 },
    })
  })
})

describeDatabase('PostgresStorage', () => {
  let storage: PostgresStorage
  const createdMatchIDs = new Set<string>()

  beforeAll(async () => {
    storage = new PostgresStorage({ connectionString: databaseUrl as string })
    await storage.connect()
  })

  afterEach(async () => {
    for (const matchID of createdMatchIDs) {
      await storage.wipe(matchID)
    }
    createdMatchIDs.clear()
  })

  afterAll(async () => {
    await storage.close()
  })

  it('round-trips initial state, current state, metadata, and delta logs', async () => {
    const matchID = `storage-${randomUUID()}`
    createdMatchIDs.add(matchID)
    const metadata = createMetadata('avalon', Date.now())

    await storage.createMatch(matchID, {
      initialState,
      metadata,
    })
    await storage.setState(matchID, currentState, [logEntry])
    await storage.setMetadata(matchID, {
      ...metadata,
      updatedAt: metadata.updatedAt + 1,
    })

    await expect(storage.fetch(matchID, {
      state: true,
      initialState: true,
      metadata: true,
      log: true,
    })).resolves.toEqual({
      state: currentState,
      initialState,
      metadata: { ...metadata, updatedAt: metadata.updatedAt + 1 },
      log: [logEntry],
    })
  })

  it('lists only matches that satisfy boardgame.io filters', async () => {
    const now = Date.now()
    const testGameName = `avalon-test-${randomUUID()}`
    const openMatchID = `storage-open-${randomUUID()}`
    const finishedMatchID = `storage-finished-${randomUUID()}`
    const otherGameMatchID = `storage-other-${randomUUID()}`
    for (const matchID of [openMatchID, finishedMatchID, otherGameMatchID]) {
      createdMatchIDs.add(matchID)
    }

    await storage.createMatch(openMatchID, {
      initialState,
      metadata: createMetadata(testGameName, now - 3000),
    })
    await storage.createMatch(finishedMatchID, {
      initialState,
      metadata: createMetadata(testGameName, now - 2000, now - 2000, {
        winner: 'evil',
      }),
    })
    await storage.createMatch(otherGameMatchID, {
      initialState,
      metadata: createMetadata('other-game', now - 1000),
    })

    await expect(storage.listMatches({ gameName: testGameName })).resolves.toEqual([
      finishedMatchID,
      openMatchID,
    ])
    await expect(storage.listMatches({
      gameName: testGameName,
      where: { isGameover: false },
    })).resolves.toEqual([openMatchID])
    await expect(storage.listMatches({
      gameName: testGameName,
      where: { isGameover: true },
    })).resolves.toEqual([finishedMatchID])
    await expect(storage.listMatches({
      gameName: testGameName,
      where: { updatedBefore: now - 2500 },
    })).resolves.toEqual([openMatchID])
    await expect(storage.listMatches({
      gameName: testGameName,
      where: { updatedAfter: now - 2500 },
    })).resolves.toEqual([finishedMatchID])
  })

  it('isolates and deletes matches independently', async () => {
    const firstMatchID = `storage-first-${randomUUID()}`
    const secondMatchID = `storage-second-${randomUUID()}`
    createdMatchIDs.add(firstMatchID)
    createdMatchIDs.add(secondMatchID)
    const metadata = createMetadata('avalon', Date.now())

    await storage.createMatch(firstMatchID, { initialState, metadata })
    await storage.createMatch(secondMatchID, { initialState, metadata })
    await storage.setState(firstMatchID, currentState, [logEntry])

    await expect(storage.fetch(secondMatchID, {
      state: true,
      log: true,
    })).resolves.toEqual({
      state: initialState,
      log: [],
    })

    await storage.wipe(firstMatchID)
    createdMatchIDs.delete(firstMatchID)
    await expect(storage.fetch(firstMatchID, { state: true })).resolves.toEqual({
      state: undefined,
    })
    await expect(storage.fetch(secondMatchID, { state: true })).resolves.toEqual({
      state: initialState,
    })
  })

  it('returns empty fetch fields for a missing match', async () => {
    const missingMatchID = `storage-missing-${randomUUID()}`

    await expect(storage.fetch(missingMatchID, {
      state: true,
      metadata: true,
      log: true,
    })).resolves.toEqual({
      state: undefined,
      metadata: undefined,
      log: [],
    })
  })
})
