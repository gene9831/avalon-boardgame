import { describe, expect, it } from 'vitest'

import { LobbyClient } from 'boardgame.io/client'

import { listAvalonRoomSummaries } from '../src/room-directory'
import { startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'

const config = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: true,
  devAdminToken: 'local-dev-token',
}

describe('Avalon development APIs', () => {
  it('does not expose a secret or client ID in public room summaries', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })
    const lobby = new LobbyClient({ server: `http://127.0.0.1:${running.lobbyPort}` })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
        data: { clientID: 'secret-client-id' },
      })

      const rooms = await listAvalonRoomSummaries(db)

      expect(rooms[0].players[0]).toEqual({
        id: 0,
        name: 'Alice',
        isConnected: false,
      })
      expect(rooms[0]).toMatchObject({ status: 'lobby' })
      expect(rooms[0]).not.toHaveProperty('state')
      expect(JSON.stringify(rooms[0])).not.toContain('secret-client-id')
    } finally {
      await running.close()
    }
  })

  it('deletes a room idempotently with the development token', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: `http://127.0.0.1:${running.lobbyPort}` })

    try {
      const first = await lobby.createMatch('avalon', { numPlayers: 5 })
      const response = await fetch(`${baseURL(running)}/dev/rooms/${first.matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })

      expect(response.status).toBe(204)
      expect((await fetch(`${baseURL(running)}/dev/rooms/${first.matchID}`)).status).toBe(404)
      expect((await fetch(`${baseURL(running)}/dev/rooms/${first.matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })).status).toBe(204)
    } finally {
      await running.close()
    }
  })

  it('releases a lobby seat and invalidates its old credentials', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: `http://127.0.0.1:${running.lobbyPort}` })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const joined = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const response = await fetch(`${baseURL(running)}/dev/rooms/${matchID}/players/0`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })

      expect(response.status).toBe(200)
      expect((await lobby.getMatch('avalon', matchID)).players[0].name).toBeUndefined()
      expect((await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Bob',
      })).playerID).toBe('0')
      expect(joined.playerCredentials).not.toBe('')
    } finally {
      await running.close()
    }
  })
})

function baseURL(running: Awaited<ReturnType<typeof startAvalonServer>>) {
  return `http://127.0.0.1:${running.lobbyPort}`
}
