import { expect, test } from '@playwright/test'

import { playScriptedScenario, replayTranscript } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

test.describe('browser victory outcomes', () => {
  for (const { scenario, heading, reason } of [
    {
      scenario: 'three-failed-quests',
      heading: '邪恶阵营获胜',
      reason: '邪恶阵营破坏了三次任务',
    },
    {
      scenario: 'assassination-hit',
      heading: '邪恶阵营获胜',
      reason: '刺客命中了梅林',
    },
    {
      scenario: 'assassination-miss',
      heading: '正义阵营获胜',
      reason: '刺杀未命中梅林',
    },
  ] as const) {
    test(`${scenario} settles consistently in five browsers`, async ({ browser }) => {
      const run = playScriptedScenario({
        masterSeed: process.env.E2E_MASTER_SEED ?? 'playwright-smoke',
        scenario,
      })
      const harness = await createBrowserReplayHarness({
        browser,
        playerCount: run.playerCount,
      })

      try {
        const snapshot = await replayTranscript(harness, run.transcript)
        expect(snapshot.resultHeadings).toEqual(
          Array.from({ length: run.playerCount }, () => heading),
        )
        for (const page of harness.pages) {
          await expect(page.getByText(new RegExp(reason)).first()).toBeVisible()
        }
      } finally {
        await harness.close()
      }
    })
  }
})
