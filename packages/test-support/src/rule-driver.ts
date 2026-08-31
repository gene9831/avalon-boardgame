/// <reference path="./boardgame-io-esm.d.ts" />

import { Client } from 'boardgame.io/dist/esm/client.js'
import type { State } from 'boardgame.io'

import { createAvalonGame, type AvalonG } from '@avalon/game'

import { deriveAvalonSeeds } from './seed'
import type { AvalonCommand, ReplayDriver } from './transcript'

export interface AvalonRuleDriverOptions {
  masterSeed: string
  playerCount: number
}

export type AvalonRuleSnapshot = State<AvalonG>

export interface AvalonRuleDriver
  extends ReplayDriver<AvalonRuleSnapshot> {
  dispatch(command: AvalonCommand): void
  snapshot(): AvalonRuleSnapshot
}

export function createAvalonRuleDriver(options: AvalonRuleDriverOptions) {
  const { gameSeed } = deriveAvalonSeeds(options.masterSeed)
  const occupiedPlayerIDs = Array.from(
    { length: options.playerCount },
    (_, index) => String(index),
  )
  const game = createAvalonGame({
    now: () => 0,
    seed: gameSeed,
    serverInstanceID: 'replay-server',
  })
  const client = Client({
    game: {
      ...game,
      setup: (context) => game.setup?.(context, {
        occupiedPlayerIDs,
        ownerPlayerID: '0',
      }) as AvalonG,
    },
    numPlayers: options.playerCount,
    playerID: '0',
  })
  const driver: AvalonRuleDriver = {
    dispatch(command) {
      client.updatePlayerID(command.actor)

      switch (command.command) {
        case 'startGame':
          client.moves.startGame()
          return
        case 'confirmIdentityRecognition':
          client.moves.confirmIdentityRecognition()
          return
        case 'proposeTeam':
          client.moves.proposeTeam(command.payload.team)
          return
        case 'castTeamVote':
          client.moves.castTeamVote(command.payload.vote)
          return
        case 'playQuestCard':
          client.moves.playQuestCard(command.payload.card)
          return
        case 'assassinate':
          client.moves.assassinate(command.payload.targetID)
          return
      }
    },
    snapshot() {
      return client.store.getState() as AvalonRuleSnapshot
    },
  }

  return driver
}
