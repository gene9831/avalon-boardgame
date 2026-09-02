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

  const mobileHelpTrigger = page.getByRole('button', { name: '帮助说明' })
  await expect(
    mobileHelpTrigger.getByText('帮助说明', { exact: true }),
  ).toBeHidden()
  const mobileHelpTriggerBox = await mobileHelpTrigger.boundingBox()
  expect(mobileHelpTriggerBox?.width).toBe(44)
  expect(mobileHelpTriggerBox?.height).toBe(44)
  await mobileHelpTrigger.click()
  const helpDialog = page.getByRole('dialog', { name: '帮助说明' })
  await expectCenteredWithinViewport(helpDialog)
  await helpDialog.getByRole('button', { name: '关闭帮助说明' }).click()

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

test('help center supports contextual role guidance and keyboard dismissal', async ({
  page,
}) => {
  await page.goto('/')

  const generalTrigger = page.getByRole('button', { name: '帮助说明' })
  await generalTrigger.click()
  const help = page.getByRole('dialog', { name: '帮助说明' })
  const rulesTab = help.getByRole('tab', { name: '游戏基础规则' })
  const rolesTab = help.getByRole('tab', { name: '角色说明' })
  await expect(rulesTab).toHaveAttribute('aria-selected', 'true')
  await expect(rulesTab).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(rolesTab).toHaveAttribute('aria-selected', 'true')
  await expect(rolesTab).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(rulesTab).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(generalTrigger).toBeFocused()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '创建房间' }).click()
  await page.getByRole('button', {
    name: '查看帕西维尔与莫甘娜的角色说明',
  }).click()
  await expect(
    help.getByRole('tab', { name: '角色说明' }),
  ).toHaveAttribute('aria-selected', 'true')
  const cards = help.locator('[data-help-role]')
  await expect(cards.nth(0)).toHaveAttribute('data-help-role', 'percival')
  await expect(cards.nth(1)).toHaveAttribute('data-help-role', 'morgana')
  const foregroundArtwork = help.locator('[data-help-role-artwork]')
  const backdropArtwork = help.locator('[data-help-role-artwork-backdrop]')
  await expect(foregroundArtwork).toHaveCount(6)
  await expect(backdropArtwork).toHaveCount(6)
  expect(await backdropArtwork.evaluateAll((images) => images.every(
    (image) => getComputedStyle(image).display === 'none',
  ))).toBe(true)

  const percivalCard = cards.nth(0)
  const artworkBox = await percivalCard
    .locator('[data-help-role-artwork="percival"]')
    .boundingBox()
  const roleNameBox = await percivalCard
    .getByRole('heading', { name: '帕西维尔' })
    .boundingBox()
  expect(artworkBox).not.toBeNull()
  expect(roleNameBox).not.toBeNull()
  expect(artworkBox!.x + artworkBox!.width).toBeLessThan(roleNameBox!.x)

  await page.setViewportSize({ width: 1280, height: 720 })
  expect(await backdropArtwork.evaluateAll((images) => images.every((image) => {
    const style = getComputedStyle(image)
    return style.display !== 'none' && style.objectFit === 'cover'
  }))).toBe(true)
  expect(await foregroundArtwork.evaluateAll((images) => images.every(
    (image) => getComputedStyle(image).objectFit === 'contain',
  ))).toBe(true)
})

test('help tabs stay above scrolled role artwork on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 369, height: 812 })
  await page.goto('/')

  await page.getByRole('button', { name: '帮助说明' }).click()
  const help = page.getByRole('dialog', { name: '帮助说明' })
  const rulesTab = help.getByRole('tab', { name: '游戏基础规则' })
  await help.getByRole('tab', { name: '角色说明' }).click()
  await help.evaluate((dialog) => {
    dialog.scrollTop = 80
  })

  const rulesTabIsTopmost = await rulesTab.evaluate((tab) => {
    const rect = tab.getBoundingClientRect()
    const topmostElement = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    )
    return topmostElement === tab || tab.contains(topmostElement)
  })

  expect(rulesTabIsTopmost).toBe(true)
})
