import { Pool, type PoolClient } from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { PostgresStorage } from '../src/storage/postgres'

describe('PostgresStorage pool errors', () => {
  it('handles idle client errors with a credential-safe log', async () => {
    const pool = new Pool()
    const storage = new PostgresStorage({ pool })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = Object.assign(new Error('read EADDRNOTAVAIL'), {
      code: 'EADDRNOTAVAIL',
    })

    try {
      const handled = pool.emit('error', error, {} as PoolClient)

      expect(handled).toBe(true)
      expect(log).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledWith('PostgreSQL idle client error', {
        code: 'EADDRNOTAVAIL',
        message: 'read EADDRNOTAVAIL',
      })
    } finally {
      log.mockRestore()
      await storage.close()
      await pool.end()
    }
  })
})
