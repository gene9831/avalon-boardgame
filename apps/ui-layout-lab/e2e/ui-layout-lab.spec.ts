import { expect, test } from '@playwright/test'

test('centers a bounded solver stage inside a taller device viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1366 })
  await page.goto('/?viewport=device&width=390&height=844&players=10&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-layout-status', 'ready')
  await expect(canvas).toHaveAttribute('data-stage-width', '744')
  await expect(canvas).toHaveAttribute('data-stage-height', '800')

  const centers = await page.evaluate(() => {
    const region = document.querySelector('.round-table-stage-region')!.getBoundingClientRect()
    const stage = document.querySelector('.round-table-stage')!.getBoundingClientRect()
    return {
      regionX: region.x + region.width / 2,
      regionY: region.y + region.height / 2,
      stageX: stage.x + stage.width / 2,
      stageY: stage.y + stage.height / 2,
    }
  })
  expect(centers.stageX).toBeCloseTo(centers.regionX, 5)
  expect(centers.stageY).toBeCloseTo(centers.regionY, 5)
})

test('uses the actual mobile viewport and keeps device controls concise', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:14175/?viewport=device&width=390&height=844&players=10&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-layout-status', 'ready')
  await expect(canvas).toHaveAttribute('data-table-shape', 'stadium')
  await expect(canvas).toHaveAttribute('data-avatar-size', '56')
  await expect(canvas).toHaveAttribute('data-canvas-width', '390')
  await expect(canvas).toHaveAttribute('data-canvas-height', '844')
  await expect(canvas).toHaveAttribute('data-stage-width', '366')
  await expect(canvas).toHaveAttribute('data-stage-height', '596')
  await expect(canvas).toHaveCSS('width', '390px')
  await expect(canvas).toHaveCSS('height', '844px')
  await expect(canvas.locator('.crown')).toHaveCount(1)
  await expect(canvas.locator('.crown svg.lucide-crown')).toHaveCount(1)
  const tabletopIsAboveStageBackground = await canvas.locator('.tabletop').evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return document
      .elementFromPoint(bounds.left + 4, bounds.top + bounds.height / 2)
      ?.closest('.tabletop') === element
  })
  expect(tabletopIsAboveStageBackground).toBe(true)
  await expect(page.getByRole('button', { name: '返回' }).locator('svg.lucide-chevron-left')).toBeVisible()
  await expect(page.getByRole('button', { name: '身份' }).locator('svg.lucide-eye')).toBeVisible()
  await expect(page.getByRole('button', { name: '记录' }).locator('svg.lucide-history')).toBeVisible()
  await expect(page.getByRole('button', { name: '帮助' }).locator('svg.lucide-circle-help')).toBeVisible()
  await expect(page.getByRole('button', { name: '打开布局设置' }).locator('svg.lucide-settings')).toBeVisible()

  const infoButton = page.getByRole('button', { name: '显示布局信息' })
  const readout = page.locator('.layout-readout')
  await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
  await expect(infoButton.locator('svg')).toBeVisible()
  await expect(readout).toBeHidden()
  const infoPlacement = await page.evaluate(() => {
    const topbarBounds = document.querySelector('.room-topbar')!.getBoundingClientRect()
    const stageBounds = document.querySelector('.round-table-stage-region')!.getBoundingClientRect()
    const buttonBounds = document.querySelector('.stage-info-trigger')!.getBoundingClientRect()
    return {
      buttonTop: buttonBounds.top,
      stageTop: stageBounds.top,
      topbarBottom: topbarBounds.bottom,
    }
  })
  expect(infoPlacement.buttonTop).toBeGreaterThanOrEqual(infoPlacement.stageTop)
  expect(infoPlacement.buttonTop).toBeGreaterThanOrEqual(infoPlacement.topbarBottom)

  await infoButton.click()
  const hideInfoButton = page.getByRole('button', { name: '隐藏布局信息' })
  await expect(hideInfoButton).toHaveAttribute('aria-expanded', 'true')
  await expect(readout).toBeVisible()
  await expect(readout).toContainText('390 × 844 · 舞台 366 × 596')
  await expect(readout).toContainText('头像 56px')
  const readoutPlacement = await page.evaluate(() => {
    const buttonBounds = document.querySelector('.stage-info-trigger')!.getBoundingClientRect()
    const readout = document.querySelector('.layout-readout')!
    const readoutBounds = readout.getBoundingClientRect()
    return {
      buttonTop: buttonBounds.top,
      readoutBottom: readoutBounds.bottom,
      readoutHeight: readoutBounds.height,
      whiteSpace: getComputedStyle(readout).whiteSpace,
    }
  })
  expect(readoutPlacement.readoutBottom).toBeLessThanOrEqual(readoutPlacement.buttonTop)
  expect(readoutPlacement.readoutHeight).toBeGreaterThan(24)
  expect(readoutPlacement.whiteSpace).toBe('normal')
  const readoutIsFrontmost = await readout.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return document
      .elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      ?.closest('.layout-readout') === element
  })
  expect(readoutIsFrontmost).toBe(true)

  await hideInfoButton.click()
  await expect(page.getByRole('button', { name: '显示布局信息' })).toHaveAttribute('aria-expanded', 'false')
  await expect(readout).toBeHidden()

  const phaseSectionHeights = await page
    .locator('.phase-header, .phase-middle, .phase-action')
    .evaluateAll((sections) => sections.map((section) => section.getBoundingClientRect().height))
  expect(phaseSectionHeights).toEqual([48, 56, 56])
  await expect(page.locator('.phase-bottom-clearance')).toHaveCSS('height', '8px')
  const bottomActionClearance = await page.evaluate(() => {
    const canvasBounds = document
      .querySelector('.room-canvas')!
      .getBoundingClientRect()
    const buttonBounds = document
      .querySelector('.phase-action button')!
      .getBoundingClientRect()
    return canvasBounds.bottom - buttonBounds.bottom
  })
  expect(bottomActionClearance).toBe(14)
  const phaseTitleHeight = await page
    .locator('.phase-title')
    .evaluate((title) => title.getBoundingClientRect().height)
  expect(phaseTitleHeight).toBeLessThanOrEqual(24)

  const layoutBeforeSettingsOpen = await page.evaluate(() => ({
    shellTop: document.querySelector('.lab-shell')!.getBoundingClientRect().top,
    workbenchHeight: document.querySelector('.preview-workbench')!.getBoundingClientRect().height,
    scrollY: window.scrollY,
  }))
  await page.getByRole('button', { name: '打开布局设置' }).click()
  const settingsTrigger = page.getByRole('button', { name: '打开布局设置' })
  const settingsDialog = page.getByRole('dialog', { name: '预览设置' })
  await expect(settingsDialog).toBeVisible()
  await expect(settingsDialog.getByRole('button', { name: '关闭设置' }).locator('svg.lucide-x')).toBeVisible()
  const layoutAfterSettingsOpen = await page.evaluate(() => ({
    shellTop: document.querySelector('.lab-shell')!.getBoundingClientRect().top,
    workbenchHeight: document.querySelector('.preview-workbench')!.getBoundingClientRect().height,
    scrollY: window.scrollY,
    dialogPosition: getComputedStyle(document.querySelector('.settings-dialog')!).position,
  }))
  expect(layoutAfterSettingsOpen).toEqual({
    ...layoutBeforeSettingsOpen,
    dialogPosition: 'fixed',
  })
  expect(await settingsDialog.evaluate((dialog) => dialog.matches(':modal'))).toBe(false)
  await expect(settingsTrigger).toBeFocused()
  await expect(settingsDialog.locator('[name="avatarSizeStep"]')).toHaveAttribute('min', '4')
  await expect(settingsDialog.locator('[name="avatarSizeStep"]')).toHaveAttribute('step', '4')
  const stageInfoHitTest = await page.evaluate(() => {
    const button = document.querySelector('.stage-info-trigger')!
    const bounds = button.getBoundingClientRect()
    return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      ?.closest('.stage-info-trigger') !== null
  })
  expect(stageInfoHitTest).toBe(true)
  const stageBounds = await page.locator('.round-table-stage').boundingBox()
  if (stageBounds === null) throw new Error('Expected the round-table stage bounds')
  await page.mouse.click(stageBounds.x + 4, stageBounds.y + 4)
  await expect(settingsDialog).toBeHidden()
  await settingsTrigger.click()
  await page.keyboard.press('Escape')
  await expect(settingsDialog).toBeHidden()
  await settingsTrigger.click()
  await expect(page.getByText('100dvw × 100dvh')).toBeVisible()
  const backdropStyles = await page.locator('.settings-dialog').evaluate((dialog) => {
    const styles = getComputedStyle(dialog, '::backdrop')
    return {
      backdropFilter: styles.backdropFilter,
      backgroundColor: styles.backgroundColor,
    }
  })
  expect(backdropStyles).toEqual({
    backdropFilter: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  })
  await expect(page.locator('.simulation-fields')).toBeHidden()
  await expect(page.getByLabel('玩家人数')).toBeVisible()
  await expect(page.getByLabel('最大头像尺寸')).toHaveValue('56')
  await expect(page.getByLabel('头像递减步长')).toHaveValue('8')
  await expect(page.getByText('显示几何边界')).toBeVisible()

  const settingsFieldFontSizes = await page
    .locator('.settings-form input[type="number"], .settings-form select')
    .evaluateAll((fields) => fields.map((field) => (
      Number.parseFloat(getComputedStyle(field).fontSize)
    )))
  expect(Math.min(...settingsFieldFontSizes)).toBeGreaterThanOrEqual(16)

  const buttonDimensions = await page.locator('button:visible').evaluateAll((buttons) => (
    buttons.map((button) => {
      const bounds = button.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    })
  ))
  expect(buttonDimensions.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true)
})

test('restores remembered simulated dimensions after leaving device mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:14175/?viewport=device&width=430&height=932&players=10&geometry=0')
  await page.getByRole('button', { name: '打开布局设置' }).click()
  await page.getByRole('switch', { name: /使用设备尺寸/ }).uncheck()

  await expect(page.locator('.simulation-fields')).toBeVisible()
  await expect(page.getByLabel('宽度')).toHaveValue('430')
  await expect(page.getByLabel('高度')).toHaveValue('932')
  await expect(page).toHaveURL(/viewport=simulated&width=430&height=932&players=10&gap=8&maxAvatarSize=56&avatarSizeStep=8&geometry=0/)
  await expect(page.getByLabel('Avalon 房间布局预览')).toHaveAttribute('data-avatar-size', '56')
})

test('renders Euclidean geometry diagnostics for the 430 by 932 baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=430&height=932&players=10&geometry=1')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-avatar-size', '56')
  await expect(canvas).toHaveAttribute('data-table-shape', 'stadium')
  await expect(canvas).toHaveAttribute('data-stage-width', '406')
  await expect(canvas).toHaveAttribute('data-stage-height', '684')
  await expect(canvas.locator('.player-seat')).toHaveCount(10)
  const renderedSeatBounds = await canvas.locator('.player-seat').evaluateAll((seats) => seats.map((seat) => {
    const bounds = seat.getBoundingClientRect()
    return { width: bounds.width, height: bounds.height }
  }))
  for (const bounds of renderedSeatBounds) {
    expect(Math.abs(bounds.width - bounds.height)).toBeLessThanOrEqual(0.1)
  }
  await expect(canvas.locator('.round-table-footprint')).toHaveCount(1)
  await expect(canvas.locator('.placement-guide')).toHaveCount(1)
  await expect(canvas.locator('.center-panel-protection')).toHaveCount(1)
  await expect(canvas.locator('.gap-line')).toHaveCount(10)
  await expect(canvas).toHaveAttribute('data-show-geometry', '')

  const firstGap = canvas.locator('.gap-line').first()
  await expect(firstGap).toHaveAttribute('style', /transform:rotate\(/)
  await expect(firstGap).toHaveAttribute('title', /玩家圆边界间距 \d+(?:\.\d+)?px/)
})

test('draws a diagonal Euclidean gap segment on the circular layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=768&height=1024&players=5&geometry=1')

  const diagonalGap = await page.locator('.gap-line').evaluateAll((lines) => lines
    .map((line) => ({ style: line.getAttribute('style'), title: line.getAttribute('title') }))
    .find(({ style }) => {
      const angle = style?.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/)?.[1]
      return angle !== undefined && Math.abs(Number(angle) % 90) > 0.01
    }))
  expect(diagonalGap?.style).toContain('transform:rotate(')
  expect(diagonalGap?.title).toMatch(/玩家圆边界间距 \d+(?:\.\d+)?px/)
})

const confirmedBusinessViewports = [
  [{ width: 375, height: 667 }, { stageWidth: 359, stageHeight: 435, avatarSize: 36, shape: 'circle' }],
  [{ width: 390, height: 844 }, { stageWidth: 366, stageHeight: 596, avatarSize: 56, shape: 'stadium' }],
  [{ width: 430, height: 932 }, { stageWidth: 406, stageHeight: 684, avatarSize: 56, shape: 'stadium' }],
  [{ width: 768, height: 1024 }, { stageWidth: 744, stageHeight: 776, avatarSize: 56, shape: 'circle' }],
 ] as const

for (const [viewport, expected] of confirmedBusinessViewports) {
  test(`resolves the confirmed ${viewport.width} by ${viewport.height} business viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 })
    await page.goto(`http://127.0.0.1:14175/?viewport=simulated&width=${viewport.width}&height=${viewport.height}&players=10&geometry=0`)

    const canvas = page.getByLabel('Avalon 房间布局预览')
    await expect(canvas).toHaveAttribute('data-stage-width', String(expected.stageWidth))
    await expect(canvas).toHaveAttribute('data-stage-height', String(expected.stageHeight))
    await expect(canvas).toHaveAttribute('data-avatar-size', String(expected.avatarSize))
    await expect(canvas).toHaveAttribute('data-table-shape', expected.shape)
  })
}

test('keeps the confirmed monotone avatar tiers for 5 to 10 players', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  const avatarSizes: number[] = []

  for (const [playerCount, expectedAvatarSize] of [
    [5, 56], [6, 56], [7, 56], [8, 56], [9, 48], [10, 48],
  ]) {
    await page.goto(`http://127.0.0.1:14175/?viewport=simulated&width=402&height=714&players=${playerCount}&gap=4&maxAvatarSize=56&avatarSizeStep=8&geometry=0`)
    const avatarSize = Number(await page.getByLabel('Avalon 房间布局预览').getAttribute('data-avatar-size'))
    expect(avatarSize).toBe(expectedAvatarSize)
    avatarSizes.push(avatarSize)
  }

  expect(avatarSizes.every((size, index) => index === 0 || size <= avatarSizes[index - 1]!)).toBe(true)
})

test('keeps settings available when wide-stage strategy is pending', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('http://127.0.0.1:14175/?viewport=device&players=10')

  await expect(page.getByLabel('Avalon 房间布局预览')).toHaveAttribute('data-canvas-width', '844')
  await expect(page.getByText('wide-stage-strategy-pending', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '返回' })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认队伍 · 2/4' })).toBeVisible()
  await page.getByRole('button', { name: '打开布局设置' }).click()
  await expect(page.getByRole('dialog', { name: '预览设置' })).toBeVisible()
})

test('lets the preview lower the player-circle gap at 402 by 714', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=402&height=714&players=10&gap=6&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-stage-width', '386')
  await expect(canvas).toHaveAttribute('data-stage-height', '482')
  await expect(canvas).toHaveAttribute('data-avatar-size', '48')

  await page.getByRole('button', { name: '打开布局设置' }).click()
  const gapInput = page.getByLabel('玩家圆边界最小间距')
  await expect(gapInput).toHaveValue('6')
  await gapInput.fill('8')
  await gapInput.press('Tab')

  await expect(canvas).toHaveAttribute('data-avatar-size', '48')
  await expect(page).toHaveURL(/gap=8/)
})

test('lets the preview control the avatar ceiling and decrement step', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=402&height=714&players=10&gap=8&maxAvatarSize=56&avatarSizeStep=20&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-avatar-size', '36')
  await expect(page.locator('.layout-readout')).toHaveText(
    '402 × 714 · 舞台 386 × 482 · 10 人 · 头像 36px · 圆形',
  )

  await page.getByRole('button', { name: '打开布局设置' }).click()
  await expect(page.getByLabel('最大头像尺寸')).toHaveValue('56')
  await expect(page.getByLabel('头像递减步长')).toHaveValue('20')
  await page.getByLabel('最大头像尺寸').fill('48')
  await page.getByLabel('最大头像尺寸').press('Tab')

  await expect(page).toHaveURL(/maxAvatarSize=48&avatarSizeStep=20/)
})
