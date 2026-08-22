import { expect, test } from '@playwright/test'

import { playGeneratedGame, replayTranscript } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

const allPlayerCounts = [5, 6, 7, 8, 9, 10]
const selectedPlayerCount = process.env.E2E_PLAYER_COUNT === undefined
  ? undefined
  : Number(process.env.E2E_PLAYER_COUNT)

if (
  selectedPlayerCount !== undefined &&
  !allPlayerCounts.includes(selectedPlayerCount)
) {
  throw new Error('E2E_PLAYER_COUNT must be an integer from 5 through 10')
}

const playerCounts = selectedPlayerCount === undefined
  ? allPlayerCounts
  : [selectedPlayerCount]

test.describe('nightly player-count matrix', () => {
  test.skip(
    process.env.E2E_MATRIX !== '1',
    'The 5–10 browser matrix runs only in the nightly workflow',
  )

  for (const playerCount of playerCounts) {
    test(`${playerCount} isolated players complete a seeded game`, async ({
      browser,
    }) => {
      const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
      const generated = playGeneratedGame({ masterSeed, playerCount })
      const harness = await createBrowserReplayHarness({ browser, playerCount })

      try {
        const snapshot = await replayTranscript(harness, generated.transcript)
        const expectedHeading = generated.finalState.G.result?.winner === 'good'
          ? '正义阵营获胜'
          : '邪恶阵营获胜'

        expect(snapshot.resultHeadings).toEqual(
          Array.from({ length: playerCount }, () => expectedHeading),
        )
      } finally {
        await harness.close()
      }
    })
  }
})
