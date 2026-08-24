import {
  getPlayerCountConfig,
  loyaltyForRole,
  type AvalonG,
  type PlayerID,
  type QuestCard,
  type TeamVote,
} from '@avalon/game'

import { createAvalonRuleDriver } from './rule-driver'
import { getIdentityRecognitionCommands } from './identity-recognition'
import { generateSeededDecisions } from './seed'
import type { AvalonCommand } from './transcript'

export interface GeneratedGameOptions {
  decisions?: readonly number[]
  masterSeed: string
  maxCommands?: number
  playerCount: number
}

function rotatePlayers(
  playerIDs: readonly PlayerID[],
  start: number,
  count: number,
) {
  return Array.from(
    { length: count },
    (_, offset) => playerIDs[(start + offset) % playerIDs.length],
  )
}

export function playGeneratedGame(options: GeneratedGameOptions) {
  const decisions = options.decisions ?? generateSeededDecisions(
    options.masterSeed,
    64,
  )
  if (decisions.length === 0) {
    throw new Error('Generated games require at least one decision')
  }

  const driver = createAvalonRuleDriver(options)
  const transcript: AvalonCommand[] = []
  const snapshots: ReturnType<typeof driver.snapshot>[] = []
  const maxCommands = options.maxCommands ?? 300
  let decisionIndex = 0

  const takeDecision = () => {
    const decision = decisions[decisionIndex % decisions.length]
    decisionIndex += 1
    return decision
  }
  const dispatch = (command: AvalonCommand) => {
    transcript.push(command)
    driver.dispatch(command)
    snapshots.push(driver.snapshot())
  }

  while (transcript.length < maxCommands) {
    const state = driver.snapshot()
    const G = state.G as AvalonG

    if (G.status === 'finished') {
      return { finalState: state, snapshots, transcript }
    }

    switch (state.ctx.phase) {
      case 'lobby':
        dispatch({ actor: '0', command: 'startGame' })
        break
      case 'identityRecognition':
        for (const command of getIdentityRecognitionCommands(G)) {
          dispatch(command)
        }
        break
      case 'teamProposal': {
        if (G.leaderID === null) {
          throw new Error('Team proposal phase has no leader')
        }
        const teamSize = getPlayerCountConfig(
          options.playerCount,
        ).questTeamSizes[G.questIndex]
        const team = rotatePlayers(
          state.ctx.playOrder,
          takeDecision() % options.playerCount,
          teamSize,
        )
        dispatch({
          actor: G.leaderID,
          command: 'proposeTeam',
          payload: { team },
        })
        break
      }
      case 'teamVote':
        for (const playerID of state.ctx.playOrder) {
          const vote: TeamVote = takeDecision() % 5 === 0
            ? 'reject'
            : 'approve'
          dispatch({
            actor: playerID,
            command: 'castTeamVote',
            payload: { vote },
          })
        }
        break
      case 'quest': {
        if (G.proposedTeam === null) {
          throw new Error('Quest phase has no proposed team')
        }
        for (const playerID of G.proposedTeam) {
          const role = G.secret.roleByPlayer[playerID]
          const card: QuestCard = loyaltyForRole(role) === 'evil' &&
            takeDecision() % 2 === 0
            ? 'fail'
            : 'success'
          dispatch({
            actor: playerID,
            command: 'playQuestCard',
            payload: { card },
          })
        }
        break
      }
      case 'assassination': {
        const assassinID = Object.entries(G.secret.roleByPlayer).find(
          ([, role]) => role === 'assassin',
        )?.[0]
        const targets = Object.entries(G.secret.roleByPlayer)
          .filter(([, role]) => loyaltyForRole(role) === 'good')
          .map(([playerID]) => playerID)
        if (assassinID === undefined || targets.length === 0) {
          throw new Error('Assassination phase lacks an assassin or target')
        }
        dispatch({
          actor: assassinID,
          command: 'assassinate',
          payload: {
            targetID: targets[takeDecision() % targets.length],
          },
        })
        break
      }
      default:
        throw new Error(`Unsupported Avalon phase: ${state.ctx.phase}`)
    }
  }

  throw new Error(`Generated game exceeded ${maxCommands} commands`)
}
