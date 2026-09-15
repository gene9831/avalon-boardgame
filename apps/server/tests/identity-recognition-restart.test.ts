import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'
import { describe, expect, it } from 'vitest'

import {
  AvalonGame,
  type AvalonG,
  type AvalonPlayerView,
  type PlayerID,
} from '@avalon/game'

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

function gameState(state: AvalonClientState): AvalonPlayerView {
  return state.G as AvalonPlayerView
}

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

function createSocketClient(
  gamePort: number,
  matchID: string,
  playerID: PlayerID,
  credentials: string,
) {
  return Client({
    game: AvalonGame,
    numPlayers: 5,
    multiplayer: SocketIO({ server: `http://127.0.0.1:${gamePort}` }),
    matchID,
    playerID,
    credentials,
  })
}

describe('identity recognition server recovery', () => {
  it('preserves each personal stage and aggregate completion across restart', async () => {
    const storage = new MemoryStorage()
    let running = await startAvalonServer({ config: testConfig, db: storage })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })
    const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
    const credentialsByPlayerID: Record<PlayerID, string> = {}
    for (let index = 0; index < 5; index += 1) {
      const playerID = String(index)
      const joined = await lobby.joinMatch('avalon', matchID, {
        playerID,
        playerName: index === 0 ? 'Alice' : `Player ${index + 1}`,
      })
      credentialsByPlayerID[playerID] = joined.playerCredentials
    }

    let clients: AvalonClient[] = []
    try {
      const clientsByPlayerID: Record<PlayerID, AvalonClient> = {}
      for (let index = 0; index < 5; index += 1) {
        const playerID = String(index)
        const client = createSocketClient(
          running.gamePort,
          matchID,
          playerID,
          credentialsByPlayerID[playerID],
        )
        clientsByPlayerID[playerID] = client
        clients.push(client)
        client.start()
      }
      await Promise.all(
        Object.values(clientsByPlayerID).map((client) =>
          waitForClientState(client, (state) => state.isConnected)),
      )
      const owner = clientsByPlayerID['0']
      owner.moves.startGame()
      await Promise.all(
        Object.values(clientsByPlayerID).map((client) =>
          waitForClientState(client, (state) => state.ctx.phase === 'identityRecognition')),
      )

      let persisted = storage.fetch(matchID, { state: true }).state.G as AvalonG
      const merlinID = Object.entries(persisted.secret.roleByPlayer)
        .find(([, role]) => role === 'merlin')?.[0]
      const servantID = Object.entries(persisted.secret.roleByPlayer)
        .find(([, role]) => role === 'loyal_servant')?.[0]
      expect(merlinID).toBeDefined()
      expect(servantID).toBeDefined()

      for (const [index, client] of Object.values(clientsByPlayerID).entries()) {
        client.moves.confirmIdentityRecognition()
        await Promise.all(
          Object.values(clientsByPlayerID).map((observingClient) =>
            waitForClientState(observingClient, (state) => {
              const recognition = gameState(state).identityRecognition
              return index === 4
                ? recognition?.stage === 'clueRecognition'
                : recognition?.stage === 'identityConfirmation' &&
                    recognition.completedCount === index + 1
            })),
        )
      }
      const merlin = clientsByPlayerID[merlinID ?? '']
      await waitForClientState(
        merlin,
        (state) => gameState(state).identityRecognition?.stage === 'clueRecognition',
      )
      const completedClueID = Object.entries(persisted.secret.roleByPlayer)
        .find(([playerID, role]) =>
          playerID !== merlinID && role !== 'loyal_servant' && role !== 'percival')?.[0]
      expect(completedClueID).toBeDefined()
      await waitForClientState(
        clientsByPlayerID[completedClueID ?? ''],
        (state) => gameState(state).identityRecognition?.stage === 'clueRecognition',
      )
      clientsByPlayerID[completedClueID ?? ''].moves.confirmIdentityRecognition()
      await waitForClientState(
        clientsByPlayerID[completedClueID ?? ''],
        (state) => gameState(state).viewer.identityRecognition?.personalStage === 'complete',
      )

      persisted = storage.fetch(matchID, { state: true }).state.G as AvalonG
      expect(persisted.identityRecognition).toEqual({
        stage: 'clueRecognition',
        completedCount: 1,
        participantCount: 4,
      })
      expect(persisted.secret.identityRecognitionStageByPlayerID[merlinID ?? ''])
        .toBe('clueRecognition')
      expect(persisted.secret.identityRecognitionStageByPlayerID[servantID ?? ''])
        .toBe('complete')
      expect(
        storage.fetch(matchID, { log: true }).log.some(
          (entry) => entry.action.payload.type === 'confirmIdentityRecognition',
        ),
      ).toBe(false)

      for (const client of clients) client.stop()
      clients = []
      await running.close()
      running = await startAvalonServer({ config: testConfig, db: storage })

      const resumedMerlin = createSocketClient(
        running.gamePort,
        matchID,
        merlinID ?? '',
        credentialsByPlayerID[merlinID ?? ''],
      )
      const resumedServant = createSocketClient(
        running.gamePort,
        matchID,
        servantID ?? '',
        credentialsByPlayerID[servantID ?? ''],
      )
      clients.push(resumedMerlin, resumedServant)
      resumedMerlin.start()
      resumedServant.start()
      const [merlinState, servantState] = await Promise.all([
        waitForClientState(
          resumedMerlin,
          (state) => gameState(state).viewer.identityRecognition?.personalStage === 'clueRecognition',
        ),
        waitForClientState(
          resumedServant,
          (state) => gameState(state).viewer.identityRecognition?.personalStage === 'complete',
        ),
      ])
      expect(gameState(merlinState).identityRecognition?.completedCount).toBe(1)
      expect(gameState(servantState).identityRecognition?.completedCount).toBe(1)

      resumedMerlin.moves.confirmIdentityRecognition()
      await waitForClientState(
        resumedMerlin,
        (state) => gameState(state).viewer.identityRecognition?.personalStage === 'complete',
      )
      persisted = storage.fetch(matchID, { state: true }).state.G as AvalonG
      expect(persisted.identityRecognition?.completedCount).toBe(2)
      expect(persisted.secret.identityRecognitionStageByPlayerID[servantID ?? ''])
        .toBe('complete')
    } finally {
      for (const client of clients) client.stop()
      await running.close()
    }
  })
})
