import type { State } from 'boardgame.io'
import { Client, LobbyClient } from 'boardgame.io/client'
import { SocketIO } from 'boardgame.io/multiplayer'

import {
  AvalonGame,
  type AvalonG,
} from '@avalon/game'
import {
  deriveAvalonSeeds,
  type AvalonCommand,
  type ReplayDriver,
} from '@avalon/test-support'

import { startAvalonServer } from '../../src/server'
import { MemoryStorage } from '../../src/storage/memory'

const testConfig = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: false,
}

type SocketClient = ReturnType<typeof Client>
type SocketClientState = NonNullable<ReturnType<SocketClient['getState']>>

function waitForClientState(
  client: SocketClient,
  predicate: (state: SocketClientState) => boolean,
) {
  return new Promise<SocketClientState>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error('Timed out waiting for Socket.IO replay state'))
    }, 4000)

    const finish = (state: SocketClientState) => {
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

export interface SocketReplaySnapshot {
  authoritative: State<AvalonG>
  playerStates: SocketClientState[]
}

export interface SocketReplayHarness
  extends ReplayDriver<SocketReplaySnapshot> {
  close(): Promise<void>
}

export async function createSocketReplayHarness(options: {
  masterSeed: string
  playerCount: number
}): Promise<SocketReplayHarness> {
  const storage = new MemoryStorage()
  const { gameSeed } = deriveAvalonSeeds(options.masterSeed)
  const running = await startAvalonServer({
    config: testConfig,
    db: storage,
    gameSeed,
  })
  const lobby = new LobbyClient({
    server: `http://127.0.0.1:${running.lobbyPort}`,
  })
  const { matchID } = await lobby.createMatch('avalon', {
    numPlayers: options.playerCount,
  })
  const joined = await Promise.all(
    Array.from({ length: options.playerCount }, (_, index) =>
      lobby.joinMatch('avalon', matchID, {
        playerID: String(index),
        playerName: `Replay Player ${index + 1}`,
      }),
    ),
  )
  const clients = joined.map((player) => Client({
    game: AvalonGame,
    numPlayers: options.playerCount,
    multiplayer: SocketIO({
      server: `http://127.0.0.1:${running.gamePort}`,
    }),
    matchID,
    playerID: player.playerID,
    credentials: player.playerCredentials,
  }))
  clients.forEach((client) => client.start())
  await Promise.all(
    clients.map((client) =>
      waitForClientState(client, (state) => state.isConnected),
    ),
  )

  const snapshot = async (): Promise<SocketReplaySnapshot> => {
    const { state } = storage.fetch(matchID, { state: true })
    const playerStates = clients.map((client) => {
      const playerState = client.getState()
      if (playerState === null) {
        throw new Error('Socket.IO replay client has no state')
      }
      return playerState
    })
    return {
      authoritative: state as State<AvalonG>,
      playerStates,
    }
  }

  return {
    async dispatch(command: AvalonCommand) {
      const client = clients[Number(command.actor)]
      if (client === undefined) {
        throw new Error(`No Socket.IO client for player ${command.actor}`)
      }
      const previousStateIDs = clients.map(
        (current) => current.getState()?._stateID ?? -1,
      )

      switch (command.command) {
        case 'startGame':
          client.moves.startGame()
          break
        case 'confirmIdentityRecognition':
          client.moves.confirmIdentityRecognition()
          break
        case 'proposeTeam':
          client.moves.proposeTeam(command.payload.team)
          break
        case 'castTeamVote':
          client.moves.castTeamVote(command.payload.vote)
          break
        case 'playQuestCard':
          client.moves.playQuestCard(command.payload.card)
          break
        case 'assassinate':
          client.moves.assassinate(command.payload.targetID)
          break
      }

      await Promise.all(
        clients.map((current, index) =>
          waitForClientState(
            current,
            (state) => state._stateID > previousStateIDs[index],
          ),
        ),
      )
    },
    snapshot,
    async close() {
      clients.forEach((client) => client.stop())
      await running.close()
    },
  }
}
