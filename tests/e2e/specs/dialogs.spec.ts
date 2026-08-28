import { expect, test, type Locator } from '@playwright/test'

import { createRoom } from '../support/browser-replay'

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
  const createGameDialog = page.getByRole('dialog', {
    name: '创建一局阿瓦隆',
  })
  await expectCenteredWithinViewport(createGameDialog)
  await createGameDialog.getByRole('button', { name: '5', exact: true }).click()
  await createGameDialog.getByRole('button', { name: '创建房间' }).click()
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

test('user center and room log contain focus and restore it after closing', async ({
  page,
}) => {
  await page.goto('/')

  const profileTrigger = page.getByRole('button', { name: '打开用户中心' })
  await profileTrigger.click()
  const profile = page.getByRole('dialog', { name: '用户中心' })
  const profileClose = profile.getByRole('button', { name: '关闭用户中心' })
  const licenseDisclosure = profile.getByText('素材与许可', { exact: true })
  const licenseLink = profile.getByRole('link', { name: 'CC BY 4.0' })

  await expect(profileClose).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(licenseDisclosure).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(profileClose).toBeFocused()
  await licenseDisclosure.click()
  await expect(licenseLink).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(profile).not.toBeVisible()
  await expect(profileTrigger).toBeFocused()

  await createRoom(page, 5, 'Keyboard Host')
  const logTrigger = page.getByRole('button', { name: '查看对局记录' })
  await logTrigger.click()
  const roomLog = page.getByRole('dialog', { name: '对局记录' })
  const logClose = roomLog.getByRole('button', { name: '关闭对局记录' })

  await expect(logClose).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(logClose).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(roomLog).not.toBeVisible()
  await expect(logTrigger).toBeFocused()
})
