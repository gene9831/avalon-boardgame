import { expect, test } from '@playwright/test'

import { playScriptedScenario, replayTranscript } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

test('five isolated browser players complete a rejected-team game', async ({
  browser,
}) => {
  const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
  const generated = playScriptedScenario({
    masterSeed,
    scenario: 'five-rejections',
  })
  const harness = await createBrowserReplayHarness({
    browser,
    playerCount: 5,
  })

  try {
    await harness.pages[4].reload()
    await expect(
      harness.pages[4].getByText('等待房主开始', { exact: true }),
    ).toBeVisible()
    await harness.pages[4].getByRole('button', { name: '房间操作' }).click()
    await expect(
      harness.pages[4].getByRole('button', { name: '退出房间' }),
    ).toBeVisible()
    await harness.pages[4].getByRole('button', { name: '房间操作' }).click()

    const snapshot = await replayTranscript(harness, generated.transcript)

    expect(snapshot.resultHeadings).toEqual(
      Array.from({ length: 5 }, () => '邪恶阵营获胜'),
    )
    for (const page of harness.pages) {
      await expect(
        page
          .locator('p:visible')
          .filter({ hasText: '连续五次队伍提案被否决' })
          .first(),
      ).toBeVisible()
    }
  } finally {
    await harness.close()
  }
})
