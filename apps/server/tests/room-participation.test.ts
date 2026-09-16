import { describe, expect, it } from 'vitest'
import { io, type Socket } from 'socket.io-client'

import type { State } from 'boardgame.io'
import type { AvalonG } from '@avalon/game'

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

function updateProfile(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  playerID: string,
  credentials: string,
  body: unknown,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${encodeURIComponent(matchID)}/players/${encodeURIComponent(playerID)}/profile`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

function waitForEvent(socket: Socket, event: string, timeoutMs = 3_000) {
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

function waitForEventMatching(
  socket: Socket,
  event: string,
  matches: (args: unknown[]) => boolean,
  timeoutMs = 3_000,
) {
  return new Promise<unknown[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`Timed out waiting for matching Socket.IO ${event}`))
    }, timeoutMs)
    const onEvent = (...args: unknown[]) => {
      if (!matches(args)) return
      clearTimeout(timeout)
      socket.off(event, onEvent)
      resolve(args)
    }
    socket.on(event, onEvent)
  })
}

function connectSocket(port: number) {
  return io(`http://127.0.0.1:${port}/avalon`, {
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  })
}

describe('room participation APIs', () => {
  it('updates only the authenticated lobby player profile in metadata and game state', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const guest = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
      })
      const before = db.fetch(matchID, { metadata: true }).metadata?.players[1]

      const response = await updateProfile(
        running,
        matchID,
        guest.playerID,
        guest.playerCredentials,
        { playerName: '  Morgan  ', data: { avatarID: 'morgana' } },
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        playerName: 'Morgan',
        data: { avatarID: 'morgana' },
        revision: expect.any(Number),
      })
      const { metadata, state } = db.fetch(matchID, { metadata: true, state: true })
      expect(metadata?.players[1]).toMatchObject({
        id: 1,
        name: 'Morgan',
        credentials: guest.playerCredentials,
        data: {
          avatarID: 'morgana',
          clientID: (before?.data as { clientID: string }).clientID,
          sessionID: (before?.data as { sessionID: string }).sessionID,
        },
      })
      expect((state?.G as AvalonG).players['1']?.name).toBe('Morgan')
    } finally {
      await running.close()
    }
  })

  it('returns strictly increasing profile revisions when the clock does not advance', async () => {
    const running = await startAvalonServer({
      config,
      db: new MemoryStorage(),
      now: () => 42,
    })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const player = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const first = await updateProfile(
        running,
        matchID,
        player.playerID,
        player.playerCredentials,
        { playerName: 'Morgan', data: { avatarID: 'morgana' } },
      )
      const second = await updateProfile(
        running,
        matchID,
        player.playerID,
        player.playerCredentials,
        { playerName: 'Merlin', data: { avatarID: 'merlin' } },
      )

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      const firstBody = await first.json() as { revision: number }
      const secondBody = await second.json() as { revision: number }
      expect(secondBody.revision).toBeGreaterThan(firstBody.revision)
    } finally {
      await running.close()
    }
  })

  it('broadcasts a successful profile update to connected room clients', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })
    let socket: Socket | undefined

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
      socket = connectSocket(running.gamePort)
      await waitForEvent(socket, 'connect')
      const synced = waitForEvent(socket, 'sync')
      socket.emit('sync', matchID, host.playerID, host.playerCredentials, 5)
      await synced
      const matchData = waitForEventMatching(socket, 'matchData', ([eventMatchID, players]) =>
        eventMatchID === matchID &&
        Array.isArray(players) &&
        players.some((player) => (
          typeof player === 'object' &&
          player !== null &&
          (player as { id?: unknown }).id === 1 &&
          (player as { name?: unknown }).name === 'Morgan'
        )),
      )

      expect((await updateProfile(
        running,
        matchID,
        guest.playerID,
        guest.playerCredentials,
        { playerName: 'Morgan', data: { avatarID: 'morgana' } },
      )).status).toBe(200)

      const [broadcastMatchID, players] = await matchData
      expect(broadcastMatchID).toBe(matchID)
      expect(players).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          name: 'Morgan',
          data: expect.objectContaining({ avatarID: 'morgana' }),
        }),
      ]))
      expect((players as Record<string, unknown>[]).some(
        (player) => 'credentials' in player,
      )).toBe(false)
    } finally {
      socket?.close()
      await running.close()
    }
  })

  it('rejects unauthorized and malformed profile updates without changing the seat', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const guest = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
      })

      expect((await updateProfile(
        running,
        matchID,
        guest.playerID,
        'wrong-credential',
        { playerName: 'Mallory', data: { avatarID: 'assassin' } },
      )).status).toBe(403)
      expect((await updateProfile(
        running,
        matchID,
        guest.playerID,
        guest.playerCredentials,
        {
          playerName: 'Mallory',
          data: { avatarID: 'assassin', clientID: 'must-not-change' },
        },
      )).status).toBe(400)

      const { metadata, state } = db.fetch(matchID, { metadata: true, state: true })
      expect(metadata?.players[1]?.name).toBe('Bob')
      expect((state?.G as AvalonG).players['1']?.name).toBe('Bob')
    } finally {
      await running.close()
    }
  })

  it('keeps the player profile immutable after the game starts', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      await lobby.joinMatch('avalon', matchID, {
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
      ;(playingState.G as AvalonG).status = 'playing'
      playingState.ctx.phase = 'identityRecognition'
      db.setState(matchID, playingState, [])

      expect((await updateProfile(
        running,
        matchID,
        guest.playerID,
        guest.playerCredentials,
        { playerName: 'Morgan', data: { avatarID: 'morgana' } },
      )).status).toBe(409)

      const snapshot = db.fetch(matchID, { metadata: true, state: true })
      expect(snapshot.metadata?.players[1]?.name).toBe('Bob')
      expect((snapshot.state?.G as AvalonG).players['1']?.name).toBe('Bob')
    } finally {
      await running.close()
    }
  })

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
