import { expect, test, type Page } from '@playwright/test'

import { playGeneratedGame } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

async function expectImmersiveViewportFits(page: Page) {
  const dimensions = await page.evaluate(() => {
    const root = document.documentElement
    const main = document.querySelector('main')?.getBoundingClientRect()
    return {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      mainBottom: main?.bottom ?? 0,
      mainRight: main?.right ?? 0,
      scrollHeight: root.scrollHeight,
      scrollWidth: root.scrollWidth,
    }
  })
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth)
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.innerHeight)
  expect(dimensions.mainRight).toBeLessThanOrEqual(dimensions.innerWidth)
  expect(dimensions.mainBottom).toBeLessThanOrEqual(dimensions.innerHeight)
}

test('ten-player lobby and game remain operable at desktop and narrow widths', async ({
  browser,
}) => {
  const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
  const generated = playGeneratedGame({ masterSeed, playerCount: 10 })
  const harness = await createBrowserReplayHarness({ browser, playerCount: 10 })

  try {
    const hostPage = harness.pages[0]
    await expectImmersiveViewportFits(hostPage)
    await hostPage.setViewportSize({ width: 320, height: 568 })
    await expectImmersiveViewportFits(hostPage)
    await harness.dispatch(generated.transcript[0])

    const propose = generated.transcript.find(
      ({ command }) => command === 'proposeTeam',
    )!
    const leaderPage = harness.pages[Number(propose.actor)]
    await leaderPage.setViewportSize({ width: 320, height: 568 })
    await expect(leaderPage.getByLabel('阿瓦隆游戏圆桌')).toBeVisible()
    await expectImmersiveViewportFits(leaderPage)
    await harness.dispatch(propose)

    const vote = generated.transcript.find(
      ({ command }) => command === 'castTeamVote',
    )!
    const votePage = harness.pages[Number(vote.actor)]
    await votePage.setViewportSize({ width: 320, height: 568 })
    await harness.dispatch(vote)
    await expect(
      votePage.locator('p:visible').filter({ hasText: '你已投票' }),
    ).toBeVisible()
    await expectImmersiveViewportFits(votePage)
  } finally {
    await harness.close()
  }
})
