import { describe, expect, it } from 'vitest'

import type { State } from 'boardgame.io'

import { startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'
import { AvalonTestLobbyClient as LobbyClient } from './support/lobby-client'

const config = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: false,
  devAdminToken: undefined,
}

function baseURL(running: Awaited<ReturnType<typeof startAvalonServer>>) {
  return `http://127.0.0.1:${running.lobbyPort}`
}

function leaveRoom(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  playerID: string,
  credentials: string,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${encodeURIComponent(matchID)}/players/${encodeURIComponent(playerID)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${credentials}` },
    },
  )
}

function dissolveRoom(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  credentials: string,
) {
  return fetch(`${baseURL(running)}/rooms/avalon/${encodeURIComponent(matchID)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${credentials}` },
  })
}

describe('room participation APIs', () => {
  it('releases a non-host lobby seat and invalidates its credential', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const bob = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
      })

      expect((await leaveRoom(
        running,
        matchID,
        bob.playerID,
        bob.playerCredentials,
      )).status).toBe(204)

      const room = await lobby.getMatch('avalon', matchID)
      expect(room.players.find(({ id }) => id === 1)).toMatchObject({
        id: 1,
      })
      expect(room.players.find(({ id }) => id === 1)?.name).toBeUndefined()

      const rejectedSession = await fetch(
        `${baseURL(running)}/rooms/avalon/${matchID}/players/1/session`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${bob.playerCredentials}` },
        },
      )
      expect(rejectedSession.status).toBe(403)

      const replacement = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bors',
      })
      expect(replacement.playerCredentials).not.toBe(bob.playerCredentials)
    } finally {
      await running.close()
    }
  })

  it('rejects invalid credentials, guest dissolution, and host seat release', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const host = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const guest = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
      })

      expect((await leaveRoom(running, matchID, '1', 'wrong-credential')).status).toBe(403)
      expect((await dissolveRoom(
        running,
        matchID,
        guest.playerCredentials,
      )).status).toBe(403)
      expect((await leaveRoom(
        running,
        matchID,
        host.playerID,
        host.playerCredentials,
      )).status).toBe(409)

      const room = await lobby.getMatch('avalon', matchID)
      expect(room.players.find(({ id }) => id === 0)?.name).toBe('Alice')
      expect(room.players.find(({ id }) => id === 1)?.name).toBe('Bob')
    } finally {
      await running.close()
    }
  })

  it('lets the host dissolve a waiting room', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const host = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })

      expect((await dissolveRoom(
        running,
        matchID,
        host.playerCredentials,
      )).status).toBe(204)
      await expect(lobby.getMatch('avalon', matchID)).rejects.toThrow('HTTP status 404')
    } finally {
      await running.close()
    }
  })

  it('does not let alternate player ID formatting release the host seat', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const host = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })

      expect((await leaveRoom(
        running,
        matchID,
        '00',
        host.playerCredentials,
      )).status).toBe(400)
      expect((await lobby.getMatch('avalon', matchID)).players[0].name).toBe('Alice')
    } finally {
      await running.close()
    }
  })

  it('keeps seats and the room intact after the game starts', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const host = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const guest = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
      })
      const { state } = db.fetch(matchID, { state: true })
      if (state === undefined) throw new Error('expected match state')
      const playingState = structuredClone(state) as State
      ;(playingState.G as { status: string }).status = 'playing'
      playingState.ctx.phase = 'teamProposal'
      db.setState(matchID, playingState, [])

      expect((await leaveRoom(
        running,
        matchID,
        guest.playerID,
        guest.playerCredentials,
      )).status).toBe(409)
      expect((await dissolveRoom(
        running,
        matchID,
        host.playerCredentials,
      )).status).toBe(409)

      const room = await lobby.getMatch('avalon', matchID)
      expect(room.players.find(({ id }) => id === 0)?.name).toBe('Alice')
      expect(room.players.find(({ id }) => id === 1)?.name).toBe('Bob')
    } finally {
      await running.close()
    }
  })

})
