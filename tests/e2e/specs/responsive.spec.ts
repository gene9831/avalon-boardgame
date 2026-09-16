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

async function expectRoundTableFits(page: Page, tableLabel: string) {
  const tableLocator = page.getByLabel(tableLabel, { exact: true })
  await expect(tableLocator).toHaveAttribute('data-stage-layout-status', 'ready')
  await expect.poll(() => tableLocator.evaluate((table) => {
    const tableBounds = table.getBoundingClientRect()
    const contentBounds = table.closest('.avalon-room-layout__stage-content')?.getBoundingClientRect()
    if (
      contentBounds === undefined
      || Math.round(contentBounds.width) !== Math.round(tableBounds.width)
      || Math.round(contentBounds.height) !== Math.round(tableBounds.height)
    ) return false

    return Array.from(
      table.querySelectorAll('[data-round-table-avatar], [data-round-table-nameplate]'),
    ).every((part) => {
      const bounds = part.getBoundingClientRect()
      return bounds.left >= contentBounds.left
        && bounds.right <= contentBounds.right
        && bounds.top >= contentBounds.top
        && bounds.bottom <= contentBounds.bottom
    })
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
      return Math.hypot(avatarX - centerX, avatarY - centerY) < center.width / 2 + rect.width - 1
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
  expect(geometry.centerSize?.[0], `${tableLabel} center width`).toBeCloseTo(128, 1)
  expect(geometry.centerSize?.[1], `${tableLabel} center height`).toBeCloseTo(128, 1)
  expect(geometry.seatsOutsideViewport, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.clippedSeatParts, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.overlappingSeatPairs, `${tableLabel} @ ${geometry.viewport}`).toEqual([])
  expect(geometry.centerOverlappingSeats, `${tableLabel} @ ${geometry.viewport}`).toEqual([])

  const undersizedControlLabels = await page
    .locator('[data-room-screen="true"] button:visible')
    .evaluateAll((buttons) => (
    buttons
      .filter((button) => {
        if (button.closest('[data-round-table-seat], [data-team-token]') !== null) return false
        const rect = button.getBoundingClientRect()
        const minimumSize = button.closest('[aria-label="任务计分板"]') === null ? 44 : 40
        return rect.width < minimumSize || rect.height < minimumSize
      })
      .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '')
    ))
  expect(undersizedControlLabels).toEqual([])

  return geometry
}

test('caps and centers the production solver content box inside a tall landscape stage', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  try {
    await createRoom(page, 5, 'Capped Stage Owner')
    const table = page.getByLabel('5 人游戏圆桌', { exact: true })
    await expect(table).toHaveAttribute('data-stage-layout-status', 'ready')

    const geometry = await page.locator('.avalon-room-layout__stage-content').evaluate((content) => {
      const contentBounds = content.getBoundingClientRect()
      const regionBounds = content.parentElement!.getBoundingClientRect()
      return {
        contentHeight: Math.round(contentBounds.height),
        contentWidth: Math.round(contentBounds.width),
        centeredHorizontally: Math.abs(
          contentBounds.left + contentBounds.width / 2 - (regionBounds.left + regionBounds.width / 2),
        ) <= 1,
        centeredVertically: Math.abs(
          contentBounds.top + contentBounds.height / 2 - (regionBounds.top + regionBounds.height / 2),
        ) <= 1,
      }
    })

    expect(geometry.contentWidth).toBeLessThanOrEqual(744)
    expect(geometry.contentHeight).toBeLessThanOrEqual(800)
    expect(geometry.centeredHorizontally).toBe(true)
    expect(geometry.centeredVertically).toBe(true)
  } finally {
    await context.close()
  }
})

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

test('task badges stay horizontally centered on their player avatars', async ({ page }) => {
  await page.goto('/dev/room-layout/team-vote/voter')
  const table = page.getByLabel('5 人游戏圆桌', { exact: true })
  await expect(table).toHaveAttribute('data-stage-layout-status', 'ready')

  const badgeGeometry = await table.locator('[data-seat-decoration="quest-member"]').evaluateAll((badges) => (
    badges.map((badge) => {
      const avatarBounds = badge.parentElement!.getBoundingClientRect()
      const badgeBounds = badge.getBoundingClientRect()
      const textRange = document.createRange()
      textRange.selectNodeContents(badge)
      return {
        centerOffset: Math.abs(
          avatarBounds.left + avatarBounds.width / 2 - (badgeBounds.left + badgeBounds.width / 2),
        ),
        textLineCount: textRange.getClientRects().length,
      }
    })
  ))

  expect(badgeGeometry.length).toBeGreaterThan(0)
  expect(Math.max(...badgeGeometry.map(({ centerOffset }) => centerOffset))).toBeLessThanOrEqual(1)
  expect(badgeGeometry.every(({ textLineCount }) => textLineCount === 1)).toBe(true)
})

test('task member seat numbers use compact sans-serif circles with clear row inset', async ({ page }) => {
  await page.goto('/dev/room-layout/team-vote/voter')
  const table = page.getByLabel('5 人游戏圆桌', { exact: true })
  await expect(table).toHaveAttribute('data-stage-layout-status', 'ready')

  const seatNumbers = await table.locator('[data-team-member-seat="true"]').evaluateAll((seats) => (
    seats.map((seat) => {
      const seatBounds = seat.getBoundingClientRect()
      const rowBounds = seat.parentElement!.getBoundingClientRect()
      const styles = getComputedStyle(seat)
      return {
        diameter: seatBounds.width,
        fontFamily: styles.fontFamily,
        verticalInset: Math.min(seatBounds.top - rowBounds.top, rowBounds.bottom - seatBounds.bottom),
      }
    })
  ))

  expect(seatNumbers.length).toBeGreaterThan(0)
  expect(seatNumbers.every(({ diameter }) => diameter <= 16.5)).toBe(true)
  expect(seatNumbers.every(({ fontFamily }) => fontFamily.startsWith('Inter'))).toBe(true)
  expect(seatNumbers.every(({ verticalInset }) => verticalInset >= 4)).toBe(true)
})

test('task member names use the shared sans-serif interface font', async ({ page }) => {
  await page.goto('/dev/room-layout/team-vote/voter')
  const table = page.getByLabel('5 人游戏圆桌', { exact: true })
  await expect(table).toHaveAttribute('data-stage-layout-status', 'ready')

  const fontFamilies = await table.locator('[data-team-member-name="true"]').evaluateAll((names) => (
    names.map((name) => getComputedStyle(name).fontFamily)
  ))

  expect(fontFamilies.length).toBeGreaterThan(0)
  expect(fontFamilies.every((fontFamily) => fontFamily.startsWith('Inter'))).toBe(true)
})

test('confirmed task member rows use the outer nameplate maximum without a trailing action gap', async ({ page }) => {
  await page.goto('/dev/room-layout/team-vote/voter')
  const table = page.getByLabel('5 人游戏圆桌', { exact: true })
  await expect(table).toHaveAttribute('data-stage-layout-status', 'ready')

  const geometry = await table.locator('[data-team-token-layout="vertical"]').evaluate((list) => {
    const row = list.querySelector<HTMLElement>('[data-team-token-row="true"]')!
    const name = row.querySelector<HTMLElement>('[data-team-member-name="true"]')!
    const listBounds = list.getBoundingClientRect()
    const rowBounds = row.getBoundingClientRect()
    const nameBounds = name.getBoundingClientRect()
    return {
      listWidth: listBounds.width,
      nameTrailingInset: rowBounds.right - nameBounds.right,
    }
  })

  expect.soft(geometry.listWidth).toBeCloseTo(112, 1)
  expect.soft(geometry.nameTrailingInset).toBeLessThanOrEqual(8)
})

test('empty-seat actions expose their full 44px pointer target and remain keyboard operable', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 } })
  const page = await context.newPage()
  let releaseSeatFailure: () => void = () => undefined

  try {
    const matchID = await createRoom(page, 5, 'Keyboard Seat Owner')
    const emptySeat = page.getByRole('button', { name: '移至 2 号空座位' })
    await expect(emptySeat.locator('[data-empty-seat-number="true"]')).toHaveText('2')
    const bounds = await emptySeat.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)

    await page.evaluate(() => {
      const result = { globalLoadingSeen: false, targetPendingSeen: false }
      ;(window as unknown as { seatChangeObservation: typeof result }).seatChangeObservation = result
      const observe = () => {
        result.globalLoadingSeen ||= document.body.textContent?.includes('正在进入房间') ?? false
        result.targetPendingSeen ||= document.querySelector(
          '[data-round-table-player][data-player-id="1"] [data-seat-state="pending"]',
        ) !== null
      }
      new MutationObserver(observe).observe(document.body, { childList: true, subtree: true })
      observe()
    })
    await page.mouse.click(bounds!.x + 1, bounds!.y + bounds!.height / 2)
    await expect.poll(() => page.evaluate((roomID) => {
      const raw = localStorage.getItem(`avalon:room-session:${encodeURIComponent(roomID)}`)
      return raw === null ? null : (JSON.parse(raw) as { playerID?: unknown }).playerID ?? null
    }, matchID)).toBe('1')
    await expect(page.locator('[data-round-table-player][data-player-id="1"]'))
      .toContainText('Keyboard Seat Owner')
    await expect(
      page.locator('[data-round-table-player][data-player-id="1"]'),
    ).toHaveAttribute('aria-label', /房间拥有者/)
    await expect(page.getByText('已换到 2 号位', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as {
        seatChangeObservation: { globalLoadingSeen: boolean, targetPendingSeen: boolean }
      }).seatChangeObservation
    ))).toEqual({ globalLoadingSeen: false, targetPendingSeen: true })

    await context.setOffline(true)
    await expect(page.locator('[data-room-scene="connectionRecovery"]')).toBeVisible()
    await context.setOffline(false)
    await expect(page.locator('[data-room-scene="lobby"]')).toBeVisible()

    const seatFailureReleased = new Promise<void>((resolve) => {
      releaseSeatFailure = resolve
    })
    await page.route('**/rooms/avalon/*/players/*/seat', async (route) => {
      await seatFailureReleased
      await route.fulfill({
        body: JSON.stringify({ error: { code: 'seat_unavailable' } }),
        contentType: 'application/json',
        status: 409,
      })
    })
    const sourceSeat = page.getByRole('button', { name: '移至 1 号空座位' })
    await sourceSeat.focus()
    await expect(sourceSeat).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-round-table-player][data-player-id="0"] [data-seat-state="pending"]'))
      .toBeVisible()
    releaseSeatFailure()
    await expect(page.getByText('1 号位已被占用，请选择其他空位。', { exact: true }))
      .toBeVisible()
    await expect(page.getByRole('button', { name: '移至 1 号空座位' }))
      .toContainText('1')
  } finally {
    releaseSeatFailure()
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
      await expect(roomScreen).toHaveAttribute('data-room-scene', 'lobby')
      await expect(ownerPage.getByTitle(harness.matchID, { exact: true })).toHaveText(
        `房间 ${harness.matchID.slice(0, 7)}`,
      )

      for (const viewport of roomViewports) {
        await ownerPage.setViewportSize(viewport)
        await expect(ownerPage.locator('.avalon-room-layout__stage-content')).toHaveCount(1)
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
          .locator('.avalon-room-layout__stage-content')
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
              renderedIndices,
              diagnosticIndices,
              text: stage.querySelector('.room-layout-diagnostics')?.textContent ?? '',
              width: Math.round(bounds.width),
            }
          })
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
        'data-room-scene',
        'identityConfirmation',
      )
      await expect(
        ownerPage.locator('[data-identity-confirmation-stage="concealed"]'),
      ).toBeVisible()
      await expect(
        ownerPage.locator('[data-room-slot="phase-action"]')
          .getByRole('button', { name: '揭示身份', exact: true }),
      ).toBeVisible()
      await expect(ownerPage.locator('[data-identity-role-artwork]')).toHaveCount(0)

      for (let index = startIndex + 1; index < proposeIndex; index += 1) {
        await harness.dispatch(generated.transcript[index]!)
      }

      const proposal = generated.transcript[proposeIndex]
      if (proposal?.command !== 'proposeTeam') {
        throw new Error('Generated game has no team proposal')
      }
      const leaderPage = harness.pages[Number(proposal.actor)]
      const leaderScreen = leaderPage.locator('[data-room-screen="true"]')
      await expect(leaderScreen).toHaveAttribute('data-room-scene', 'teamProposal')
      await expect(leaderPage.getByRole('button', { name: '打开帮助说明' })).toBeVisible()
      await expect(leaderPage.getByRole('button', { name: '房间操作' })).toBeVisible()
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
        const selectablePlayerID = await selectableSeat.getAttribute('data-player-id')
        if (selectablePlayerID === null) throw new Error('Selectable seat has no player ID')
        const selectedSeat = leaderPage.locator(
          `[data-round-table-player][data-player-id="${selectablePlayerID}"]`,
        )
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

        await selectedSeat
          .locator('[data-seat-pointer-target="name"]')
          .click()
        await expect(selectedSeat).toHaveAttribute('aria-pressed', 'true')
        await expect(
          leaderPage.locator('[data-room-slot="phase-middle"]'),
        ).toContainText('已选 1 /')

        await leaderPage.setViewportSize({ width: 667, height: 375 })
        await expect(leaderPage.locator('.avalon-room-layout__stage-content')).toHaveCount(1)
        await expect(selectedSeat).toHaveAttribute('aria-pressed', 'true')
        await expectRoundTableFits(leaderPage, tableLabel)

        await selectedSeat
          .locator('[data-seat-pointer-target="name"]')
          .click()
        await expect(selectedSeat).toHaveAttribute('aria-pressed', 'false')
      }
    } finally {
      await harness.close()
    }
  }
})
