import { describe, expect, it } from 'vitest'

import { Client, LobbyClient } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'

import { AvalonGame } from '@avalon/game'

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

type AvalonClient = ReturnType<typeof Client>
type AvalonClientState = NonNullable<ReturnType<AvalonClient['getState']>>

function waitForClientState(
  client: AvalonClient,
  predicate: (state: AvalonClientState) => boolean,
) {
  return new Promise<AvalonClientState>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error('Timed out waiting for boardgame.io client state'))
    }, 4000)

    const finish = (state: AvalonClientState) => {
      clearTimeout(timeout)
      unsubscribe()
      resolve(state)
    }

    unsubscribe = client.subscribe((state) => {
      if (state !== null && predicate(state)) finish(state)
    })

    const currentState = client.getState()
    if (currentState !== null && predicate(currentState)) finish(currentState)
  })
}

describe('Avalon development APIs', () => {
  it('reports disabled status and keeps mutation routes unavailable', async () => {
    const running = await startAvalonServer({
      config: { ...config, devToolsEnabled: false, devAdminToken: undefined },
      db: new MemoryStorage(),
    })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const status = await fetch(`${baseURL(running)}/dev/status`)
      expect(status.status).toBe(200)
      expect(await status.json()).toEqual({ enabled: false })

      const deletion = await fetch(`${baseURL(running)}/dev/rooms/${matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })
      expect(deletion.status).toBe(404)
    } finally {
      await running.close()
    }
  })

  it('rejects an invalid development token when mutations are enabled', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const deletion = await fetch(`${baseURL(running)}/dev/rooms/${matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer wrong-token' },
      })
      expect(deletion.status).toBe(401)
      await expect(lobby.getMatch('avalon', matchID)).resolves.toMatchObject({ matchID })
    } finally {
      await running.close()
    }
  })

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

  it('keeps a deleted room absent after a connected client disconnect settles', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })
    const lobby = new LobbyClient({ server: `http://127.0.0.1:${running.lobbyPort}` })
    let client: AvalonClient | undefined

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const joined = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      client = Client({
        game: AvalonGame,
        numPlayers: 5,
        multiplayer: SocketIO({ server: `http://127.0.0.1:${running.gamePort}` }),
        matchID,
        playerID: joined.playerID,
        credentials: joined.playerCredentials,
      })
      client.start()
      await waitForClientState(client, (state) => state.isConnected)

      const response = await fetch(`${baseURL(running)}/dev/rooms/${matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })
      expect(response.status).toBe(204)

      await waitForClientState(client, (state) => !state.isConnected)
      await new Promise((resolve) => setTimeout(resolve, 25))

      expect(db.fetch(matchID, {
        state: true,
        initialState: true,
        metadata: true,
        log: true,
      })).toEqual({
        state: undefined,
        initialState: undefined,
        metadata: undefined,
        log: [],
      })
      expect(db.listMatches({ gameName: 'avalon' })).not.toContain(matchID)
      await expect(lobby.getMatch('avalon', matchID)).rejects.toThrow('HTTP status 404')

      const directoryResponse = await fetch(`${baseURL(running)}/rooms/avalon`)
      const directory = await directoryResponse.json() as { rooms: { matchID: string }[] }
      expect(directory.rooms.map((room) => room.matchID)).not.toContain(matchID)
    } finally {
      client?.stop()
      await running.close()
    }
  }, 10000)

  it('keeps a deleted room absent after an anonymous socket sync', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })
    const lobby = new LobbyClient({ server: `http://127.0.0.1:${running.lobbyPort}` })
    let anonymousClient: AvalonClient | undefined

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const deletion = await fetch(`${baseURL(running)}/dev/rooms/${matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })
      expect(deletion.status).toBe(204)

      anonymousClient = Client({
        game: AvalonGame,
        numPlayers: 5,
        multiplayer: SocketIO({ server: `http://127.0.0.1:${running.gamePort}` }),
        matchID,
      })
      anonymousClient.start()
      await waitForClientState(anonymousClient, (state) => state.isConnected)

      expect(db.fetch(matchID, { metadata: true }).metadata).toBeUndefined()
      await expect(lobby.getMatch('avalon', matchID)).rejects.toThrow('HTTP status 404')

      const directoryResponse = await fetch(`${baseURL(running)}/rooms/avalon`)
      const directory = await directoryResponse.json() as { rooms: { matchID: string }[] }
      expect(directory.rooms.map((room) => room.matchID)).not.toContain(matchID)
    } finally {
      anonymousClient?.stop()
      await running.close()
    }
  }, 10000)

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
      const replacement = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Bob',
      })
      expect(replacement.playerID).toBe('0')

      await expect(lobby.updatePlayer('avalon', matchID, {
        playerID: '0',
        credentials: joined.playerCredentials,
        newName: 'Mallory',
      })).rejects.toThrow('HTTP status 403')
      await expect(lobby.updatePlayer('avalon', matchID, {
        playerID: '0',
        credentials: replacement.playerCredentials,
        newName: 'Robert',
      })).resolves.toBeUndefined()
      expect((await lobby.getMatch('avalon', matchID)).players[0].name).toBe('Robert')
    } finally {
      await running.close()
    }
  })
})

function baseURL(running: Awaited<ReturnType<typeof startAvalonServer>>) {
  return `http://127.0.0.1:${running.lobbyPort}`
}
