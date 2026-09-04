import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  getAvalonPlayerView,
  getPlayerCountConfig,
  type AvalonG,
} from '@avalon/game'

import { playGeneratedGame } from '../src/index'
import { createPropertyProgress } from './property-progress'

const propertyRuns = Number(process.env.AVALON_PROPERTY_RUNS ?? 100)
const propertyProgressEnabled = process.env.AVALON_PROPERTY_PROGRESS === '1'
const propertyTimeoutMs = propertyRuns <= 100
  ? 15_000
  : Math.max(120_000, propertyRuns * 60)
const replaySeed = process.env.FAST_CHECK_SEED === undefined
  ? undefined
  : Number(process.env.FAST_CHECK_SEED)
const replayPath = process.env.FAST_CHECK_PATH

function assertGameInvariants(
  G: AvalonG,
  playerCount: number,
  gameover: unknown,
) {
  expect(G.questIndex).toBe(G.questHistory.length)
  expect(G.goodSuccesses).toBe(
    G.questHistory.filter(({ succeeded }) => succeeded).length,
  )
  expect(G.evilFailures).toBe(
    G.questHistory.filter(({ succeeded }) => !succeeded).length,
  )

  for (const quest of G.questHistory) {
    expect(quest.team).toHaveLength(
      getPlayerCountConfig(playerCount).questTeamSizes[quest.questIndex],
    )
    expect(new Set(quest.team)).toHaveLength(quest.team.length)
    expect(quest.successCount + quest.failCount).toBe(quest.team.length)
    expect(quest).not.toHaveProperty('cards')
  }

  for (const playerID of [
    null,
    ...Array.from({ length: playerCount }, (_, index) => String(index)),
  ]) {
    const view = getAvalonPlayerView(G, playerID)
    expect(view).not.toHaveProperty('secret')
    expect(view.viewer.submittedVote).toBe(
      playerID === null ? undefined : G.secret.pendingVotes[playerID],
    )
    expect(view.viewer.submittedQuestCard).toBe(
      playerID === null ? undefined : G.secret.pendingQuestCards[playerID],
    )
  }

  if (G.status === 'finished') {
    expect(G.result).toEqual(gameover)
  } else {
    expect(G.result).toBeUndefined()
  }
}

describe('generated Avalon games', () => {
  it('allows hosted runners enough time for the default property coverage', () => {
    expect(propertyTimeoutMs).toBeGreaterThanOrEqual(15_000)
  })

  for (const playerCount of [5, 6, 7, 8, 9, 10]) {
    it(`preserves rule and visibility invariants for ${playerCount} players`, () => {
      const visitedPhases = new Set<string>()
      const progress = propertyProgressEnabled
        ? createPropertyProgress({
            label: `${playerCount} players`,
            totalRuns: propertyRuns,
          })
        : undefined

      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.array(fc.nat(), { minLength: 1, maxLength: 50 }),
          (masterSeed, decisions) => {
            const run = playGeneratedGame({
              decisions,
              masterSeed,
              playerCount,
            })

            try {
              for (const snapshot of run.snapshots) {
                visitedPhases.add(snapshot.ctx.phase)
                assertGameInvariants(
                  snapshot.G,
                  playerCount,
                  snapshot.ctx.gameover,
                )
              }
              expect(run.finalState.G.status).toBe('finished')
              progress?.advance()
            } catch (error) {
              throw new Error(
                `Generated game failed: ${JSON.stringify({
                  masterSeed,
                  playerCount,
                  transcript: run.transcript,
                })}`,
                { cause: error },
              )
            }
          },
        ),
        {
          numRuns: propertyRuns,
          path: replayPath,
          seed: replaySeed,
        },
      )

      progress?.complete()

      expect([...visitedPhases]).toEqual(
        expect.arrayContaining([
          'teamProposal',
          'teamVote',
          'quest',
          'assassination',
        ]),
      )
    }, propertyTimeoutMs)
  }
})
