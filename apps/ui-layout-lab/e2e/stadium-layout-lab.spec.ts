import { expect, test } from '@playwright/test'

test('renders the standalone default stadium model without room chrome', async ({ page }) => {
  await page.goto('/stadium-layout-lab.html')
  const stage = page.getByLabel('跑道玩家圆形布局画布')
  await expect(stage).toHaveAttribute('data-layout-status', 'ready')
  await expect(stage).toHaveAttribute('data-stage-width', '386')
  await expect(stage).toHaveAttribute('data-stage-height', '482')
  await expect(stage.locator('.player-boundary-circle')).toHaveCount(5)
  await expect(stage.locator('.avatar-circle')).toHaveCount(5)
  await expect(stage.locator('.seat-index')).toHaveCount(5)
  await expect(stage.locator('.centerline')).toHaveCount(1)
  await expect(stage.locator('.maximum-center-protection-circle')).toHaveCount(1)
  await expect(stage.locator('.maximum-center-protection-diagnostic text')).toHaveText('r=80.99px')
  await expect(page.locator('.room-topbar, .tabletop, .center-panel, .phase-panel')).toHaveCount(0)
})

test('restores a valid model and diagnostics from the URL', async ({ page }) => {
  await page.goto('/stadium-layout-lab.html?maxStageWidth=240&maxStageHeight=800&players=10&avatarSize=56&minimumGap=4&centerProtectionRadius=0&diagnostics=1')
  const stage = page.getByLabel('跑道玩家圆形布局画布')
  await expect(stage).toHaveAttribute('data-layout-status', 'ready')
  await expect(stage).toHaveAttribute('data-shape', 'stadium')
  await expect(stage.locator('.player-boundary-circle')).toHaveCount(10)
  await expect(stage.locator('.gap-diagnostic')).toHaveCount(10)
  await expect(stage.locator('.occupied-bounds')).toHaveCount(1)
})

test('canonicalizes partial, noncanonical, and oversized URL state without changing the resolved model', async ({ page }) => {
  await page.goto('/stadium-layout-lab.html?players=7&maxStageWidth=not-a-number&maxStageHeight=801&diagnostics=maybe')
  const stage = page.getByLabel('跑道玩家圆形布局画布')
  await expect(stage).toHaveAttribute('data-layout-status', 'ready')
  await expect(stage.locator('.player-boundary-circle')).toHaveCount(7)
  await expect(page).toHaveURL('/stadium-layout-lab.html?maxStageWidth=386&maxStageHeight=482&players=7&avatarSize=56&minimumGap=4&centerProtectionRadius=0&diagnostics=1')
})

test('keeps SVG seat and gap labels readable when a large stage is scaled on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/stadium-layout-lab.html?maxStageWidth=700&maxStageHeight=800&players=5&avatarSize=56&minimumGap=4&diagnostics=1')
  await expect(page.getByLabel('跑道玩家圆形布局画布').locator('.seat-index').first()).toHaveJSProperty('textContent', '0')
  const labelHeights = await page.locator('.seat-index, .gap-diagnostic text').evaluateAll((labels) => (
    labels.map((label) => label.getBoundingClientRect().height)
  ))
  expect(labelHeights.every((height) => height >= 12)).toBe(true)
})

test('keeps numeric settings at an iOS-safe text size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/stadium-layout-lab.html')
  await page.getByRole('button', { name: '打开跑道布局设置' }).click()

  const inputFontSizes = await page.locator('input[type="number"]').evaluateAll((inputs) => (
    inputs.map((input) => Number.parseFloat(getComputedStyle(input).fontSize))
  ))

  expect(inputFontSizes).toHaveLength(5)
  expect(Math.min(...inputFontSizes)).toBeGreaterThanOrEqual(16)
})

test('updates valid inputs immediately and retains the last frame while a draft is invalid', async ({ page }) => {
  await page.goto('/stadium-layout-lab.html')
  await page.getByRole('button', { name: '打开跑道布局设置' }).click()
  const stage = page.getByLabel('跑道玩家圆形布局画布')
  const previousMarkup = await stage.locator('svg').innerHTML()
  const width = page.getByLabel('舞台宽度')

  await width.fill('400')
  await expect(stage).toHaveAttribute('data-stage-width', '400')
  await expect(page).toHaveURL(/maxStageWidth=400/)

  const validMarkup = await stage.locator('svg').innerHTML()
  await width.fill('')
  await expect(page.getByRole('status')).toContainText('舞台宽度必须是有限正数')
  await expect(stage.locator('svg')).toHaveJSProperty('innerHTML', validMarkup)
  await expect(page).toHaveURL(/maxStageWidth=400/)
  expect(validMarkup).not.toBe(previousMarkup)

  await width.fill('386')
  await expect(page.getByRole('status')).toBeEmpty()
  await expect(page).toHaveURL(/maxStageWidth=386/)
})

test('keeps the settings panel non-modal and supports every close/reset path', async ({ page }) => {
  await page.goto('/stadium-layout-lab.html')
  const trigger = page.getByRole('button', { name: '打开跑道布局设置' })
  await trigger.click()
  const panel = page.getByRole('dialog', { name: '跑道布局设置' })
  await expect(panel).toHaveAttribute('aria-modal', 'false')
  await expect(panel).toBeVisible()
  expect(await page.evaluate(() => document.querySelector('[role="dialog"]')?.parentElement === document.body)).toBe(true)
  expect(await page.evaluate(() => document.body.inert)).toBe(false)
  expect(await page.evaluate(() => {
    const stage = document.querySelector('.stadium-stage')!
    const bounds = stage.getBoundingClientRect()
    const element = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return element?.closest('.stadium-stage') === stage
  })).toBe(true)

  await page.getByRole('button', { name: '8 人' }).click()
  await expect(page.getByLabel('跑道玩家圆形布局画布').locator('.player-boundary-circle')).toHaveCount(8)
  await page.getByRole('switch', { name: '显示诊断' }).uncheck()
  await expect(page.locator('.gap-diagnostic, .occupied-bounds, .maximum-center-protection-diagnostic')).toHaveCount(0)
  await page.getByRole('button', { name: '恢复默认值' }).click()
  await expect(page.getByLabel('舞台宽度')).toHaveValue('386')
  await expect(page.getByRole('button', { name: '5 人' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('button', { name: '关闭跑道布局设置' }).click()
  await expect(panel).toBeHidden()
  await trigger.click()
  await page.getByRole('button', { name: '收起跑道布局设置' }).click()
  await expect(panel).toBeHidden()
})

test('opens settings without focusing an input and closes on an outside click', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/stadium-layout-lab.html')
  const trigger = page.getByRole('button', { name: '打开跑道布局设置' })
  await trigger.click()

  const panel = page.getByRole('dialog', { name: '跑道布局设置' })
  await expect(panel).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭跑道布局设置' })).toBeFocused()
  await expect(panel.locator('input[type="number"]:focus')).toHaveCount(0)

  await panel.getByText('布局参数').click()
  await expect(panel).toBeVisible()

  await page.locator('.stadium-workbench').click({ position: { x: 8, y: 8 } })
  await expect(panel).toBeHidden()
  await expect(trigger).not.toBeFocused()
})

test('keeps controls usable through no-fitting output and recovers on a valid stage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/stadium-layout-lab.html')
  await page.getByRole('button', { name: '打开跑道布局设置' }).click()
  const stage = page.getByLabel('跑道玩家圆形布局画布')
  await page.getByLabel('舞台宽度').fill('112')
  await expect(stage).toHaveAttribute('data-layout-status', 'unavailable')
  await expect(stage.getByText('no-fitting-layout')).toBeVisible()
  await expect(page.getByRole('dialog', { name: '跑道布局设置' })).toBeVisible()
  expect(await page.evaluate(() => document.body.inert)).toBe(false)
  expect(await page.evaluate(() => document.querySelector('.stadium-settings-panel')?.matches('dialog[open]'))).toBe(false)

  await page.getByLabel('舞台宽度').fill('386')
  await expect(stage).toHaveAttribute('data-layout-status', 'ready')
  await expect(stage.locator('.player-boundary-circle')).toHaveCount(5)
})

test('persists and visualizes the circular center protection radius', async ({ page }) => {
  await page.goto('/stadium-layout-lab.html')
  await page.getByRole('button', { name: '打开跑道布局设置' }).click()
  const stage = page.getByLabel('跑道玩家圆形布局画布')
  const protection = page.getByLabel('桌心保护半径')

  await expect(protection).toHaveValue('0')
  await expect(stage.locator('.center-protection-circle')).toHaveCount(0)
  await protection.fill('88')
  await expect(page).toHaveURL(/centerProtectionRadius=88/)
  await expect(stage.locator('.center-protection-circle')).toHaveCount(1)
  await expect(stage.locator('.protection-diagnostic')).toHaveCount(5)

  await page.reload()
  await page.getByRole('button', { name: '打开跑道布局设置' }).click()
  await expect(page.getByLabel('桌心保护半径')).toHaveValue('88')
})

test('retains the last valid frame for an invalid protection draft and recovers from no-fitting', async ({ page }) => {
  await page.goto('/stadium-layout-lab.html')
  await page.getByRole('button', { name: '打开跑道布局设置' }).click()
  const stage = page.getByLabel('跑道玩家圆形布局画布')
  const protection = page.getByLabel('桌心保护半径')
  const validMarkup = await stage.locator('svg').innerHTML()

  await protection.fill('-1')
  await expect(page.getByRole('status')).toContainText('桌心保护半径必须是有限且不小于 0 的数')
  await expect(stage.locator('svg')).toHaveJSProperty('innerHTML', validMarkup)

  await protection.fill('10000')
  await expect(stage).toHaveAttribute('data-layout-status', 'unavailable')
  await expect(stage.getByText('no-fitting-layout')).toBeVisible()

  await protection.fill('0')
  await expect(stage).toHaveAttribute('data-layout-status', 'ready')
  await expect(stage.locator('.player-boundary-circle')).toHaveCount(5)
})
