import { expect, test, type Page } from '@playwright/test'

import { createRoom } from '../support/browser-replay'

function roomCard(page: Page, matchID: string) {
  return page
    .getByText(`房间 ${matchID}`, { exact: true })
    .locator('xpath=ancestor::article')
}

test('name cancellation, persistence, prefill, and credential re-entry work', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto('/')
    await page.getByRole('button', { name: '创建房间' }).click()
    const nameInput = page.getByRole('dialog').getByLabel('玩家名称')
    await nameInput.fill('Cancelled Name')
    await page.getByRole('button', { name: '取消' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    await page.getByRole('button', { name: '创建房间' }).click()
    await expect(nameInput).toHaveValue('')
    await nameInput.fill('Saved Arthur')
    await page.getByRole('button', { name: '确认创建' }).click()
    await expect(page).toHaveURL(/\/rooms\/[^/]+$/)
    const matchID = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!)

    await page.getByRole('button', { name: '返回主页' }).click()
    await roomCard(page, matchID).getByRole('button', { name: '进入' }).click()
    await expect(page).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByText('开发控制', { exact: true }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '清除本地凭据（测试）' }).click()
    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: '创建房间' }).click()
    await expect(nameInput).toHaveValue('Saved Arthur')
    await page.getByRole('button', { name: '取消' }).click()
  } finally {
    await context.close()
  }
})

test('duplicate name stays editable in the dialog', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const joinContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const joinPage = await joinContext.newPage()

  try {
    const matchID = await createRoom(hostPage, 5, 'Duplicate Arthur')
    await joinPage.goto('/')
    const card = roomCard(joinPage, matchID)
    await card.getByLabel(`选择 ${matchID} 的座位`).selectOption('1')
    await card.getByRole('button', { name: '加入' }).click()
    const input = joinPage.getByRole('dialog').getByLabel('玩家名称')
    await input.fill('Duplicate Arthur')
    await joinPage.getByRole('button', { name: '确认加入' }).click()
    await expect(
      joinPage.getByText('这个名字已被本房间的其他玩家使用。'),
    ).toBeVisible()
    await expect(input).toHaveValue('Duplicate Arthur')

    await input.fill('Unique Lancelot')
    await joinPage.getByRole('button', { name: '确认加入' }).click()
    await expect(joinPage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
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
      const card = roomCard(page, matchID)
      await card.getByLabel(`选择 ${matchID} 的座位`).selectOption('1')
      await card.getByRole('button', { name: '加入' }).click()
      await page.getByRole('dialog').getByLabel('玩家名称').fill(name)
    }

    await Promise.all([
      firstPage.getByRole('button', { name: '确认加入' }).click(),
      secondPage.getByRole('button', { name: '确认加入' }).click(),
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
    const recoveryInput = loser.getByRole('dialog').getByLabel('玩家名称')
    await expect(recoveryInput).toHaveValue('')
    await recoveryInput.fill('Race Recovery')
    await loser.getByRole('button', { name: '确认加入' }).click()
    await expect(loser).toHaveURL(new RegExp(`/rooms/${matchID}$`))
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
