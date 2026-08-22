import {
  getPlayerCountConfig,
  loyaltyForRole,
  type AvalonG,
  type PlayerID,
  type QuestCard,
} from '@avalon/game'

import { createAvalonRuleDriver } from './rule-driver'
import type { AvalonCommand } from './transcript'

export type ScriptedScenario =
  | 'five-rejections'
  | 'three-failed-quests'
  | 'assassination-hit'
  | 'assassination-miss'
  | 'seven-player-fourth-quest-one-fail'
  | 'seven-player-fourth-quest-two-fails'

export interface ScriptedScenarioOptions {
  masterSeed: string
  scenario: ScriptedScenario
}

export function playScriptedScenario(options: ScriptedScenarioOptions) {
  const playerCount = options.scenario.startsWith('seven-player') ? 7 : 5
  const driver = createAvalonRuleDriver({
    masterSeed: options.masterSeed,
    playerCount,
  })
  const transcript: AvalonCommand[] = []
  const snapshots: ReturnType<typeof driver.snapshot>[] = []

  const state = () => driver.snapshot()
  const game = () => state().G as AvalonG
  const dispatch = (command: AvalonCommand) => {
    transcript.push(command)
    driver.dispatch(command)
    snapshots.push(state())
  }
  const roleIDs = (loyalty: 'good' | 'evil') =>
    Object.entries(game().secret.roleByPlayer)
      .filter(([, role]) => loyaltyForRole(role) === loyalty)
      .map(([playerID]) => playerID)
  const chooseTeam = (evilCount: number) => {
    const teamSize = getPlayerCountConfig(playerCount)
      .questTeamSizes[game().questIndex]
    return [
      ...roleIDs('evil').slice(0, evilCount),
      ...roleIDs('good').slice(0, teamSize - evilCount),
    ]
  }
  const proposeAndApprove = (team: PlayerID[]) => {
    const leaderID = game().leaderID
    if (leaderID === null) throw new Error('Scripted scenario has no leader')
    dispatch({ actor: leaderID, command: 'proposeTeam', payload: { team } })
    for (const playerID of state().ctx.playOrder) {
      dispatch({
        actor: playerID,
        command: 'castTeamVote',
        payload: { vote: 'approve' },
      })
    }
  }
  const playQuest = (failCount: number) => {
    const team = chooseTeam(failCount)
    proposeAndApprove(team)
    let remainingFails = failCount

    for (const playerID of team) {
      const isEvil = loyaltyForRole(
        game().secret.roleByPlayer[playerID],
      ) === 'evil'
      const card: QuestCard = isEvil && remainingFails > 0
        ? 'fail'
        : 'success'
      if (card === 'fail') remainingFails -= 1
      dispatch({
        actor: playerID,
        command: 'playQuestCard',
        payload: { card },
      })
    }
  }
  const finishAssassination = (hitMerlin: boolean) => {
    const roleByPlayer = game().secret.roleByPlayer
    const assassinID = Object.entries(roleByPlayer).find(
      ([, role]) => role === 'assassin',
    )?.[0]
    const targetID = Object.entries(roleByPlayer).find(([, role]) =>
      hitMerlin
        ? role === 'merlin'
        : loyaltyForRole(role) === 'good' && role !== 'merlin',
    )?.[0]
    if (assassinID === undefined || targetID === undefined) {
      throw new Error('Scripted assassination lacks an actor or target')
    }
    dispatch({
      actor: assassinID,
      command: 'assassinate',
      payload: { targetID },
    })
  }

  dispatch({ actor: '0', command: 'startGame' })

  if (options.scenario === 'five-rejections') {
    for (let proposal = 0; proposal < 5; proposal += 1) {
      const team = chooseTeam(0)
      const leaderID = game().leaderID
      if (leaderID === null) throw new Error('Scripted scenario has no leader')
      dispatch({ actor: leaderID, command: 'proposeTeam', payload: { team } })
      for (const playerID of state().ctx.playOrder) {
        dispatch({
          actor: playerID,
          command: 'castTeamVote',
          payload: { vote: 'reject' },
        })
      }
    }
  } else if (options.scenario === 'three-failed-quests') {
    for (let quest = 0; quest < 3; quest += 1) playQuest(1)
  } else if (
    options.scenario === 'assassination-hit' ||
    options.scenario === 'assassination-miss'
  ) {
    for (let quest = 0; quest < 3; quest += 1) playQuest(0)
    finishAssassination(options.scenario === 'assassination-hit')
  } else {
    playQuest(1)
    playQuest(0)
    playQuest(0)
    playQuest(
      options.scenario === 'seven-player-fourth-quest-one-fail' ? 1 : 2,
    )

    if (state().ctx.phase === 'assassination') {
      finishAssassination(false)
    } else {
      playQuest(1)
    }
  }

  const finalState = state()
  if (finalState.G.status !== 'finished') {
    throw new Error(`Scripted scenario did not finish: ${options.scenario}`)
  }

  return { finalState, playerCount, snapshots, transcript }
}
