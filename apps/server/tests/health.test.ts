import { describe, expect, it } from 'vitest'

import { startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'

const config = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: false,
}

function healthURL(running: Awaited<ReturnType<typeof startAvalonServer>>) {
  return `http://127.0.0.1:${running.lobbyPort}/healthz`
}

class UnavailableStorage extends MemoryStorage {
  async checkHealth() {
    throw new Error(
      'connect ECONNREFUSED postgresql://avalon:secret@database.internal/avalon',
    )
  }
}

describe('Avalon health endpoint', () => {
  it('reports ready when storage is reachable', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const response = await fetch(healthURL(running))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ status: 'ok' })
    } finally {
      await running.close()
    }
  })

  it('reports a redacted service failure when storage is unreachable', async () => {
    const running = await startAvalonServer({ config, db: new UnavailableStorage() })

    try {
      const response = await fetch(healthURL(running))
      const body = await response.text()

      expect(response.status).toBe(503)
      expect(JSON.parse(body)).toEqual({ status: 'unavailable' })
      expect(body).not.toContain('database.internal')
      expect(body).not.toContain('secret')
    } finally {
      await running.close()
    }
  })
})
