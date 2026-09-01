import { expect, test, type Page } from '@playwright/test'

import { playGeneratedGame } from '@avalon/test-support'

import { createBrowserReplayHarness, createRoom } from '../support/browser-replay'

const viewports = [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1077, height: 722 },
  { width: 1280, height: 685 },
  { width: 1339, height: 786 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
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
    const tableRect = table.getBoundingClientRect()
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
    const maxAvatarWidth = Math.max(
      ...Array.from(table.querySelectorAll('[data-round-table-avatar]'))
        .map((avatar) => avatar.getBoundingClientRect().width),
    )
    const maxNameFontSize = Math.max(
      ...Array.from(table.querySelectorAll('[data-round-table-nameplate] p'))
        .map((name) => Number.parseFloat(getComputedStyle(name).fontSize)),
    )

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
      tableSize: Math.max(tableRect.width, tableRect.height),
      maxAvatarWidth,
      maxNameFontSize,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      requiredBottomSafetyGap,
    }
  })

  expect(geometry.tableSize, `${tableLabel} @ ${geometry.viewport}`).toBeLessThanOrEqual(640)
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
        const minimumSize = button.closest('[aria-label="任务计分板"]') === null ? 44 : 40
        return rect.width < minimumSize || rect.height < minimumSize
      })
      .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '')
  ))
  expect(undersizedControlLabels).toEqual([])

  return geometry
}

function expectWideSeatMetricsAtLeast({
  baseline,
  tableLabel,
  wide,
}: {
  baseline: { maxAvatarWidth: number, maxNameFontSize: number }
  tableLabel: string
  wide: { maxAvatarWidth: number, maxNameFontSize: number }
}) {
  expect(wide.maxAvatarWidth, `${tableLabel} avatar`).toBeGreaterThanOrEqual(
    baseline.maxAvatarWidth - 0.5,
  )
  expect(wide.maxNameFontSize, `${tableLabel} name`).toBeGreaterThanOrEqual(
    baseline.maxNameFontSize - 0.1,
  )
}

test('the create-game configuration remains fully usable at narrow widths', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '创建房间' })).toBeEnabled()

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 578, height: 761 },
  ]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: '创建房间' }).click()
    const dialog = page.getByRole('dialog', { name: '创建一局阿瓦隆' })
    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const countButtons = Array.from(element.querySelectorAll('fieldset button'))
        .map((button) => button.getBoundingClientRect())
      return {
        bottom: rect.bottom,
        left: rect.left,
        minButtonHeight: Math.min(...countButtons.map(({ height }) => height)),
        minButtonWidth: Math.min(...countButtons.map(({ width }) => width)),
        right: rect.right,
        top: rect.top,
      }
    })

    expect(geometry.left).toBeGreaterThanOrEqual(16)
    expect(geometry.right).toBeLessThanOrEqual(viewport.width - 16)
    expect(geometry.top).toBeGreaterThanOrEqual(16)
    expect(geometry.bottom).toBeLessThanOrEqual(viewport.height - 16)
    expect(geometry.minButtonWidth).toBeGreaterThanOrEqual(44)
    expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44)
    await expect(dialog.getByLabel('5 人规则摘要')).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click()
  }
})

test('the create-game role option stays concise and vertically aligned on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 429, height: 741 })
  await page.goto('/')
  await page.getByRole('button', { name: '创建房间' }).click()

  const dialog = page.getByRole('dialog', { name: '创建一局阿瓦隆' })
  await expect(
    dialog.getByText('帕西维尔会看到梅林与莫甘娜两名候选人。', { exact: true }),
  ).toHaveCount(0)

  const centers = await dialog.locator('.role-configuration-toggle').evaluate((element) => {
    const checkbox = element.querySelector<HTMLInputElement>(
      '#percival-morgana-role-configuration',
    )
    const label = element.querySelector<HTMLLabelElement>(
      'label[for="percival-morgana-role-configuration"]',
    )
    const help = element.querySelector<HTMLButtonElement>('button')

    if (!checkbox || !label || !help) {
      throw new Error('角色配置控件不完整')
    }

    return [checkbox, label, help].map((control) => {
      const rect = control.getBoundingClientRect()
      return rect.top + rect.height / 2
    })
  })

  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1)
})

test('empty-seat actions stay 44px and keyboard operable at the smallest viewport', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 } })
  const page = await context.newPage()

  try {
    await createRoom(page, 5, 'Keyboard Seat Owner')
    const emptySeat = page.getByRole('button', { name: '移至 2 号空座位' })
    const bounds = await emptySeat.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)

    await emptySeat.focus()
    await expect(emptySeat).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-round-table-player][data-player-id="1"]'))
      .toContainText('Keyboard Seat Owner')
    await expect(
      page.locator('[data-round-table-player][data-player-id="1"]')
        .getByLabel('房间拥有者'),
    ).toBeVisible()
  } finally {
    await context.close()
  }
})

test('five, seven, and ten-player round tables remain compact and operable across target widths', async ({
  browser,
}) => {
  test.setTimeout(180_000)

  for (const playerCount of [5, 7, 10]) {
    const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
    const generated = playGeneratedGame({ masterSeed, playerCount })
    const harness = await createBrowserReplayHarness({ browser, playerCount })

    try {
      const hostPage = harness.pages[0]
      let lobbyBaseline: Awaited<ReturnType<typeof expectRoundTableFits>> | null = null
      for (const viewport of viewports) {
        await hostPage.setViewportSize(viewport)
        const geometry = await expectRoundTableFits(hostPage, `${playerCount} 人玩家圆桌`)
        if (viewport.width === 1280 && viewport.height === 685) lobbyBaseline = geometry
        if (viewport.width === 1339 && viewport.height === 786) {
          expect(lobbyBaseline).not.toBeNull()
          expectWideSeatMetricsAtLeast({
            baseline: lobbyBaseline!,
            tableLabel: `${playerCount} 人玩家圆桌 @ 1339x786`,
            wide: geometry,
          })
        }
      }

      const proposeIndex = generated.transcript.findIndex(
        ({ command }) => command === 'proposeTeam',
      )
      for (let index = 0; index < proposeIndex; index += 1) {
        await harness.dispatch(generated.transcript[index])
      }
      const propose = generated.transcript[proposeIndex]
      if (propose?.command !== 'proposeTeam') {
        throw new Error('Generated game has no team proposal')
      }
      const leaderPage = harness.pages[Number(propose.actor)]
      let gameBaseline: Awaited<ReturnType<typeof expectRoundTableFits>> | null = null
      for (const viewport of viewports) {
        await leaderPage.setViewportSize(viewport)
        await expect(leaderPage.getByLabel('阿瓦隆游戏圆桌')).toBeVisible()
        const geometry = await expectRoundTableFits(leaderPage, `${playerCount} 人游戏圆桌`)
        if (viewport.width === 1280 && viewport.height === 685) gameBaseline = geometry
        if (viewport.width === 1339 && viewport.height === 786) {
          expect(gameBaseline).not.toBeNull()
          expectWideSeatMetricsAtLeast({
            baseline: gameBaseline!,
            tableLabel: `${playerCount} 人游戏圆桌 @ 1339x786`,
            wide: geometry,
          })
        }
      }

      if (playerCount === 5) {
        let knowledgeToggleVerified = false
        let knowledgePage: Page | null = null
        for (const page of harness.pages) {
          await page.getByRole('button', { name: '查看我的身份与已知信息' }).click()
          await expect(page.locator('#current-player-avatar [data-role-avatar]')).toBeVisible()
          await expect(page.locator('[data-round-table-player] [data-current-role-label]')).toBeVisible()
          await expect(page.getByLabel('任务计分板', { exact: true })).toBeVisible()
          await expect(page.locator('[data-role-card]')).toHaveCount(0)
          if (await page.locator('[data-known-player-info]').count() > 0) {
            await expect(page.getByRole('button', { name: '隐藏我的身份与已知信息' })).toBeVisible()
            knowledgePage = page
            await page.getByRole('button', { name: '隐藏我的身份与已知信息' }).click()
            await expect(page.locator('[data-known-player-info]')).toHaveCount(0)
            knowledgeToggleVerified = true
            break
          }
          await page.getByRole('button', { name: '隐藏我的身份与已知信息' }).click()
        }
        expect(knowledgeToggleVerified).toBe(true)
        expect(knowledgePage).not.toBeNull()

        for (const viewport of [
          { width: 390, height: 844 },
          { width: 568, height: 320 },
        ]) {
          await knowledgePage!.setViewportSize(viewport)
          await knowledgePage!.getByRole('button', {
            name: '查看我的身份与已知信息',
          }).click()
          const roleAvatar = knowledgePage!.locator('#current-player-avatar [data-role-avatar]')
          await expect(roleAvatar).toBeVisible()
          await expect(knowledgePage!.locator('[data-round-table-player] [data-current-role-label]')).toBeVisible()
          await expect(knowledgePage!.getByLabel('任务计分板', { exact: true })).toBeVisible()
          await expect(knowledgePage!.locator('[data-role-card]')).toHaveCount(0)
          await expect(knowledgePage!.locator('[data-round-table-avatar]:visible')).toHaveCount(5)
          await expectRoundTableFits(knowledgePage!, `${playerCount} 人游戏圆桌`)
          await knowledgePage!.getByRole('button', {
            name: '隐藏我的身份与已知信息',
          }).click()
        }
      }

      await leaderPage.setViewportSize(viewports[0])
      await harness.dispatch(propose)
      const vote = generated.transcript.find(
        ({ command }) => command === 'castTeamVote',
      )!
      const votePage = harness.pages[Number(vote.actor)]
      await votePage.setViewportSize(viewports[0])
      if (playerCount === 5) {
        const voteButtonGeometry = await votePage
          .locator('.phase-action-buttons')
          .evaluate((buttonGroup) => {
            const buttons = Array.from(buttonGroup.querySelectorAll('button'))
            return {
              fontSizes: buttons.map((button) => Number.parseFloat(getComputedStyle(button).fontSize)),
              gap: Number.parseFloat(getComputedStyle(buttonGroup).gap),
              heights: buttons.map((button) => button.getBoundingClientRect().height),
            }
          })
        expect(voteButtonGeometry.fontSizes).toEqual([14, 14])
        expect(voteButtonGeometry.gap).toBeCloseTo(6, 1)
        expect(voteButtonGeometry.heights).toEqual([40, 40])
      }
      await harness.dispatch(vote)
      if (vote.command !== 'castTeamVote') throw new Error('Expected a team vote command')
      const submittedVoteLabel = vote.payload.vote === 'approve' ? '赞成' : '反对'
      await expect(
        votePage.getByText(`你已选择：${submittedVoteLabel}`, { exact: true }),
      ).toBeVisible()
      await expect(votePage.getByText(`1/${playerCount} 已投票`, { exact: true })).toBeVisible()
      await expectRoundTableFits(votePage, `${playerCount} 人游戏圆桌`)

      if (playerCount === 5) {
        const rightSideViewerIndex = (Number(vote.actor) - 4 + playerCount) % playerCount
        const rightSidePage = harness.pages[rightSideViewerIndex]!
        await rightSidePage.setViewportSize({ width: 320, height: 568 })
        const rightSideIndicatorBounds = await rightSidePage
          .locator('[data-team-vote-status]')
          .evaluate((indicator) => {
            const bounds = indicator.getBoundingClientRect()
            return { left: bounds.left, right: bounds.right, viewportWidth: window.innerWidth }
          })
        expect(rightSideIndicatorBounds.left).toBeGreaterThanOrEqual(0)
        expect(rightSideIndicatorBounds.right).toBeLessThanOrEqual(
          rightSideIndicatorBounds.viewportWidth,
        )

        const landscape = viewports[1]
        await votePage.setViewportSize(landscape)
        await expect(votePage.getByText(`你已选择：${submittedVoteLabel}`, { exact: true })).toBeVisible()
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
        for (const viewport of [
          { width: 320, height: 568 },
          { width: 504, height: 741 },
        ]) {
          await questPage.setViewportSize(viewport)
          const questBoardGeometry = await questPage
            .getByLabel('任务计分板', { exact: true })
            .evaluate((board) => {
              const table = board.closest('[data-round-table-seat-count]')!
              const tableBounds = table.getBoundingClientRect()
              const boardBounds = board.getBoundingClientRect()
              const action = board.querySelector('.quest-action')!
              const buttonGroup = board.querySelector('.phase-action-buttons')!
              const actionButton = buttonGroup.querySelector('button')!
              const readableFontSizes = Array.from(board.querySelectorAll('*'))
                .filter((element) => {
                  const bounds = element.getBoundingClientRect()
                  const style = getComputedStyle(element)
                  const hasDirectText = Array.from(element.childNodes).some(
                    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== '',
                  )
                  return hasDirectText
                    && bounds.width > 0
                    && bounds.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                })
                .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
              return {
                actionButtonFontSize: Number.parseFloat(getComputedStyle(actionButton).fontSize),
                actionButtonHeight: actionButton.getBoundingClientRect().height,
                centerDeltaX: Math.abs(
                  boardBounds.left + boardBounds.width / 2
                    - (tableBounds.left + tableBounds.width / 2),
                ),
                centerDeltaY: Math.abs(
                  boardBounds.top + boardBounds.height / 2
                    - (tableBounds.top + tableBounds.height / 2),
                ),
                minimumReadableFontSize: Math.min(...readableFontSizes),
                verticalActionSpacing:
                  Number.parseFloat(getComputedStyle(action).marginTop)
                  + Number.parseFloat(getComputedStyle(action).paddingTop)
                  + Number.parseFloat(getComputedStyle(buttonGroup).marginTop),
              }
            })
          expect(questBoardGeometry.centerDeltaX).toBeLessThanOrEqual(1)
          expect(questBoardGeometry.centerDeltaY).toBeLessThanOrEqual(1)
          expect(questBoardGeometry.minimumReadableFontSize).toBeGreaterThanOrEqual(12)
          expect(questBoardGeometry.actionButtonHeight).toBeCloseTo(40, 1)
          expect(questBoardGeometry.actionButtonFontSize).toBeCloseTo(14, 1)
          expect(questBoardGeometry.verticalActionSpacing).toBeLessThanOrEqual(12.1)
          await expectRoundTableFits(questPage, `${playerCount} 人游戏圆桌`)
        }

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
        const submittedCardLabel = questCard.payload.card === 'success' ? '成功' : '失败'
        await expect(
          questPage.getByText(`你已提交${submittedCardLabel}，等待任务结算。`, { exact: true }),
        ).toBeVisible()
      }
    } finally {
      await harness.close()
    }
  }
})
