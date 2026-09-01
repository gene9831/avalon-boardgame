import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'
import { describe, expect, it } from 'vitest'

import { AvalonGame, type AvalonG } from '@avalon/game'

import { startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'
import { AvalonTestLobbyClient as LobbyClient } from './support/lobby-client'

const testConfig = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: false,
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
      reject(new Error('Timed out waiting for identity recognition state'))
    }, 4_000)

    const finish = (state: AvalonClientState) => {
      clearTimeout(timeout)
      unsubscribe()
      resolve(state)
    }

    unsubscribe = client.subscribe((state) => {
      if (state !== null && predicate(state)) finish(state)
    })
    const current = client.getState()
    if (current !== null && predicate(current)) finish(current)
  })
}

describe('identity recognition server recovery', () => {
  it('restarts the persisted current step with a fresh deadline', async () => {
    const storage = new MemoryStorage()
    let now = 1_000
    let running = await startAvalonServer({
      config: testConfig,
      db: storage,
      identityRecognitionDeadlineEnabled: true,
      identityRecognitionNow: () => now,
      serverInstanceID: 'server-one',
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })
    const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
    const joined = await lobby.joinMatch('avalon', matchID, {
      playerID: '0',
      playerName: 'Alice',
    })
    await Promise.all(
      Array.from({ length: 4 }, (_, index) => lobby.joinMatch(
        'avalon',
        matchID,
        {
          playerID: String(index + 1),
          playerName: `Player ${index + 2}`,
        },
      )),
    )
    let client = Client({
      game: AvalonGame,
      numPlayers: 5,
      multiplayer: SocketIO({
        server: `http://127.0.0.1:${running.gamePort}`,
      }),
      matchID,
      playerID: '0',
      credentials: joined.playerCredentials,
    })

    try {
      client.start()
      await waitForClientState(client, (state) => state.isConnected)
      client.moves.startGame()
      await waitForClientState(
        client,
        (state) => state.ctx.phase === 'identityRecognition',
      )
      client.moves.confirmIdentityRecognition()
      await waitForClientState(
        client,
        (state) =>
          (state.G as AvalonG).identityRecognition?.confirmedCount === 1,
      )
      expect(
        client.getState()?.log.some(
          (entry) =>
            entry.action.payload.type === 'confirmIdentityRecognition',
        ),
      ).toBe(false)
      expect(
        storage.fetch(matchID, { log: true }).log.some(
          (entry) =>
            entry.action.payload.type === 'confirmIdentityRecognition',
        ),
      ).toBe(false)

      let persisted = storage.fetch(matchID, { state: true }).state
        .G as AvalonG
      expect(persisted.identityRecognition?.deadlineAt).toBe(11_000)

      client.stop()
      await running.close()
      now = 5_000
      running = await startAvalonServer({
        config: testConfig,
        db: storage,
        identityRecognitionDeadlineEnabled: true,
        identityRecognitionNow: () => now,
        serverInstanceID: 'server-two',
      })
      client = Client({
        game: AvalonGame,
        numPlayers: 5,
        multiplayer: SocketIO({
          server: `http://127.0.0.1:${running.gamePort}`,
        }),
        matchID,
        playerID: '0',
        credentials: joined.playerCredentials,
      })
      client.start()
      await waitForClientState(client, (state) => state.isConnected)
      client.moves.confirmIdentityRecognition()
      await waitForClientState(
        client,
        (state) =>
          (state.G as AvalonG).identityRecognition?.confirmedCount === 0,
      )

      persisted = storage.fetch(matchID, { state: true }).state.G as AvalonG
      expect(persisted.identityRecognition).toEqual({
        step: 'roleReveal',
        deadlineAt: 15_000,
        confirmedCount: 0,
        participantCount: 5,
      })
    } finally {
      client.stop()
      await running.close()
    }
  })
})
