import { expect, test, type Page } from '@playwright/test'

import { createRoom, setPlayerProfileName } from '../support/browser-replay'

function roomCard(page: Page, matchID: string) {
  return page
    .getByText(`房间 ${matchID}`, { exact: true })
    .locator('xpath=ancestor::article')
}

test('profile persistence, room locking, and credential re-entry work', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto('/')
    await setPlayerProfileName(page, 'Saved Arthur')
    await page.getByRole('button', { name: '创建房间' }).click()
    const createDialog = page.getByRole('dialog', { name: '创建一局阿瓦隆' })
    await createDialog.getByRole('button', { name: '5', exact: true }).click()
    await createDialog.getByRole('button', { name: '创建房间' }).click()
    await expect(page).toHaveURL(/\/rooms\/[^/]+$/)
    const matchID = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!)

    await page.getByRole('button', { name: '打开用户中心' }).click()
    const lockedProfile = page.getByRole('dialog', { name: '用户中心' })
    await expect(lockedProfile.getByText('Saved Arthur', { exact: true })).toBeVisible()
    await expect(lockedProfile.getByText('退出房间后可修改名称和头像。')).toBeVisible()
    await expect(lockedProfile.getByRole('textbox')).toHaveCount(0)
    await lockedProfile.getByRole('button', { name: '关闭用户中心' }).click()

    await page.getByRole('button', { name: '返回主页' }).click()
    await page.getByRole('button', { name: '打开用户中心' }).click()
    const retainedSeatProfile = page.getByRole('dialog', { name: '用户中心' })
    await expect(retainedSeatProfile.getByText('Saved Arthur', { exact: true })).toBeVisible()
    await expect(retainedSeatProfile.getByRole('textbox')).toHaveCount(0)
    await retainedSeatProfile.getByRole('button', { name: '关闭用户中心' }).click()
    await roomCard(page, matchID).getByRole('button', { name: '继续游戏' }).click()
    await expect(page).toHaveURL(new RegExp(`/rooms/${matchID}$`))

    await page.getByRole('button', { name: '打开开发控制' }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '清除本地凭据（测试）' }).click()
    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: '打开用户中心' }).click()
    await expect(page.getByRole('dialog', { name: '用户中心' }).getByRole('textbox', { name: '显示名称' })).toHaveValue('Saved Arthur')
  } finally {
    await context.close()
  }
})

test('duplicate names can occupy distinct seats', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const joinContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const joinPage = await joinContext.newPage()

  try {
    const matchID = await createRoom(hostPage, 5, 'Duplicate Arthur')
    await joinPage.goto('/')
    await setPlayerProfileName(joinPage, 'Duplicate Arthur')
    const card = roomCard(joinPage, matchID)
    await card.getByLabel(`选择 ${matchID} 的座位`).selectOption('1')
    await card.getByRole('button', { name: '加入' }).click()
    await expect(joinPage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect(
      joinPage.locator('[data-round-table-nameplate]').filter({ hasText: 'Duplicate Arthur' }),
    ).toHaveCount(2)
  } finally {
    await Promise.all([hostContext.close(), joinContext.close()])
  }
})

test('a concurrent seat loser can refresh and join another seat', async ({ browser }) => {
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () => browser.newContext()),
  )
  const [hostPage, firstPage, secondPage] = await Promise.all(
    contexts.map((context) => context.newPage()),
  )

  try {
    const matchID = await createRoom(hostPage, 5, 'Race Host')
    for (const [page, name] of [
      [firstPage, 'Race One'],
      [secondPage, 'Race Two'],
    ] as const) {
      await page.goto('/')
      await setPlayerProfileName(page, name)
      const card = roomCard(page, matchID)
      await card.getByLabel(`选择 ${matchID} 的座位`).selectOption('1')
    }

    await Promise.all([
      roomCard(firstPage, matchID).getByRole('button', { name: '加入' }).click(),
      roomCard(secondPage, matchID).getByRole('button', { name: '加入' }).click(),
    ])
    await expect.poll(() =>
      [firstPage, secondPage].filter((page) =>
        new URL(page.url()).pathname === `/rooms/${matchID}`,
      ).length,
    ).toBe(1)

    const loser = new URL(firstPage.url()).pathname === `/rooms/${matchID}`
      ? secondPage
      : firstPage
    await expect(
      loser.getByText('所选座位已被占用，请刷新房间列表后重新选择。'),
    ).toBeVisible()
    const card = roomCard(loser, matchID)
    await card.getByLabel(`选择 ${matchID} 的座位`).selectOption('2')
    await card.getByRole('button', { name: '加入' }).click()
    await expect(loser).toHaveURL(new RegExp(`/rooms/${matchID}$`))
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
