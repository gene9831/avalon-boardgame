import { describe, expect, it, vi } from 'vitest'

import { LobbyClient } from 'boardgame.io/client'

import { startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'

const config = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: false,
}

function baseURL(running: Awaited<ReturnType<typeof startAvalonServer>>) {
  return `http://127.0.0.1:${running.lobbyPort}`
}

function jsonRequest(body: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function joinRequest(playerID = '0') {
  return {
    playerID,
    playerName: '  Alice  ',
    data: {
      avatarID: 'merlin',
      clientID: 'client-1',
      sessionID: 'join-session-1',
    },
  }
}

describe('Avalon HTTP protocol boundary', () => {
  it('accepts only the strict create and join request contracts', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const create = await fetch(
        `${baseURL(running)}/games/avalon/create`,
        jsonRequest({ numPlayers: 5 }),
      )
      expect(create.status).toBe(200)
      const { matchID } = await create.json() as { matchID: string }

      const unknownCreateField = await fetch(
        `${baseURL(running)}/games/avalon/create`,
        jsonRequest({ numPlayers: 5, unlisted: true }),
      )
      expect(unknownCreateField.status).toBe(400)
      expect(await unknownCreateField.json()).toEqual({
        error: { code: 'invalid_request', message: 'Invalid Avalon request' },
      })

      const invalidSeat = await fetch(
        `${baseURL(running)}/games/avalon/${matchID}/join`,
        jsonRequest(joinRequest('10')),
      )
      expect(invalidSeat.status).toBe(400)

      const unknownJoinField = await fetch(
        `${baseURL(running)}/games/avalon/${matchID}/join`,
        jsonRequest({ ...joinRequest(), admin: true }),
      )
      expect(unknownJoinField.status).toBe(400)

      const join = await fetch(
        `${baseURL(running)}/games/avalon/${matchID}/join`,
        jsonRequest(joinRequest()),
      )
      expect(join.status).toBe(200)
      expect(await join.json()).toEqual({
        playerID: '0',
        playerCredentials: expect.any(String),
      })
    } finally {
      await running.close()
    }
  })

  it('returns only the public room-detail allowlist', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const create = await fetch(
        `${baseURL(running)}/games/avalon/create`,
        jsonRequest({ numPlayers: 5 }),
      )
      const { matchID } = await create.json() as { matchID: string }
      await fetch(
        `${baseURL(running)}/games/avalon/${matchID}/join`,
        jsonRequest(joinRequest()),
      )

      const detail = await fetch(`${baseURL(running)}/games/avalon/${matchID}`)
      expect(detail.status).toBe(200)
      const room = await detail.json() as Record<string, unknown>
      expect(room).toEqual({
        matchID,
        gameName: 'avalon',
        players: [
          {
            id: 0,
            name: 'Alice',
            data: {
              avatarID: 'merlin',
              sessionID: 'join-session-1',
            },
          },
          { id: 1 },
          { id: 2 },
          { id: 3 },
          { id: 4 },
        ],
        setupData: { numPlayers: 5 },
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      })
      expect(JSON.stringify(room)).not.toContain('client-1')
      expect(JSON.stringify(room)).not.toContain('playerCredentials')
    } finally {
      await running.close()
    }
  })

  it('returns 404 without executing unused boardgame.io Lobby routes', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const joined = await fetch(
        `${baseURL(running)}/games/avalon/${matchID}/join`,
        jsonRequest(joinRequest()),
      )
      const { playerCredentials } = await joined.json() as { playerCredentials: string }
      const disabledRequests: Array<[string, RequestInit | undefined]> = [
        ['/games', undefined],
        ['/games/avalon', undefined],
        [`/games/not-avalon/${matchID}`, undefined],
        [`/games/avalon/${matchID}/leave`, jsonRequest({
          playerID: '0',
          credentials: playerCredentials,
        })],
        [`/games/avalon/${matchID}/playAgain`, jsonRequest({
          playerID: '0',
          credentials: playerCredentials,
        })],
        [`/games/avalon/${matchID}/rename`, jsonRequest({
          playerID: '0',
          credentials: playerCredentials,
          newName: 'Mallory',
        })],
        [`/games/avalon/${matchID}/update`, jsonRequest({
          playerID: '0',
          credentials: playerCredentials,
          newName: 'Mallory',
        })],
      ]

      for (const [path, init] of disabledRequests) {
        const response = await fetch(`${baseURL(running)}${path}`, init)
        expect(response.status, path).toBe(404)
        expect(await response.json()).toEqual({
          error: { code: 'not_found', message: 'Route not found' },
        })
      }

      const room = await lobby.getMatch('avalon', matchID)
      expect(room.players[0].name).toBe('Alice')
    } finally {
      await running.close()
    }
  })

  it('rejects invalid match IDs and JSON bodies over 16 KiB', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const invalidID = await fetch(
        `${baseURL(running)}/games/avalon/${'a'.repeat(129)}`,
      )
      expect(invalidID.status).toBe(400)
      expect(await invalidID.json()).toEqual({
        error: { code: 'invalid_request', message: 'Invalid Avalon request' },
      })

      const oversized = await fetch(
        `${baseURL(running)}/games/avalon/create`,
        jsonRequest({ numPlayers: 5, padding: 'x'.repeat(17 * 1024) }),
      )
      expect(oversized.status).toBe(413)
      expect(await oversized.json()).toEqual({
        error: {
          code: 'payload_too_large',
          message: 'Request body exceeds 16 KiB',
        },
      })
    } finally {
      await running.close()
    }
  })

  it('returns a safe service error when room storage is unavailable', async () => {
    class UnavailableStorage extends MemoryStorage {
      override createMatch(
        _matchID: string,
        _options: Parameters<MemoryStorage['createMatch']>[1],
      ): never {
        throw Object.assign(new Error('database password must not leak'), {
          code: 'ECONNRESET',
        })
      }
    }

    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const running = await startAvalonServer({ config, db: new UnavailableStorage() })

    try {
      const response = await fetch(
        `${baseURL(running)}/games/avalon/create`,
        jsonRequest({ numPlayers: 5 }),
      )
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body).toEqual({
        error: {
          code: 'service_unavailable',
          message: 'Service temporarily unavailable',
        },
      })
      expect(log).toHaveBeenCalledWith('Avalon HTTP request failed', {
        event: 'lobby_request',
        code: 'ECONNRESET',
      })
      expect(JSON.stringify({ body, calls: log.mock.calls })).not.toContain(
        'database password',
      )
    } finally {
      log.mockRestore()
      await running.close()
    }
  })
})
