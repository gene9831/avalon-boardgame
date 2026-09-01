import { expect, test } from '@playwright/test'

import { playScriptedScenario, replayTranscript } from '@avalon/test-support'

import {
  createBrowserReplayHarness,
  createRoom,
  joinRoom,
} from '../support/browser-replay'

async function storedPlayerID(
  page: import('@playwright/test').Page,
  matchID: string,
) {
  return page.evaluate((roomID) => {
    const raw = localStorage.getItem(`avalon:room-session:${encodeURIComponent(roomID)}`)
    if (raw === null) return null
    const session = JSON.parse(raw) as { playerID?: unknown }
    return typeof session.playerID === 'string' ? session.playerID : null
  }, matchID)
}

test('creation enters the owner, seat zero is reusable, and concurrent joins fill the lowest empty seats', async ({
  browser,
}) => {
  test.setTimeout(90_000)

  const contexts = await Promise.all(
    Array.from({ length: 6 }, () => browser.newContext()),
  )
  const [ownerPage, seatZeroPage, ...remainingPages] = await Promise.all(
    contexts.map((context) => context.newPage()),
  )

  try {
    const matchID = await createRoom(
      ownerPage,
      5,
      'Automatic Seat Owner',
      { percivalMorgana: true },
    )
    await expect(ownerPage.locator('[data-round-table-player][data-player-id="0"]'))
      .toContainText('Automatic Seat Owner')
    await expect(
      ownerPage.locator('[data-round-table-player][data-player-id="0"]')
        .getByLabel('房间拥有者'),
    ).toBeVisible()

    await ownerPage.getByRole('button', { name: '移至 5 号空座位' }).click()
    await expect.poll(() => storedPlayerID(ownerPage, matchID)).toBe('4')
    await expect(
      ownerPage.locator('[data-round-table-player][data-player-id="4"]')
        .getByLabel('房间拥有者'),
    ).toBeVisible()

    await ownerPage.reload()
    await expect(ownerPage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect.poll(() => storedPlayerID(ownerPage, matchID)).toBe('4')
    await expect(
      ownerPage.locator('[data-round-table-player][data-player-id="4"]')
        .getByLabel('房间拥有者'),
    ).toBeVisible()

    await joinRoom(seatZeroPage, matchID, '0', 'Seat Zero Reuse')
    await expect.poll(() => storedPlayerID(seatZeroPage, matchID)).toBe('0')

    const concurrentJoinPages = remainingPages.slice(0, 3)
    await Promise.all(concurrentJoinPages.map((page, index) =>
      joinRoom(page, matchID, String(index + 1), `Concurrent Join ${index + 1}`),
    ))
    const concurrentPlayerIDs = await Promise.all(
      concurrentJoinPages.map((page) => storedPlayerID(page, matchID)),
    )
    expect(concurrentPlayerIDs.sort()).toEqual(['1', '2', '3'])
    await expect(ownerPage.getByRole('button', { name: '开始游戏' })).toBeEnabled()

    const fullRoomPage = remainingPages[3]
    await fullRoomPage.goto('/')
    const fullRoomCard = fullRoomPage
      .getByText(`房间 ${matchID}`, { exact: true })
      .locator('xpath=ancestor::article')
    await expect(fullRoomCard.getByText('5/5 人已入座', { exact: false })).toBeVisible()
    await expect(fullRoomCard.getByText('已满', { exact: true })).toBeVisible()
    await expect(fullRoomCard.getByRole('button', { name: '加入游戏' })).toHaveCount(0)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})

test('five isolated browser players complete a rejected-team game', async ({
  browser,
}) => {
  const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
  const generated = playScriptedScenario({
    masterSeed,
    scenario: 'five-rejections',
  })
  const harness = await createBrowserReplayHarness({
    browser,
    playerCount: 5,
  })

  try {
    await harness.pages[4].reload()
    await expect(
      harness.pages[4].getByText('等待房间创建者开始游戏', { exact: true }),
    ).toBeVisible()
    await harness.pages[4].getByRole('button', { name: '房间操作' }).click()
    await expect(
      harness.pages[4].getByRole('button', { name: '退出房间' }),
    ).toBeVisible()
    await harness.pages[4].getByRole('button', { name: '房间操作' }).click()

    const snapshot = await replayTranscript(harness, generated.transcript)

    expect(snapshot.resultHeadings).toEqual(
      Array.from({ length: 5 }, () => '邪恶阵营获胜'),
    )
    for (const page of harness.pages) {
      await expect(
        page
          .locator('p:visible')
          .filter({ hasText: '连续五次队伍提案被否决' })
          .first(),
      ).toBeVisible()
    }
  } finally {
    await harness.close()
  }
})
