import { describe, expect, it } from 'vitest'

import type { Server, State, StorageAPI } from 'boardgame.io'
import { LobbyClient } from 'boardgame.io/client'

import { AvalonSocketRegistry } from '../src/dev-admin'
import { registerRoomParticipationRoutes } from '../src/room-participation'
import { startAvalonServer } from '../src/server'
import { createDeletionSafeStorage } from '../src/storage/deletion-safe'
import { MemoryStorage } from '../src/storage/memory'

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

function createLobbyState(): State {
  return {
    G: { status: 'lobby' },
    ctx: {
      numPlayers: 5,
      playOrder: ['0', '1', '2', '3', '4'],
      playOrderPos: 0,
      activePlayers: null,
      currentPlayer: '0',
      turn: 0,
      phase: 'lobby',
    },
    plugins: {},
    _undo: [],
    _redo: [],
    _stateID: 0,
  }
}

function createLobbyMetadata(): Server.MatchData {
  return {
    gameName: 'avalon',
    players: {
      0: { id: 0, name: 'Alice', credentials: 'host-credential' },
      1: { id: 1, name: 'Bob', credentials: 'guest-credential' },
    },
    createdAt: 100,
    updatedAt: 100,
  }
}

function createDelayedMetadataStorage() {
  const storage = new MemoryStorage()
  const pendingWrites: Array<() => void> = []
  let deferNextWrite = false
  const asyncStorage: StorageAPI.Async = {
    type: () => 1,
    connect: async () => storage.connect(),
    createMatch: async (matchID, opts) => storage.createMatch(matchID, opts),
    setState: async (matchID, state, deltalog) => storage.setState(matchID, state, deltalog),
    setMetadata: async (matchID, metadata) => {
      if (!deferNextWrite) {
        storage.setMetadata(matchID, metadata)
        return
      }
      deferNextWrite = false
      await new Promise<void>((resolve) => {
        pendingWrites.push(() => {
          storage.setMetadata(matchID, metadata)
          resolve()
        })
      })
    },
    fetch: async (matchID, opts) => storage.fetch(matchID, opts),
    wipe: async (matchID) => storage.wipe(matchID),
    listMatches: async (opts) => storage.listMatches(opts),
  }
  return {
    storage: asyncStorage,
    deferNextWrite() {
      deferNextWrite = true
    },
    get pendingWrites() {
      return pendingWrites.length
    },
    releaseNextWrite() {
      const release = pendingWrites.shift()
      if (release === undefined) throw new Error('no deferred metadata write')
      release()
    },
  }
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
        isConnected: false,
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
      )).status).toBe(409)
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

  it('persists a seat release after an older metadata write settles', async () => {
    const delayed = createDelayedMetadataStorage()
    const guarded = createDeletionSafeStorage(delayed.storage)
    await guarded.storage.createMatch('room-1', {
      initialState: createLobbyState(),
      metadata: createLobbyMetadata(),
    })

    const staleMetadata = (await guarded.storage.fetch('room-1', { metadata: true })).metadata!
    staleMetadata.players[1].isConnected = true
    delayed.deferNextWrite()
    const oldWrite = guarded.storage.setMetadata('room-1', staleMetadata)
    await Promise.resolve()
    expect(delayed.pendingWrites).toBe(1)

    type TestContext = {
      params: Record<string, string>
      status: number
      get(name: string): string
      throw(status: number, message?: string): never
    }
    const handlers = new Map<string, (ctx: TestContext) => Promise<void>>()
    registerRoomParticipationRoutes(
      {
        delete: (path, handler) => handlers.set(
          path,
          handler as (ctx: TestContext) => Promise<void>,
        ),
      },
      {
        db: guarded.storage,
        forceUpdateMetadata: guarded.forceUpdateMetadata,
        deletionGuard: guarded.deletionGuard,
        registry: new AvalonSocketRegistry(),
        queues: { getMatchQueue: () => ({ add: async (task) => task() }) },
      },
    )
    const leave = handlers.get('/rooms/avalon/:matchID/players/:playerID')
    if (leave === undefined) throw new Error('leave route was not registered')
    const context: TestContext = {
      params: { matchID: 'room-1', playerID: '1' },
      status: 200,
      get: (name) => name === 'authorization' ? 'Bearer guest-credential' : '',
      throw: (status, message) => {
        throw new Error(`HTTP ${status}: ${message ?? ''}`)
      },
    }

    const leaveRequest = leave(context)
    await Promise.resolve()
    expect(delayed.pendingWrites).toBe(1)

    delayed.releaseNextWrite()
    await expect(oldWrite).resolves.toBeUndefined()
    await expect(leaveRequest).resolves.toBeUndefined()
    expect(context.status).toBe(204)

    const persisted = (await guarded.storage.fetch('room-1', { metadata: true })).metadata!
    expect(persisted.players[1].name).toBeUndefined()
    expect(persisted.players[1].credentials).not.toBe('guest-credential')
    expect(persisted.players[1].isConnected).toBe(false)
  })
})
