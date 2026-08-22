import { describe, expect, it } from 'vitest'

import { playScriptedScenario } from '../src/index'

describe('scripted Avalon acceptance scenarios', () => {
  it.each([
    ['five-rejections', { winner: 'evil', reason: 'five_rejections' }],
    ['three-failed-quests', { winner: 'evil', reason: 'three_quests' }],
  ] as const)('finishes %s with the expected result', (scenario, result) => {
    const run = playScriptedScenario({
      masterSeed: `scripted-${scenario}`,
      scenario,
    })

    expect(run.finalState.G.result).toEqual(result)
  })

  it.each([
    ['assassination-hit', 'evil'],
    ['assassination-miss', 'good'],
  ] as const)('finishes %s for %s', (scenario, winner) => {
    const run = playScriptedScenario({
      masterSeed: `scripted-${scenario}`,
      scenario,
    })
    const targetID = run.finalState.G.result?.targetID

    expect(run.finalState.G.result).toEqual({
      winner,
      reason: 'assassination',
      targetID,
    })
    expect(targetID).toBeDefined()
  })

  it.each([
    ['seven-player-fourth-quest-one-fail', 1, true],
    ['seven-player-fourth-quest-two-fails', 2, false],
  ] as const)(
    'settles %s with %i Fail card(s)',
    (scenario, failCount, succeeded) => {
      const run = playScriptedScenario({
        masterSeed: `scripted-${scenario}`,
        scenario,
      })

      expect(run.playerCount).toBe(7)
      expect(run.finalState.G.questHistory[3]).toMatchObject({
        questIndex: 3,
        failCount,
        succeeded,
      })
    },
  )
})
