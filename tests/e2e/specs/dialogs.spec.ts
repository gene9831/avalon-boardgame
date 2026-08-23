import { expect, test, type Locator } from '@playwright/test'

async function expectCenteredWithinViewport(dialog: Locator) {
  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottomGap: window.innerHeight - rect.bottom,
      centerDeltaX: rect.x + rect.width / 2 - window.innerWidth / 2,
      centerDeltaY: rect.y + rect.height / 2 - window.innerHeight / 2,
      leftGap: rect.left,
      rightGap: window.innerWidth - rect.right,
      topGap: rect.top,
    }
  })

  expect(Math.abs(geometry.centerDeltaX)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.centerDeltaY)).toBeLessThanOrEqual(1)
  expect(geometry.leftGap).toBeGreaterThanOrEqual(16)
  expect(geometry.rightGap).toBeGreaterThanOrEqual(16)
  expect(geometry.topGap).toBeGreaterThanOrEqual(16)
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(16)
}

test('business dialogs remain centered within a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')

  await page.getByRole('button', { name: '创建房间' }).click()
  const playerNameDialog = page.getByRole('dialog', {
    name: '创建房间前确认名称',
  })
  await expectCenteredWithinViewport(playerNameDialog)
  await playerNameDialog.getByLabel('玩家名称').fill('Centered Dialog Host')
  await playerNameDialog.getByRole('button', { name: '确认创建' }).click()
  await expect(page).toHaveURL(/\/rooms\/[^/]+$/)

  await page.getByRole('button', { name: '房间操作' }).evaluate((button) => {
    (button as HTMLButtonElement).click()
  })
  const dissolveRoom = page.getByRole('button', { name: '解散房间' })
  await expect(dissolveRoom).toBeVisible()
  await dissolveRoom.evaluate((button) => {
    (button as HTMLButtonElement).click()
  })
  await expectCenteredWithinViewport(
    page.getByRole('dialog', { name: '确认解散房间' }),
  )
})
