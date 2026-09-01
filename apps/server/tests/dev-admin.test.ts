import { io, type Socket } from 'socket.io-client'
import { describe, expect, it, vi } from 'vitest'

import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'

import {
  AvalonGame,
  parseAvalonRoomDirectoryResponse,
} from '@avalon/game'

import { listAvalonRoomSummaries } from '../src/room-directory'
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

function waitForSocketEvent(socket: Socket, event: string, timeoutMs = 3_000) {
  return new Promise<unknown[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`Timed out waiting for Socket.IO ${event}`))
    }, timeoutMs)
    const onEvent = (...args: unknown[]) => {
      clearTimeout(timeout)
      resolve(args)
    }
    socket.once(event, onEvent)
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
      const directory = parseAvalonRoomDirectoryResponse({ rooms })

      expect(rooms[0].players[0]).toEqual({
        id: 0,
        name: 'Alice',
        isConnected: false,
      })
      expect(rooms[0]).toMatchObject({ status: 'lobby' })
      expect(rooms[0]).not.toHaveProperty('state')
      expect(JSON.stringify(rooms[0])).not.toContain('secret-client-id')
      expect(directory).toEqual({ rooms })
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
    let anonymousSocket: Socket | undefined
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const deletion = await fetch(`${baseURL(running)}/dev/rooms/${matchID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })
      expect(deletion.status).toBe(204)

      anonymousSocket = io(`http://127.0.0.1:${running.gamePort}/avalon`, {
        forceNew: true,
        reconnection: false,
        transports: ['websocket'],
      })
      await waitForSocketEvent(anonymousSocket, 'connect')
      const disconnected = waitForSocketEvent(anonymousSocket, 'disconnect')
      anonymousSocket.emit('sync', matchID, '0', undefined, 5)
      await disconnected

      expect(db.fetch(matchID, { metadata: true }).metadata).toBeUndefined()
      await expect(lobby.getMatch('avalon', matchID)).rejects.toThrow('HTTP status 404')

      const directoryResponse = await fetch(`${baseURL(running)}/rooms/avalon`)
      const directory = await directoryResponse.json() as { rooms: { matchID: string }[] }
      expect(directory.rooms.map((room) => room.matchID)).not.toContain(matchID)
      expect(log).toHaveBeenCalledWith('Socket.IO protocol rejected', {
        event: 'sync',
        code: 'room_not_found',
      })
    } finally {
      log.mockRestore()
      anonymousSocket?.close()
      await running.close()
    }
  }, 10000)

  it('rejects kicking the owner and invalidates a kicked guest credential', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: `http://127.0.0.1:${running.lobbyPort}` })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const owner = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const joined = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
      })
      const moved = await fetch(
        `${baseURL(running)}/rooms/avalon/${matchID}/players/0/seat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner.playerCredentials}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetPlayerID: '3' }),
        },
      )
      expect(moved.status).toBe(200)

      const ownerKick = await fetch(`${baseURL(running)}/dev/rooms/${matchID}/players/3`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })
      expect(ownerKick.status).toBe(409)
      expect((await lobby.getMatch('avalon', matchID)).players[3].name).toBe('Alice')

      const response = await fetch(`${baseURL(running)}/dev/rooms/${matchID}/players/1`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      })

      expect(response.status).toBe(200)
      expect((await lobby.getMatch('avalon', matchID)).players[1].name).toBeUndefined()
      const replacement = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bors',
      })
      expect(replacement.playerID).toBe('0')

      const oldSession = await fetch(
        `${baseURL(running)}/rooms/avalon/${matchID}/players/1/session`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${joined.playerCredentials}` },
        },
      )
      const replacementSession = await fetch(
        `${baseURL(running)}/rooms/avalon/${matchID}/players/0/session`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${replacement.playerCredentials}` },
        },
      )
      expect(oldSession.status).toBe(403)
      expect(replacementSession.status).toBe(204)
      expect((await lobby.getMatch('avalon', matchID)).players[0].name).toBe('Bors')
    } finally {
      await running.close()
    }
  })
})

function baseURL(running: Awaited<ReturnType<typeof startAvalonServer>>) {
  return `http://127.0.0.1:${running.lobbyPort}`
}
