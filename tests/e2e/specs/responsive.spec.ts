import { expect, test, type Page } from '@playwright/test'

import { playGeneratedGame } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

const viewports = [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1077, height: 722 },
  { width: 1280, height: 685 },
  { width: 1440, height: 900 },
]

async function expectRoundTableFits(page: Page, tableLabel: string) {
  const dimensions = await page.evaluate(() => {
    const root = document.documentElement
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
    }
  })
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth)
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.innerHeight)

  const geometry = await page.getByLabel(tableLabel, { exact: true }).evaluate((table) => {
    const seatRects = Array.from(table.querySelectorAll('[data-round-table-seat]'))
      .map((seat) => Array.from(seat.querySelectorAll('[data-round-table-avatar], [data-round-table-nameplate]'))
        .map((part) => ({
          kind: part.hasAttribute('data-round-table-avatar') ? 'avatar' : 'nameplate',
          rect: part.getBoundingClientRect(),
        })))
    const center = table.querySelector('[data-round-table-center]')?.firstElementChild?.getBoundingClientRect()
    let clippingAncestor = table.parentElement
    while (clippingAncestor !== null) {
      const style = window.getComputedStyle(clippingAncestor)
      if ([style.overflowX, style.overflowY].some((overflow) => overflow === 'hidden' || overflow === 'clip')) break
      clippingAncestor = clippingAncestor.parentElement
    }
    const clippingRect = clippingAncestor?.getBoundingClientRect()
    const headerItemRects = Array.from(clippingAncestor?.querySelector('header')?.children ?? [])
      .map((item) => item.getBoundingClientRect())
    const bottomSeatPart = seatRects
      .flatMap((seat) => seat.map(({ rect }) => rect))
      .sort((left, right) => right.bottom - left.bottom)[0]
    const intersects = (left: DOMRect, right: DOMRect, tolerance = 1) => (
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance
      && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance
    )
    const usesHeaderSpace = window.innerWidth > window.innerHeight
      && window.innerHeight >= 421
    const seatCount = Number(table.getAttribute('data-round-table-seat-count'))
    const requiredBottomSafetyGap = usesHeaderSpace ? (seatCount <= 6 ? 24 : 6) : null

    return {
      bottomSafetyGap: clippingRect === undefined || bottomSeatPart === undefined
        ? null
        : Math.round((clippingRect.bottom - bottomSeatPart.bottom) * 100) / 100,
      centerOverlappingSeats: center === undefined
        ? ['missing-center']
        : seatRects.flatMap((seat, index) => seat.flatMap(({ kind, rect }) => intersects(rect, center)
          ? [`${index + 1}:${kind}:${Math.round(Math.min(rect.right, center.right) - Math.max(rect.left, center.left))}x${Math.round(Math.min(rect.bottom, center.bottom) - Math.max(rect.top, center.top))}`]
          : [])),
      clippedSeatParts: clippingRect === undefined
        ? ['missing-clipping-region']
        : seatRects.flatMap((seat, index) => seat.flatMap(({ kind, rect }) => (
          rect.left >= clippingRect.left
          && rect.right <= clippingRect.right
          && rect.top >= clippingRect.top
          && rect.bottom <= clippingRect.bottom
            ? []
            : [`${index + 1}:${kind}:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}`]
        ))),
      headerItemsOverlappingSeats: usesHeaderSpace
        ? headerItemRects.flatMap((headerRect, headerIndex) => (
            seatRects.flatMap((seat, seatIndex) => seat.some(({ rect }) => intersects(rect, headerRect, 4))
              ? [`${headerIndex + 1}:${seatIndex + 1}`]
              : [])
          ))
        : [],
      overlappingSeatPairs: seatRects.flatMap((seat, index) => (
        seatRects.slice(index + 1).flatMap((other, relativeIndex) => (
          seat.some((left) => other.some((right) => intersects(left.rect, right.rect, 4))) ? [`${index + 1}-${index + relativeIndex + 2}`] : []
        ))
      )),
      seatsOutsideViewport: seatRects.flatMap((seat, index) => seat.flatMap(({ kind, rect }) => (
        rect.left >= 0
        && rect.right <= window.innerWidth
        && rect.top >= 0
        && rect.bottom <= window.innerHeight
          ? []
          : [`${index + 1}:${kind}:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}`]
      ))),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      requiredBottomSafetyGap,
    }
  })

  expect(geometry.seatsOutsideViewport, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.clippedSeatParts, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.overlappingSeatPairs, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.centerOverlappingSeats, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.headerItemsOverlappingSeats, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  if (geometry.requiredBottomSafetyGap !== null) {
    expect(geometry.bottomSafetyGap, `${tableLabel} @ ${geometry.viewport}`).toBeGreaterThanOrEqual(
      geometry.requiredBottomSafetyGap,
    )
  }

  const undersizedControlLabels = await page.locator('button:visible').evaluateAll((buttons) => (
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      })
      .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '')
  ))
  expect(undersizedControlLabels).toEqual([])
}

test('five, seven, and ten-player round tables remain operable across target widths', async ({
  browser,
}) => {
  test.setTimeout(180_000)

  for (const playerCount of [5, 7, 10]) {
    const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
    const generated = playGeneratedGame({ masterSeed, playerCount })
    const harness = await createBrowserReplayHarness({ browser, playerCount })

    try {
      const hostPage = harness.pages[0]
      for (const viewport of viewports) {
        await hostPage.setViewportSize(viewport)
        await expectRoundTableFits(hostPage, `${playerCount} 人玩家圆桌`)
      }

      await harness.dispatch(generated.transcript[0])
      const propose = generated.transcript.find(
        ({ command }) => command === 'proposeTeam',
      )!
      const leaderPage = harness.pages[Number(propose.actor)]
      for (const viewport of viewports) {
        await leaderPage.setViewportSize(viewport)
        await expect(leaderPage.getByLabel('阿瓦隆游戏圆桌')).toBeVisible()
        await expectRoundTableFits(leaderPage, `${playerCount} 人游戏圆桌`)
      }

      if (playerCount === 5) {
        let knowledgeToggleVerified = false
        for (const page of harness.pages) {
          await page.getByRole('button', { name: '显示已知角色信息' }).click()
          if (await page.locator('[data-known-player-info]').count() > 0) {
            await expect(page.getByRole('button', { name: '隐藏已知角色信息' })).toBeVisible()
            await page.getByRole('button', { name: '隐藏已知角色信息' }).click()
            await expect(page.locator('[data-known-player-info]')).toHaveCount(0)
            knowledgeToggleVerified = true
            break
          }
          await page.getByRole('button', { name: '隐藏已知角色信息' }).click()
        }
        expect(knowledgeToggleVerified).toBe(true)
      }

      await leaderPage.setViewportSize(viewports[0])
      await harness.dispatch(propose)
      const vote = generated.transcript.find(
        ({ command }) => command === 'castTeamVote',
      )!
      const votePage = harness.pages[Number(vote.actor)]
      await votePage.setViewportSize(viewports[0])
      await harness.dispatch(vote)
      if (vote.command !== 'castTeamVote') throw new Error('Expected a team vote command')
      const submittedVoteLabel = vote.payload.vote === 'approve' ? '同意' : '拒绝'
      await expect(
        votePage.getByText(`已投票：${submittedVoteLabel}，等待其他玩家`, { exact: true }),
      ).toBeVisible()
      await expectRoundTableFits(votePage, `${playerCount} 人游戏圆桌`)

      if (playerCount === 5) {
        const landscape = viewports[1]
        await votePage.setViewportSize(landscape)
        await expect(votePage.getByText(`已投票：${submittedVoteLabel}，等待其他玩家`, { exact: true })).toBeVisible()
        await expect(votePage.getByLabel('五次任务进度')).toBeVisible()
        await expect(votePage.getByLabel('五次任务进度').locator('li')).toHaveCount(5)
        await expect(votePage.getByLabel('连续否决轨道')).toBeVisible()
        await expectRoundTableFits(votePage, `${playerCount} 人游戏圆桌`)

        const voteIndex = generated.transcript.indexOf(vote)
        const questCardIndex = generated.transcript.findIndex(
          ({ command }, index) => index > voteIndex && command === 'playQuestCard',
        )
        expect(questCardIndex).toBeGreaterThan(voteIndex)
        for (let index = voteIndex + 1; index < questCardIndex; index += 1) {
          await harness.dispatch(generated.transcript[index]!)
        }

        const questCard = generated.transcript[questCardIndex]!
        const questPage = harness.pages[Number(questCard.actor)]
        await questPage.setViewportSize(landscape)
        await expect(questPage.getByLabel('五次任务进度')).toBeVisible()
        await expect(questPage.getByLabel('五次任务进度').locator('li')).toHaveCount(5)
        await expect(questPage.getByLabel('连续否决轨道')).toBeVisible()
        await expect(questPage.getByRole('button', { name: /成功/ })).toBeVisible()
        await expectRoundTableFits(questPage, `${playerCount} 人游戏圆桌`)
        if (questCard.command !== 'playQuestCard') throw new Error('Expected a quest card command')
        await questPage.getByRole('button', {
          name: questCard.payload.card === 'success' ? /成功/ : /失败/,
        }).click()
        const submittedCardLabel = questCard.payload.card === 'success' ? 'Success' : 'Fail'
        await expect(
          questPage.getByText(`已提交 ${submittedCardLabel}，等待结算`, { exact: true }),
        ).toBeVisible()
      }
    } finally {
      await harness.close()
    }
  }
})
