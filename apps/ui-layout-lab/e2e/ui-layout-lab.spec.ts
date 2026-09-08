import { expect, test } from '@playwright/test'

test('uses the actual mobile viewport and keeps device controls concise', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:14175/?viewport=device&width=390&height=844&players=10&geometry=0')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-layout-mode', 'vertical')
  await expect(canvas).toHaveAttribute('data-table-shape', 'stadium')
  await expect(canvas).toHaveAttribute('data-avatar-size', '48')
  await expect(canvas).toHaveAttribute('data-canvas-width', '390')
  await expect(canvas).toHaveAttribute('data-canvas-height', '844')
  await expect(canvas).toHaveCSS('width', '390px')
  await expect(canvas).toHaveCSS('height', '844px')
  await expect(canvas.locator('.crown')).toHaveCount(1)

  await page.getByRole('button', { name: '打开布局设置' }).click()
  await expect(page.getByRole('dialog', { name: '预览设置' })).toBeVisible()
  await expect(page.locator('.simulation-fields')).toBeHidden()
  await expect(page.getByLabel('玩家人数')).toBeVisible()
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
  await expect(page).toHaveURL(/viewport=simulated&width=430&height=932&players=10&geometry=0/)
  await expect(page.getByLabel('Avalon 房间布局预览')).toHaveAttribute('data-avatar-size', '56')
})

test('renders returned diagnostics for the 430 by 932 baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('http://127.0.0.1:14175/?viewport=simulated&width=430&height=932&players=10&geometry=1')

  const canvas = page.getByLabel('Avalon 房间布局预览')
  await expect(canvas).toHaveAttribute('data-avatar-size', '56')
  await expect(canvas).toHaveAttribute('data-table-shape', 'stadium')
  await expect(canvas.locator('.player-seat')).toHaveCount(10)
  await expect(canvas.locator('.round-table-footprint')).toHaveCount(1)
  await expect(canvas.locator('.gap-line')).toHaveCount(10)
  await expect(canvas.locator('.gap-line.center')).toHaveCount(2)
  await expect(canvas).toHaveAttribute('data-show-geometry', '')
})

test('keeps settings available when horizontal strategy is pending', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('http://127.0.0.1:14175/?viewport=device&players=10')

  await expect(page.getByLabel('Avalon 房间布局预览')).toHaveAttribute('data-canvas-width', '844')
  await expect(page.getByText('horizontal-strategy-pending', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '打开布局设置' }).click()
  await expect(page.getByRole('dialog', { name: '预览设置' })).toBeVisible()
})
