import { expect, test } from '@playwright/test'

test('uses the actual mobile viewport and keeps device controls concise', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:14175/?viewport=device&width=390&height=844&players=10&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-layout-status', 'ready')
  await expect(canvas).toHaveAttribute('data-table-shape', 'stadium')
  await expect(canvas).toHaveAttribute('data-avatar-size', '48')
  await expect(canvas).toHaveAttribute('data-canvas-width', '390')
  await expect(canvas).toHaveAttribute('data-canvas-height', '844')
  await expect(canvas).toHaveAttribute('data-stage-width', '366')
  await expect(canvas).toHaveAttribute('data-stage-height', '596')
  await expect(canvas).toHaveCSS('width', '390px')
  await expect(canvas).toHaveCSS('height', '844px')
  await expect(canvas.locator('.crown')).toHaveCount(1)

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
  await expect(readout).toContainText('头像 48px')

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

  await page.getByRole('button', { name: '打开布局设置' }).click()
  await expect(page.getByRole('dialog', { name: '预览设置' })).toBeVisible()
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

test('renders returned diagnostics for the 430 by 932 baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=430&height=932&players=10&geometry=1')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-avatar-size', '56')
  await expect(canvas).toHaveAttribute('data-table-shape', 'stadium')
  await expect(canvas).toHaveAttribute('data-stage-width', '406')
  await expect(canvas).toHaveAttribute('data-stage-height', '684')
  await expect(canvas.locator('.player-seat')).toHaveCount(10)
  await expect(canvas.locator('.round-table-footprint')).toHaveCount(1)
  await expect(canvas.locator('.gap-line')).toHaveCount(10)
  await expect(canvas.locator('.gap-line.center')).toHaveCount(2)
  await expect(canvas).toHaveAttribute('data-show-geometry', '')
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

test('lets the preview lower the player-seat gap at 402 by 714', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=402&height=714&players=10&gap=6&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-stage-width', '386')
  await expect(canvas).toHaveAttribute('data-stage-height', '482')
  await expect(canvas).toHaveAttribute('data-avatar-size', '48')

  await page.getByRole('button', { name: '打开布局设置' }).click()
  const gapInput = page.getByLabel('玩家边界最小间距')
  await expect(gapInput).toHaveValue('6')
  await gapInput.fill('8')
  await gapInput.press('Tab')

  await expect(canvas).toHaveAttribute('data-avatar-size', '40')
  await expect(page).toHaveURL(/gap=8/)
})

test('lets the preview control the avatar ceiling and decrement step', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=402&height=714&players=10&gap=8&maxAvatarSize=56&avatarSizeStep=20&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-avatar-size', '36')
  await expect(page.locator('.layout-readout')).toHaveText(
    '402 × 714 · 10 人 · 头像 36px · 跑道 · 直线 1px',
  )

  await page.getByRole('button', { name: '打开布局设置' }).click()
  await expect(page.getByLabel('最大头像尺寸')).toHaveValue('56')
  await expect(page.getByLabel('头像递减步长')).toHaveValue('20')
  await page.getByLabel('最大头像尺寸').fill('48')
  await page.getByLabel('最大头像尺寸').press('Tab')

  await expect(page).toHaveURL(/maxAvatarSize=48&avatarSizeStep=20/)
})
