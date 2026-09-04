import { describe, expect, it } from 'vitest'

import { createConfiguredStorage } from '../src/storage/configured'
import { MemoryStorage } from '../src/storage/memory'
import { PostgresStorage } from '../src/storage/postgres'

describe('createConfiguredStorage', () => {
  it('uses memory storage only when explicitly requested', () => {
    expect(createConfiguredStorage({ AVALON_STORAGE: 'memory' }))
      .toBeInstanceOf(MemoryStorage)
  })

  it('preserves DATABASE_URL compatibility', async () => {
    const storage = createConfiguredStorage({
      AVALON_STORAGE: 'postgres',
      DATABASE_URL: 'postgresql://avalon:secret@database.example/avalon',
    })

    try {
      expect(storage).toBeInstanceOf(PostgresStorage)
    } finally {
      if (storage instanceof PostgresStorage) await storage.close()
    }
  })

  it('accepts standard PostgreSQL fields for Compose', async () => {
    const storage = createConfiguredStorage({
      AVALON_STORAGE: 'postgres',
      PGHOST: 'postgres',
      PGPORT: '5432',
      PGDATABASE: 'avalon',
      PGUSER: 'avalon',
      PGPASSWORD: 'secret',
    })

    try {
      expect(storage).toBeInstanceOf(PostgresStorage)
    } finally {
      if (storage instanceof PostgresStorage) await storage.close()
    }
  })

  it.each([
    ['PGHOST', {
      AVALON_STORAGE: 'postgres',
    }],
    ['PGPORT', {
      AVALON_STORAGE: 'postgres',
      PGHOST: 'postgres',
      PGPORT: 'not-a-port',
      PGDATABASE: 'avalon',
      PGUSER: 'avalon',
      PGPASSWORD: 'secret',
    }],
  ] as const)('rejects invalid PostgreSQL configuration mentioning %s', (field, env) => {
    expect(() => createConfiguredStorage(env)).toThrow(field)
  })

  it('rejects unknown storage modes', () => {
    expect(() => createConfiguredStorage({ AVALON_STORAGE: 'sqlite' }))
      .toThrow('AVALON_STORAGE must be either postgres or memory')
  })
})
