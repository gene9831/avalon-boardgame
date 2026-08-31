import { describe, expect, it, vi } from 'vitest'

import { LobbyClient } from 'boardgame.io/client'
import { createMatch } from 'boardgame.io/internal'

import { createAvalonGame, type AvalonG } from '@avalon/game'

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

function profile(name: string, id: string) {
  return {
    playerName: name,
    data: {
      avatarID: 'merlin',
      clientID: `client-${id}`,
      sessionID: `join-session-${id}`,
    },
  }
}

function createRequest(
  overrides: Record<string, unknown> = {},
) {
  return {
    numPlayers: 5,
    roleConfiguration: { percivalMorgana: true },
    ...profile('  Alice  ', 'alice'),
    ...overrides,
  }
}

async function requestCreate(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  overrides: Record<string, unknown> = {},
) {
  return fetch(
    `${baseURL(running)}/games/avalon/create`,
    jsonRequest(createRequest(overrides)),
  )
}

async function requestJoin(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  name: string,
) {
  return fetch(
    `${baseURL(running)}/games/avalon/${matchID}/join`,
    jsonRequest(profile(name, name.toLowerCase())),
  )
}

async function requestSeatChange(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  sourcePlayerID: string,
  credential: string,
  targetPlayerID: string,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${matchID}/players/${sourcePlayerID}/seat`,
    {
      ...jsonRequest({ targetPlayerID }),
      headers: {
        ...jsonRequest({}).headers,
        Authorization: `Bearer ${credential}`,
      },
    },
  )
}

function credentialRequest(credential: string, method: 'DELETE' | 'POST') {
  return {
    method,
    headers: { Authorization: `Bearer ${credential}` },
  }
}

function requestLeave(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  playerID: string,
  credential: string,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${matchID}/players/${playerID}`,
    credentialRequest(credential, 'DELETE'),
  )
}

function requestDissolve(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  credential: string,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${matchID}`,
    credentialRequest(credential, 'DELETE'),
  )
}

function requestPrepareStart(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  playerID: string,
  credential: string,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${matchID}/players/${playerID}/prepare-start`,
    credentialRequest(credential, 'POST'),
  )
}

function requestSession(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
  playerID: string,
  credential: string,
) {
  return fetch(
    `${baseURL(running)}/rooms/avalon/${matchID}/players/${playerID}/session`,
    credentialRequest(credential, 'POST'),
  )
}

async function readRoom(
  running: Awaited<ReturnType<typeof startAvalonServer>>,
  matchID: string,
) {
  const response = await fetch(`${baseURL(running)}/games/avalon/${matchID}`)
  expect(response.status).toBe(200)
  return response.json()
}

describe('Avalon HTTP protocol boundary', () => {
  it('creates and joins the owner atomically at seat 0', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const create = await requestCreate(running)
      expect(create.status).toBe(200)
      const session = await create.json() as {
        matchID: string
        playerID: string
        playerCredentials: string
      }
      expect(session).toEqual({
        matchID: expect.any(String),
        playerID: '0',
        playerCredentials: expect.any(String),
      })
      const room = await readRoom(running, session.matchID) as {
        players: Array<{ id: number; name?: string }>
      } & Record<string, unknown>
      expect(room).toMatchObject({
        authorityVersion: 1,
        ownerPlayerID: '0',
        occupiedPlayerIDs: ['0'],
        roleConfiguration: { percivalMorgana: true },
      })
      expect(room.players[0]).toMatchObject({ id: 0, name: 'Alice' })
    } finally {
      await running.close()
    }
  })

  it('accepts only the strict create and join request contracts', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const create = await requestCreate(running)
      expect(create.status).toBe(200)
      const { matchID } = await create.json() as { matchID: string }

      const unknownCreateField = await fetch(
        `${baseURL(running)}/games/avalon/create`,
        jsonRequest(createRequest({ unlisted: true })),
      )
      expect(unknownCreateField.status).toBe(400)
      expect(await unknownCreateField.json()).toEqual({
        error: { code: 'invalid_request', message: 'Invalid Avalon request' },
      })

      const clientSelectedSeat = await fetch(
        `${baseURL(running)}/games/avalon/${matchID}/join`,
        jsonRequest({ ...profile('Bob', 'bob'), playerID: '1' }),
      )
      expect(clientSelectedSeat.status).toBe(400)

      const unknownJoinField = await fetch(
        `${baseURL(running)}/games/avalon/${matchID}/join`,
        jsonRequest({ ...profile('Bob', 'bob'), admin: true }),
      )
      expect(unknownJoinField.status).toBe(400)

      const join = await requestJoin(running, matchID, 'Bob')
      expect(join.status).toBe(200)
      expect(await join.json()).toEqual({
        matchID,
        playerID: '1',
        playerCredentials: expect.any(String),
      })
    } finally {
      await running.close()
    }
  })

  it('returns only the public room-detail allowlist', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const create = await requestCreate(running)
      const { matchID } = await create.json() as { matchID: string }

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
              sessionID: 'join-session-alice',
            },
          },
          { id: 1 },
          { id: 2 },
          { id: 3 },
          { id: 4 },
        ],
        setupData: { numPlayers: 5 },
        authorityVersion: 1,
        ownerPlayerID: '0',
        occupiedPlayerIDs: ['0'],
        roleConfiguration: { percivalMorgana: true },
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      })
      expect(JSON.stringify(room)).not.toContain('client-alice')
      expect(JSON.stringify(room)).not.toContain('playerCredentials')
    } finally {
      await running.close()
    }
  })

  it('returns 404 without executing unused boardgame.io Lobby routes', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const lobby = new LobbyClient({ server: baseURL(running) })

    try {
      const created = await requestCreate(running)
      const { matchID, playerCredentials } = await created.json() as {
        matchID: string
        playerCredentials: string
      }
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
        jsonRequest(createRequest({ padding: 'x'.repeat(17 * 1024) })),
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
        jsonRequest(createRequest()),
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

  it('assigns concurrent joins to successive smallest empty seats', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const created = await requestCreate(running)
      const { matchID } = await created.json() as { matchID: string }
      const [guinevere, lancelot] = await Promise.all([
        requestJoin(running, matchID, 'Guinevere'),
        requestJoin(running, matchID, 'Lancelot'),
      ])
      expect(guinevere.status).toBe(200)
      expect(lancelot.status).toBe(200)
      const sessions = await Promise.all([guinevere.json(), lancelot.json()]) as Array<{
        playerID: string
      }>
      expect(sessions.map(({ playerID }) => playerID).sort()).toEqual(['1', '2'])
      await expect(readRoom(running, matchID)).resolves.toMatchObject({
        occupiedPlayerIDs: ['0', '1', '2'],
      })
    } finally {
      await running.close()
    }
  })

  it('moves the owner without transferring authority and replays the change idempotently', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const created = await requestCreate(running)
      const owner = await created.json() as {
        matchID: string
        playerID: string
        playerCredentials: string
      }
      const moved = await requestSeatChange(
        running,
        owner.matchID,
        owner.playerID,
        owner.playerCredentials,
        '3',
      )
      expect(moved.status).toBe(200)
      expect(await moved.json()).toEqual({
        matchID: owner.matchID,
        playerID: '3',
        playerCredentials: owner.playerCredentials,
      })
      await expect(readRoom(running, owner.matchID)).resolves.toMatchObject({
        ownerPlayerID: '3',
        occupiedPlayerIDs: ['3'],
      })

      const replay = await requestSeatChange(
        running,
        owner.matchID,
        '0',
        owner.playerCredentials,
        '3',
      )
      expect(replay.status).toBe(200)
      expect(await replay.json()).toMatchObject({
        playerID: '3',
        playerCredentials: owner.playerCredentials,
      })
      expect((await requestSession(
        running,
        owner.matchID,
        '0',
        owner.playerCredentials,
      )).status).toBe(403)
      expect((await requestSession(
        running,
        owner.matchID,
        '3',
        owner.playerCredentials,
      )).status).toBe(204)
    } finally {
      await running.close()
    }
  })

  it('returns stable lifecycle errors and preserves a source seat after a failed move', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const created = await requestCreate(running)
      const owner = await created.json() as {
        matchID: string
        playerID: string
        playerCredentials: string
      }
      const joined = await requestJoin(running, owner.matchID, 'Bob')
      const bob = await joined.json() as {
        playerID: string
        playerCredentials: string
      }

      const occupiedTarget = await requestSeatChange(
        running,
        owner.matchID,
        bob.playerID,
        bob.playerCredentials,
        '0',
      )
      expect(occupiedTarget.status).toBe(409)
      expect(await occupiedTarget.json()).toEqual({
        error: { code: 'seat_unavailable', message: 'Seat is unavailable' },
      })
      const invalidCredential = await requestSeatChange(
        running,
        owner.matchID,
        bob.playerID,
        'copied-public-value',
        '2',
      )
      expect(invalidCredential.status).toBe(403)
      expect(await invalidCredential.json()).toEqual({
        error: {
          code: 'invalid_seat_session',
          message: 'Seat session is invalid',
        },
      })
      const room = await readRoom(running, owner.matchID) as {
        occupiedPlayerIDs: string[]
        players: Array<{ id: number; name?: string }>
      }
      expect(room).toMatchObject({
        occupiedPlayerIDs: ['0', '1'],
      })
      expect(room.players[0]).toMatchObject({ id: 0, name: 'Alice' })
      expect(room.players[1]).toMatchObject({ id: 1, name: 'Bob' })

      const duplicateClient = await fetch(
        `${baseURL(running)}/games/avalon/${owner.matchID}/join`,
        jsonRequest({
          ...profile('Mallory', 'mallory'),
          data: { ...profile('Mallory', 'mallory').data, clientID: 'client-bob' },
        }),
      )
      expect(duplicateClient.status).toBe(409)
      expect((await duplicateClient.json()).error.code).toBe('client_already_joined')

      const guestDissolve = await requestDissolve(
        running,
        owner.matchID,
        bob.playerCredentials,
      )
      expect(guestDissolve.status).toBe(403)
      expect((await guestDissolve.json()).error.code).toBe('not_room_owner')
      const ownerLeave = await requestLeave(
        running,
        owner.matchID,
        owner.playerID,
        owner.playerCredentials,
      )
      expect(ownerLeave.status).toBe(409)
      expect((await ownerLeave.json()).error.code).toBe('owner_must_dissolve')

      for (const name of ['C', 'D', 'E']) {
        expect((await requestJoin(running, owner.matchID, name)).status).toBe(200)
      }
      const full = await requestJoin(running, owner.matchID, 'F')
      expect(full.status).toBe(409)
      expect((await full.json()).error.code).toBe('room_full')
    } finally {
      await running.close()
    }
  })

  it('requires the credentialed current owner and full occupancy before start', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })

    try {
      const created = await requestCreate(running)
      const owner = await created.json() as {
        matchID: string
        playerID: string
        playerCredentials: string
      }
      const joined = await requestJoin(running, owner.matchID, 'Bob')
      const bob = await joined.json() as {
        playerID: string
        playerCredentials: string
      }

      const guest = await requestPrepareStart(
        running,
        owner.matchID,
        bob.playerID,
        bob.playerCredentials,
      )
      expect(guest.status).toBe(403)
      expect((await guest.json()).error.code).toBe('invalid_seat_session')

      const incomplete = await requestPrepareStart(
        running,
        owner.matchID,
        owner.playerID,
        owner.playerCredentials,
      )
      expect(incomplete.status).toBe(409)
      expect((await incomplete.json()).error.code).toBe('room_not_joinable')

      for (const name of ['C', 'D', 'E']) {
        expect((await requestJoin(running, owner.matchID, name)).status).toBe(200)
      }
      expect((await requestPrepareStart(
        running,
        owner.matchID,
        owner.playerID,
        owner.playerCredentials,
      )).status).toBe(204)
    } finally {
      await running.close()
    }
  })

  it('normalizes legacy seat-0 ownership and refuses an ownerless legacy waiting room', async () => {
    const db = new MemoryStorage()
    const running = await startAvalonServer({ config, db })

    try {
      const game = createAvalonGame()
      for (const [matchID, seatZeroOccupied] of [
        ['legacy-owned', true],
        ['legacy-ownerless', false],
      ] as const) {
        const match = createMatch({
          game: game as unknown as Parameters<typeof createMatch>[0]['game'],
          numPlayers: 5,
          setupData: undefined,
          unlisted: false,
        })
        if ('setupDataError' in match) throw new Error(match.setupDataError)
        match.initialState = structuredClone(match.initialState)
        delete (match.initialState.G as Partial<AvalonG>).lobby
        if (seatZeroOccupied) {
          match.metadata.players[0] = {
            id: 0,
            name: 'Legacy Owner',
            credentials: 'legacy-owner-credential',
          }
          ;(match.initialState.G as AvalonG).players['0'] = { name: 'Legacy Owner' }
        }
        db.createMatch(matchID, match)
      }

      const joinedOwned = await requestJoin(running, 'legacy-owned', 'Bob')
      expect(joinedOwned.status).toBe(200)
      await expect(readRoom(running, 'legacy-owned')).resolves.toMatchObject({
        ownerPlayerID: '0',
        occupiedPlayerIDs: ['0', '1'],
        roleConfiguration: { percivalMorgana: false },
      })

      const ownerless = await requestJoin(running, 'legacy-ownerless', 'Bob')
      expect(ownerless.status).toBe(409)
      expect((await ownerless.json()).error.code).toBe('room_not_joinable')
    } finally {
      await running.close()
    }
  })

  it('quarantines a full room with a newer authority version without mutation', async () => {
    const db = new MemoryStorage()
    const game = createAvalonGame()
    const match = createMatch({
      game: game as unknown as Parameters<typeof createMatch>[0]['game'],
      numPlayers: 5,
      setupData: undefined,
      unlisted: false,
    })
    if ('setupDataError' in match) throw new Error(match.setupDataError)
    match.initialState = structuredClone(match.initialState)
    ;(match.initialState.G as AvalonG).lobby = {
      authorityVersion: 2,
      ownerPlayerID: '0',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    } as never
    for (const playerID of ['0', '1', '2', '3', '4']) {
      const numericPlayerID = Number(playerID)
      match.metadata.players[numericPlayerID] = {
        id: numericPlayerID,
        name: playerID === '0' ? 'Future Owner' : `Future Player ${numericPlayerID + 1}`,
        credentials: `future-credential-${playerID}`,
      }
      ;(match.initialState.G as AvalonG).players[playerID] = {
        name: match.metadata.players[numericPlayerID].name!,
      }
    }
    db.createMatch('future-authority', match)
    const before = db.fetch('future-authority', { state: true, metadata: true })
    const running = await startAvalonServer({ config, db })

    try {
      const created = await requestCreate(running)
      const supported = await created.json() as { matchID: string }

      const detail = await fetch(
        `${baseURL(running)}/games/avalon/future-authority`,
      )
      expect(detail.status).toBe(409)
      expect(await detail.json()).toEqual({
        error: {
          code: 'room_not_joinable',
          message: 'Room is not joinable',
        },
      })

      const directory = await fetch(`${baseURL(running)}/rooms/avalon`)
      expect(directory.status).toBe(200)
      const directoryBody = await directory.json() as {
        rooms: Array<{ matchID: string }>
      }
      expect(directoryBody.rooms.map(({ matchID }) => matchID)).toEqual([
        supported.matchID,
      ])

      const joined = await requestJoin(running, 'future-authority', 'Bob')
      expect(joined.status).toBe(409)
      expect((await joined.json()).error.code).toBe('room_not_joinable')
      expect(db.fetch('future-authority', { state: true, metadata: true })).toEqual(before)
    } finally {
      await running.close()
    }
  })
})
