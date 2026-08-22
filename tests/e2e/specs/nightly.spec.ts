import { expect, test } from '@playwright/test'

import { playScriptedScenario, replayTranscript } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

const selectedPlayerCount = process.env.E2E_PLAYER_COUNT === undefined
  ? undefined
  : Number(process.env.E2E_PLAYER_COUNT)

test.describe('nightly data scenarios', () => {
  test.skip(process.env.E2E_MATRIX !== '1', 'Nightly scenarios run only in the nightly workflow')

  for (const { scenario, resultText } of [
    {
      scenario: 'seven-player-fourth-quest-one-fail',
      resultText: '第 4 次任务成功 · 3 Success / 1 Fail',
    },
    {
      scenario: 'seven-player-fourth-quest-two-fails',
      resultText: '第 4 次任务失败 · 2 Success / 2 Fail',
    },
  ] as const) {
    test(`${scenario} exposes the aggregate result to every browser`, async ({ browser }) => {
      test.skip(
        selectedPlayerCount !== undefined && selectedPlayerCount !== 7,
        'The fourth-quest threshold runs in the 7-player shard',
      )
      const run = playScriptedScenario({
        masterSeed: process.env.E2E_MASTER_SEED ?? 'playwright-smoke',
        scenario,
      })
      const fourthQuestSettledIndex = run.snapshots.findIndex(
        ({ G }) => G.questHistory.length === 4,
      )
      const harness = await createBrowserReplayHarness({ browser, playerCount: 7 })

      try {
        for (const command of run.transcript.slice(0, fourthQuestSettledIndex + 1)) {
          await harness.dispatch(command)
        }
        for (const page of harness.pages) {
          await expect(
            page.locator('p:visible').filter({ hasText: resultText }),
          ).toBeVisible()
        }
      } finally {
        await harness.close()
      }
    })
  }

  test('two active rooms replay concurrently without sharing data', async ({ browser }) => {
    test.skip(
      selectedPlayerCount !== undefined && selectedPlayerCount !== 5,
      'Dual-room isolation runs in the 5-player shard',
    )
    const seed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
    const evilRun = playScriptedScenario({ masterSeed: seed, scenario: 'three-failed-quests' })
    const goodRun = playScriptedScenario({ masterSeed: seed, scenario: 'assassination-miss' })
    const first = await createBrowserReplayHarness({ browser, playerCount: 5 })
    const second = await createBrowserReplayHarness({ browser, playerCount: 5 })

    try {
      expect(first.matchID).not.toBe(second.matchID)
      const [evilResult, goodResult] = await Promise.all([
        replayTranscript(first, evilRun.transcript),
        replayTranscript(second, goodRun.transcript),
      ])
      expect(evilResult.resultHeadings).toEqual(
        Array.from({ length: 5 }, () => '邪恶阵营获胜'),
      )
      expect(goodResult.resultHeadings).toEqual(
        Array.from({ length: 5 }, () => '正义阵营获胜'),
      )
      expect(evilResult.urls.every((url) => url.endsWith(`/rooms/${first.matchID}`))).toBe(true)
      expect(goodResult.urls.every((url) => url.endsWith(`/rooms/${second.matchID}`))).toBe(true)
    } finally {
      await Promise.all([first.close(), second.close()])
    }
  })
})
