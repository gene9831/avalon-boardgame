import { expect, test, type Page } from '@playwright/test'

import { playGeneratedGame } from '@avalon/test-support'

import { createBrowserReplayHarness, createRoom } from '../support/browser-replay'

const roomViewports = [
  { width: 375, height: 667 },
  { width: 667, height: 375 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
]

function expectedShellMode({ width, height }: { width: number; height: number }) {
  if (width <= height) return 'vertical'
  return height < 515 ? 'compact-landscape' : 'normal-landscape'
}

async function expectRoundTableFits(page: Page, tableLabel: string) {
  const tableLocator = page.getByLabel(tableLabel, { exact: true })
  await expect(tableLocator).toHaveAttribute('data-stage-layout-status', 'ready')
  await expect.poll(() => tableLocator.evaluate((table) => {
    const bounds = table.getBoundingClientRect()
    const stage = table.parentElement
    return Number(stage?.getAttribute('data-stage-layout-width')) === Math.round(bounds.width)
      && Number(stage?.getAttribute('data-stage-layout-height')) === Math.round(bounds.height)
  })).toBe(true)

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

  const geometry = await tableLocator.evaluate((table) => {
    const tableRect = table.getBoundingClientRect()
    const seatRects = Array.from(table.querySelectorAll('[data-round-table-seat]'))
      .map((seat) => Array.from(seat.querySelectorAll('[data-round-table-avatar], [data-round-table-nameplate]'))
        .map((part) => ({
          kind: part.hasAttribute('data-round-table-avatar') ? 'avatar' : 'nameplate',
          rect: part.getBoundingClientRect(),
        })))
    const center = table.querySelector('[data-round-table-center]')?.getBoundingClientRect()
    const clippingRect = table.getBoundingClientRect()
    const intersects = (left: DOMRect, right: DOMRect, tolerance = 1) => (
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance
      && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance
    )
    const overlapsCenterProtection = (kind: string, rect: DOMRect) => {
      if (center === undefined) return true
      if (kind !== 'avatar') return false
      const centerX = center.left + center.width / 2
      const centerY = center.top + center.height / 2
      const avatarX = rect.left + rect.width / 2
      const avatarY = rect.top + rect.height / 2
      return Math.hypot(avatarX - centerX, avatarY - centerY) < 80 + rect.width - 1
    }
    const maxAvatarWidth = Math.max(
      ...Array.from(table.querySelectorAll('[data-round-table-avatar]'))
        .map((avatar) => avatar.getBoundingClientRect().width),
    )
    return {
      centerOverlappingSeats: center === undefined
        ? ['missing-center']
        : seatRects.flatMap((seat, index) => seat.flatMap(({ kind, rect }) => (
          overlapsCenterProtection(kind, rect)
          ? [`${index + 1}:${kind}`]
          : []))),
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
      layoutStatus: table.getAttribute('data-stage-layout-status'),
      tableSize: Math.max(tableRect.width, tableRect.height),
      centerSize: center === undefined ? null : [center.width, center.height],
      maxAvatarWidth,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    }
  })

  expect(geometry.layoutStatus, `${tableLabel} @ ${geometry.viewport}`).toBe('ready')
  expect(geometry.maxAvatarWidth, `${tableLabel} @ ${geometry.viewport}`).toBeGreaterThanOrEqual(35.5)
  expect(geometry.maxAvatarWidth, `${tableLabel} @ ${geometry.viewport}`).toBeLessThanOrEqual(56.5)
  expect(geometry.centerSize?.[0], `${tableLabel} center width`).toBeCloseTo(152, 1)
  expect(geometry.centerSize?.[1], `${tableLabel} center height`).toBeCloseTo(152, 1)
  expect(geometry.seatsOutsideViewport, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.clippedSeatParts, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.overlappingSeatPairs, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.centerOverlappingSeats, `${tableLabel} @ ${geometry.viewport}`).toEqual([])

  const undersizedControlLabels = await page
    .locator('[data-room-screen="true"] button:visible')
    .evaluateAll((buttons) => (
    buttons
      .filter((button) => {
        if (button.hasAttribute('data-round-table-player')) return false
        const rect = button.getBoundingClientRect()
        const minimumSize = button.closest('[aria-label="任务计分板"]') === null ? 44 : 40
        return rect.width < minimumSize || rect.height < minimumSize
      })
      .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '')
    ))
  expect(undersizedControlLabels).toEqual([])

  return geometry
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
      page.locator('[data-round-table-player][data-player-id="1"]'),
    ).toHaveAttribute('aria-label', /房间拥有者/)
  } finally {
    await context.close()
  }
})

test('five, seven, and ten-player rooms keep one measured shell across lobby and play', async ({
  browser,
}) => {
  test.setTimeout(180_000)

  for (const playerCount of [5, 7, 10]) {
    const generated = playGeneratedGame({
      masterSeed: process.env.E2E_MASTER_SEED ?? 'playwright-smoke',
      playerCount,
    })
    const harness = await createBrowserReplayHarness({ browser, playerCount })

    try {
      const ownerPage = harness.pages[0]
      const tableLabel = `${playerCount} 人游戏圆桌`
      const roomScreen = ownerPage.locator('[data-room-screen="true"]')

      await expect(roomScreen).toHaveCount(1)
      await expect(ownerPage.locator('[data-room-stage="true"]')).toHaveCount(1)
      await expect(roomScreen).toHaveAttribute('data-room-mode', 'lobby')
      await expect(ownerPage.locator('h1')).toHaveText(
        `房间 ${harness.matchID.slice(0, 7)}`,
      )

      for (const viewport of roomViewports) {
        await ownerPage.setViewportSize(viewport)
        await expect(roomScreen).toHaveAttribute(
          'data-room-layout-mode',
          expectedShellMode(viewport),
        )
        await expectRoundTableFits(ownerPage, tableLabel)

        const questNodes = ownerPage
          .getByLabel('五次任务进度')
          .locator('.quest-progress-node')
        await expect(questNodes).toHaveCount(5)
        const questGeometry = await questNodes.evaluateAll((nodes) => nodes.map((node) => {
          const bounds = node.getBoundingClientRect()
          const metadata = node.querySelector('.quest-progress-meta')
          const metadataBounds = metadata?.getBoundingClientRect()
          return {
            height: bounds.height,
            metadataFontSize: metadata === null
              ? 0
              : Number.parseFloat(getComputedStyle(metadata).fontSize),
            metadataInside: metadataBounds !== undefined
              && metadataBounds.left >= bounds.left
              && metadataBounds.right <= bounds.right
              && metadataBounds.bottom <= bounds.bottom,
            width: bounds.width,
          }
        }))
        expect(questGeometry.every(({ height, width }) => height === 44 && width === 44))
          .toBe(true)
        expect(questGeometry.every(({ metadataFontSize, metadataInside }) => (
          metadataFontSize >= 12 && metadataInside
        ))).toBe(true)

        const visiblePhaseAction = ownerPage
          .locator('[data-room-slot="phase-action"] button:visible')
          .first()
        await expect(visiblePhaseAction).toBeVisible()
        const phaseActionBounds = await visiblePhaseAction.boundingBox()
        expect(phaseActionBounds).not.toBeNull()
        expect(
          phaseActionBounds!.y + phaseActionBounds!.height,
        ).toBeLessThanOrEqual(viewport.height)
      }

      if (playerCount === 5) {
        await ownerPage.goto(
          `/rooms/${harness.matchID}?layoutDebug=geometry`,
        )
        await expect(ownerPage.locator('.room-layout-diagnostics')).toBeVisible()
        await expect(ownerPage.locator('.room-layout-geometry')).toBeVisible()
        const diagnosticGeometry = await ownerPage
          .locator('.avalon-room-shell__stage-content')
          .evaluate((stage) => {
            const bounds = stage.getBoundingClientRect()
            const renderedIndices = Array.from(
              stage.querySelectorAll('[data-round-table-seat]'),
              (seat) => seat.getAttribute('data-relative-seat-index'),
            )
            const diagnosticIndices = Array.from(
              stage.querySelectorAll('.room-layout-geometry g'),
              (group) => group.getAttribute('data-relative-seat-index'),
            )
            return {
              height: Math.round(bounds.height),
              heightAttribute: Number(stage.getAttribute('data-stage-layout-height')),
              renderedIndices,
              diagnosticIndices,
              text: stage.querySelector('.room-layout-diagnostics')?.textContent ?? '',
              width: Math.round(bounds.width),
              widthAttribute: Number(stage.getAttribute('data-stage-layout-width')),
            }
          })
        expect(diagnosticGeometry.widthAttribute).toBe(diagnosticGeometry.width)
        expect(diagnosticGeometry.heightAttribute).toBe(diagnosticGeometry.height)
        expect(diagnosticGeometry.text).toContain(
          `stage ${diagnosticGeometry.width}×${diagnosticGeometry.height}`,
        )
        expect(diagnosticGeometry.diagnosticIndices).toEqual(
          diagnosticGeometry.renderedIndices,
        )
      }

      const startIndex = generated.transcript.findIndex(
        ({ command }) => command === 'startGame',
      )
      const proposeIndex = generated.transcript.findIndex(
        ({ command }) => command === 'proposeTeam',
      )
      expect(startIndex).toBeGreaterThanOrEqual(0)
      expect(proposeIndex).toBeGreaterThan(startIndex)

      await ownerPage.getByRole('button', { name: '开始游戏' }).click()
      await expect(roomScreen).toHaveCount(1)
      await expect(ownerPage.locator('[data-room-stage="true"]')).toHaveCount(1)
      await expect(roomScreen).toHaveAttribute(
        'data-room-mode',
        'identityRecognition',
      )
      await expect(ownerPage.locator('[data-curtain-state]')).toBeVisible()

      for (let index = startIndex + 1; index < proposeIndex; index += 1) {
        await harness.dispatch(generated.transcript[index]!)
      }

      const proposal = generated.transcript[proposeIndex]
      if (proposal?.command !== 'proposeTeam') {
        throw new Error('Generated game has no team proposal')
      }
      const leaderPage = harness.pages[Number(proposal.actor)]
      const leaderScreen = leaderPage.locator('[data-room-screen="true"]')
      await expect(leaderScreen).toHaveAttribute('data-room-mode', 'teamProposal')
      await expect(leaderPage.getByRole('button', { name: '打开帮助说明' })).toBeVisible()
      await expect(leaderPage.getByRole('button', { name: '查看对局记录' })).toBeVisible()
      await expect(
        leaderPage.getByRole('button', { name: '查看我的身份与已知信息' }),
      ).toBeVisible()
      await expect(
        leaderPage.getByRole('button', { name: '打开用户中心' }),
      ).toHaveCount(0)

      if (playerCount === 5) {
        await leaderPage.setViewportSize({ width: 375, height: 667 })
        const selectableSeat = leaderPage.getByRole('button', {
          name: /加入任务队伍/,
        }).first()
        const hitRegions = await selectableSeat.evaluate((button) => {
          const avatar = button.querySelector<HTMLElement>(
            '[data-seat-pointer-target="avatar"]',
          )!
          const name = button.querySelector<HTMLElement>(
            '[data-seat-pointer-target="name"]',
          )!
          const avatarRect = avatar.getBoundingClientRect()
          const nameRect = name.getBoundingClientRect()
          const hitsButton = (x: number, y: number) => {
            const target = document.elementFromPoint(x, y)
            return target?.closest('button') === button
          }
          return hitsButton(
            avatarRect.left + avatarRect.width / 2,
            (avatarRect.bottom + nameRect.top) / 2,
          )
        })
        expect(hitRegions).toBe(false)

        await selectableSeat
          .locator('[data-seat-pointer-target="avatar"]')
          .click()
        await expect(selectableSeat).toHaveAttribute('aria-pressed', 'true')
        await expect(
          leaderPage.locator('[data-room-slot="phase-middle"]'),
        ).toContainText('已选 1 /')

        await leaderPage.setViewportSize({ width: 667, height: 375 })
        await expect(leaderScreen).toHaveAttribute(
          'data-room-layout-mode',
          'compact-landscape',
        )
        await expect(selectableSeat).toHaveAttribute('aria-pressed', 'true')
        await expectRoundTableFits(leaderPage, tableLabel)

        await selectableSeat
          .locator('[data-seat-pointer-target="name"]')
          .click()
        await expect(selectableSeat).toHaveAttribute('aria-pressed', 'false')
      }
    } finally {
      await harness.close()
    }
  }
})
