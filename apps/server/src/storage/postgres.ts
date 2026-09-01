import { readFile } from 'node:fs/promises'

import type { LogEntry, Server, State, StorageAPI } from 'boardgame.io'
import { Pool } from 'pg'

import type {
  AtomicLobbyStorage,
  LobbyMatchMutation,
  LobbyMatchSnapshot,
} from './lobby-storage'

const schemaURL = new URL('./schema.sql', import.meta.url)

export interface PostgresStorageOptions {
  connectionString?: string
  pool?: Pool
}

interface MatchRow {
  match_id: string
  state?: State
  initial_state?: State
  metadata?: Server.MatchData
}

interface SequenceRow {
  last_sequence: string | number | null
}

type ClosablePool = Pick<Pool, 'connect' | 'end' | 'off' | 'on' | 'query'>

function matchNotFound(matchID: string) {
  return new Error(`Match ${matchID} was not found`)
}

function json(value: unknown) {
  return JSON.stringify(value)
}

function timestamp(milliseconds: number) {
  return new Date(milliseconds)
}

export class PostgresStorage implements StorageAPI.Async, AtomicLobbyStorage {
  private readonly pool: ClosablePool
  private readonly ownsPool: boolean
  private readonly handlePoolError = (error: Error) => {
    const code = (error as NodeJS.ErrnoException).code
    console.error('PostgreSQL idle client error', {
      ...(code === undefined ? {} : { code }),
      message: error.message,
    })
  }

  constructor(options: PostgresStorageOptions = {}) {
    if (options.pool !== undefined) {
      this.pool = options.pool
      this.ownsPool = false
    } else {
      const connectionString = options.connectionString ?? process.env.DATABASE_URL
      if (connectionString === undefined || connectionString.trim() === '') {
        throw new Error('DATABASE_URL is required for PostgresStorage')
      }

      this.pool = new Pool({ connectionString })
      this.ownsPool = true
    }

    this.pool.on('error', this.handlePoolError)
  }

  type(): 1 {
    return 1
  }

  async connect() {
    const schema = await readFile(schemaURL, 'utf8')
    await this.pool.query('SELECT 1')
    await this.pool.query(schema)
  }

  async close() {
    try {
      if (this.ownsPool) await this.pool.end()
    } finally {
      this.pool.off('error', this.handlePoolError)
    }
  }

  async createMatch(
    matchID: string,
    opts: StorageAPI.CreateMatchOpts,
  ): Promise<void> {
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      await client.query(
        `
          INSERT INTO matches (
            match_id,
            game_name,
            metadata,
            state,
            initial_state,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
        `,
        [
          matchID,
          opts.metadata.gameName,
          json(opts.metadata),
          json(opts.initialState),
          json(opts.initialState),
          timestamp(opts.metadata.createdAt),
          timestamp(opts.metadata.updatedAt),
        ],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async setState(
    matchID: string,
    state: State,
    deltalog?: LogEntry[],
  ): Promise<void> {
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      const match = await client.query(
        'SELECT match_id FROM matches WHERE match_id = $1 FOR UPDATE',
        [matchID],
      )
      if (match.rowCount === 0) throw matchNotFound(matchID)

      await client.query(
        'UPDATE matches SET state = $2::jsonb WHERE match_id = $1',
        [matchID, json(state)],
      )

      if (deltalog !== undefined && deltalog.length > 0) {
        const sequence = await client.query<SequenceRow>(
          'SELECT COALESCE(MAX(sequence_no), 0) AS last_sequence FROM match_logs WHERE match_id = $1',
          [matchID],
        )
        let nextSequence = Number(sequence.rows[0]?.last_sequence ?? 0)

        for (const entry of deltalog) {
          nextSequence += 1
          await client.query(
            `
              INSERT INTO match_logs (match_id, sequence_no, entry)
              VALUES ($1, $2, $3::jsonb)
            `,
            [matchID, nextSequence, json(entry)],
          )
        }
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async setMetadata(
    matchID: string,
    metadata: Server.MatchData,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE matches
        SET game_name = $2,
            metadata = $3::jsonb,
            updated_at = $4
        WHERE match_id = $1
      `,
      [matchID, metadata.gameName, json(metadata), timestamp(metadata.updatedAt)],
    )

    if (result.rowCount === 0) throw matchNotFound(matchID)
  }

  async mutateLobbyMatch<T>(
    matchID: string,
    mutate: (snapshot: LobbyMatchSnapshot) => LobbyMatchMutation<T>,
  ): Promise<T> {
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      const selected = await client.query<MatchRow>(
        'SELECT state, metadata FROM matches WHERE match_id = $1 FOR UPDATE',
        [matchID],
      )
      const row = selected.rows[0]
      if (row?.state === undefined || row.metadata === undefined) {
        throw matchNotFound(matchID)
      }

      const next = mutate({ state: row.state, metadata: row.metadata })
      await client.query(
        `
          UPDATE matches
          SET state = $2::jsonb,
              metadata = $3::jsonb,
              game_name = $4,
              updated_at = $5
          WHERE match_id = $1
        `,
        [
          matchID,
          json(next.state),
          json(next.metadata),
          next.metadata.gameName,
          timestamp(next.metadata.updatedAt),
        ],
      )
      await client.query('COMMIT')
      return next.result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async fetch<O extends StorageAPI.FetchOpts>(
    matchID: string,
    opts: O,
  ): Promise<StorageAPI.FetchResult<O>> {
    const columns = ['match_id']
    if (opts.state) columns.push('state')
    if (opts.initialState) columns.push('initial_state')
    if (opts.metadata) columns.push('metadata')

    const result = await this.pool.query<MatchRow>(
      `SELECT ${columns.join(', ')} FROM matches WHERE match_id = $1`,
      [matchID],
    )
    const row = result.rows[0]
    const fetched = {} as StorageAPI.FetchFields
    if (row === undefined) {
      if (opts.state) fetched.state = undefined as unknown as State
      if (opts.initialState) {
        fetched.initialState = undefined as unknown as State
      }
      if (opts.metadata) {
        fetched.metadata = undefined as unknown as Server.MatchData
      }
      if (opts.log) fetched.log = []
      return fetched as StorageAPI.FetchResult<O>
    }

    if (opts.state) fetched.state = row.state as State
    if (opts.initialState) fetched.initialState = row.initial_state as State
    if (opts.metadata) fetched.metadata = row.metadata as Server.MatchData

    if (opts.log) {
      const logResult = await this.pool.query<{ entry: LogEntry }>(
        `
          SELECT entry
          FROM match_logs
          WHERE match_id = $1
          ORDER BY sequence_no ASC
        `,
        [matchID],
      )
      fetched.log = logResult.rows.map(({ entry }) => entry)
    }

    return fetched as StorageAPI.FetchResult<O>
  }

  async wipe(matchID: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM matches WHERE match_id = $1',
      [matchID],
    )
    if (result.rowCount === 0) throw matchNotFound(matchID)
  }

  async listMatches(opts?: StorageAPI.ListMatchesOpts): Promise<string[]> {
    const values: unknown[] = []
    const conditions = ['TRUE']
    const addValue = (value: unknown) => {
      values.push(value)
      return `$${values.length}`
    }

    if (opts?.gameName !== undefined) {
      conditions.push(`game_name = ${addValue(opts.gameName)}`)
    }

    if (opts?.where?.isGameover !== undefined) {
      conditions.push(`(metadata ? 'gameover') = ${addValue(opts.where.isGameover)}`)
    }

    if (opts?.where?.updatedBefore !== undefined) {
      conditions.push(
        `updated_at < to_timestamp(${addValue(opts.where.updatedBefore)}::double precision / 1000.0)`,
      )
    }

    if (opts?.where?.updatedAfter !== undefined) {
      conditions.push(
        `updated_at > to_timestamp(${addValue(opts.where.updatedAfter)}::double precision / 1000.0)`,
      )
    }

    const result = await this.pool.query<{ match_id: string }>(
      `
        SELECT match_id
        FROM matches
        WHERE ${conditions.join(' AND ')}
        ORDER BY updated_at DESC
      `,
      values,
    )

    return result.rows.map(({ match_id }) => match_id)
  }
}
