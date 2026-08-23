import { expect, test, type Page } from '@playwright/test'

import { createRoom } from '../support/browser-replay'

const targetViewports = [
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 1077, height: 722 },
]

async function documentDimensions(page: Page) {
  return page.evaluate(() => ({
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }))
}

async function expectFloatingDevelopmentControls(page: Page, pageMustFit: boolean) {
  const dimensionsBeforeOpening = await documentDimensions(page)
  const trigger = page.getByRole('button', { name: '打开开发控制' })
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.click()

  const panel = page.getByRole('dialog', { name: '开发控制' })
  await expect(panel).toBeVisible()
  const tokenInput = panel.getByLabel('开发管理员 Token')
  await expect(tokenInput).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭开发控制' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  await tokenInput.press('Tab')
  expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true)

  const dimensionsAfterOpening = await documentDimensions(page)
  expect(dimensionsAfterOpening.scrollWidth).toBe(dimensionsBeforeOpening.scrollWidth)
  expect(dimensionsAfterOpening.scrollHeight).toBe(dimensionsBeforeOpening.scrollHeight)
  if (pageMustFit) {
    expect(dimensionsAfterOpening.scrollWidth).toBeLessThanOrEqual(dimensionsAfterOpening.innerWidth)
    expect(dimensionsAfterOpening.scrollHeight).toBeLessThanOrEqual(dimensionsAfterOpening.innerHeight)
  }

  await page.getByRole('button', { name: '关闭开发控制' }).click()
  await expect(panel).not.toBeVisible()
  await page.getByRole('button', { name: '打开开发控制' }).click()
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await expect(page.getByRole('button', { name: '打开开发控制' })).toBeFocused()
}

test('the homepage and room share responsive floating development controls', async ({
  page,
}) => {
  await page.goto('/')
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport)
    await expectFloatingDevelopmentControls(page, false)
  }

  await createRoom(page, 5, 'Floating Debug Host')
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport)
    await expectFloatingDevelopmentControls(page, true)
  }
})
