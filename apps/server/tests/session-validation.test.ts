import { describe, expect, it } from 'vitest'

import { startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'
import { AvalonTestLobbyClient as LobbyClient } from './support/lobby-client'

const config = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: true,
  devAdminToken: 'local-dev-token',
}

function baseURL(running: Awaited<ReturnType<typeof startAvalonServer>>) {
  return `http://127.0.0.1:${running.lobbyPort}`
}

function validateSession(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  playerID: string,
  credentials: string,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${encodeURIComponent(matchID)}/players/${encodeURIComponent(playerID)}/session`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${credentials}` },
    },
  )
}

describe('room session validation', () => {
  it('returns only success or unauthorized for a seat credential', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const joined = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })

      const accepted = await validateSession(
        running,
        matchID,
        joined.playerID,
        joined.playerCredentials,
      )
      expect(accepted.status).toBe(204)
      expect(await accepted.text()).toBe('')

      const rejected = await validateSession(running, matchID, '0', 'copied-public-value')
      expect(rejected.status).toBe(403)
    } finally {
      await running.close()
    }
  })

  it('rejects a kicked credential after immediate rejoin with copied public data', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const publicData = { clientID: 'client-alice', sessionID: 'join-session-alice' }
      const alice = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
        data: publicData,
      })
      const kick = await fetch(`${baseURL(running)}/dev/rooms/${matchID}/players/1`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })
      expect(kick.status).toBe(200)

      const bob = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bors',
        data: publicData,
      })
      const publicMatch = await lobby.getMatch('avalon', matchID)
      expect(publicMatch.players[1].data).toEqual({
        avatarID: 'loyal-servant',
        sessionID: publicData.sessionID,
      })

      expect((await validateSession(
        running,
        matchID,
        alice.playerID,
        alice.playerCredentials,
      )).status).toBe(403)
      expect((await validateSession(
        running,
        matchID,
        bob.playerID,
        bob.playerCredentials,
      )).status).toBe(204)
    } finally {
      await running.close()
    }
  })

  it('classifies a deleted room as missing', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const joined = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const deletion = await fetch(`${baseURL(running)}/dev/rooms/${matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })
      expect(deletion.status).toBe(204)

      expect((await validateSession(
        running,
        matchID,
        joined.playerID,
        joined.playerCredentials,
      )).status).toBe(404)
    } finally {
      await running.close()
    }
  })
})
