import { describe, expect, it } from 'vitest'

import { LobbyClient } from 'boardgame.io/client'
import { Client } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'

import { AvalonGame } from '@avalon/game'

import { startAvalonServer } from '../src/server'

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

describe('Avalon server', () => {
  it('starts the game server and Lobby API', async () => {
    const running = await startAvalonServer({
      config: { gamePort: 0, lobbyPort: 0, origins: ['*'] },
    })

    try {
      const response = await fetch(`http://127.0.0.1:${running.lobbyPort}/games`)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(['avalon'])
    } finally {
      running.close()
    }
  })

  it('keeps multiple Lobby matches isolated', async () => {
    const running = await startAvalonServer({
      config: { gamePort: 0, lobbyPort: 0, origins: ['*'] },
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })

    try {
      const first = await lobby.createMatch('avalon', { numPlayers: 5 })
      const second = await lobby.createMatch('avalon', { numPlayers: 5 })

      expect(first.matchID).not.toBe(second.matchID)

      await lobby.joinMatch('avalon', first.matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      await lobby.joinMatch('avalon', second.matchID, {
        playerID: '0',
        playerName: 'Bob',
      })

      const matches = await lobby.listMatches('avalon', { isGameover: false })
      expect(matches.matches.map(({ matchID }) => matchID)).toEqual(
        expect.arrayContaining([first.matchID, second.matchID]),
      )

      const firstMatch = await lobby.getMatch('avalon', first.matchID)
      const secondMatch = await lobby.getMatch('avalon', second.matchID)
      expect(firstMatch.players.find(({ id }) => id === 0)?.name).toBe('Alice')
      expect(secondMatch.players.find(({ id }) => id === 0)?.name).toBe('Bob')
    } finally {
      running.close()
    }
  })

  it('synchronizes five seat-bound clients through Socket.IO', async () => {
    const running = await startAvalonServer({
      config: { gamePort: 0, lobbyPort: 0, origins: ['*'] },
    })
    const lobby = new LobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })
    const clients: AvalonClient[] = []

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const players = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          lobby.joinMatch('avalon', matchID, {
            playerID: String(index),
            playerName: `Player ${index + 1}`,
          }),
        ),
      )

      for (const player of players) {
        clients.push(Client({
          game: AvalonGame,
          numPlayers: 5,
          multiplayer: SocketIO({
            server: `http://127.0.0.1:${running.gamePort}`,
          }),
          matchID,
          playerID: player.playerID,
          credentials: player.playerCredentials,
        }))
      }

      clients.forEach((client) => client.start())
      await Promise.all(
        clients.map((client) =>
          waitForClientState(client, (state) => state.isConnected),
        ),
      )

      clients[0].moves.startGame()
      const states = await Promise.all(
        clients.map((client) =>
          waitForClientState(client, (state) => state.ctx.phase === 'teamProposal'),
        ),
      )

      for (const state of states) {
        expect(state.G).not.toHaveProperty('secret')
      }
    } finally {
      clients.forEach((client) => client.stop())
      running.close()
    }
  }, 10000)
})
