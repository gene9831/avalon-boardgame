import { expect, test, type Page } from '@playwright/test'

import { createBrowserReplayHarness } from '../support/browser-replay'

type PresentedRole =
  | 'merlin'
  | 'percival'
  | 'assassin'
  | 'morgana'
  | 'loyal_servant'
  | 'minion'

async function revealRole(page: Page) {
  await expect(page.locator('[data-room-scene="identityConfirmation"]')).toBeVisible()
  const reveal = page.locator('[data-room-slot="phase-action"]')
    .getByRole('button', { exact: true, name: '揭示身份' })
  if (await reveal.count() === 1) await reveal.click()
  await expect(page.getByRole('button', {
    exact: true,
    name: '我已记住身份',
  })).toBeVisible()
}

async function finishPersonalRecognition(page: Page) {
  const remember = page.getByRole('button', {
    exact: true,
    name: '我已记住身份',
  })
  if (await remember.count() === 1) {
    if (!await remember.isVisible()) await revealRole(page)
    await remember.click()
    await expect.poll(async () => (
      await page.locator('[data-identity-recognition-state="waiting"]').count() +
      await page.getByRole('button', { exact: true, name: '查看线索' }).count() +
      await page.locator('[data-room-scene="teamProposal"]').count()
    )).toBeGreaterThan(0)
  }

  const revealClue = page.getByRole('button', {
    exact: true,
    name: '查看线索',
  })
  if (await revealClue.count() === 1) {
    await revealClue.click()
    const confirm = page.getByRole('button', {
      exact: true,
      name: '我已辨认',
    })
    await expect(confirm).toBeVisible()
    await confirm.click()
  }
}

test('identity confirmation completes before concurrent clue recognition without a curtain', async ({
  browser,
}) => {
  test.setTimeout(120_000)

  const harness = await createBrowserReplayHarness({
    browser,
    playerCount: 5,
    roleConfiguration: { percivalMorgana: true },
  })
  const consoleErrors: string[] = []
  for (const page of harness.pages) {
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
  }

  try {
    await harness.dispatch({ actor: '0', command: 'startGame' })
    await Promise.all(harness.pages.map(revealRole))

    const roleByPlayer = new Map<string, PresentedRole>()
    for (const [index, page] of harness.pages.entries()) {
      const role = await page.locator('[data-identity-role-artwork]')
        .getAttribute('data-identity-role-artwork')
      if (role === null) throw new Error(`Player ${index} has no role card`)
      roleByPlayer.set(String(index), role as PresentedRole)
      await expect(page.locator('[data-curtain-state]')).toHaveCount(0)
    }

    const merlinID = Array.from(roleByPlayer.entries())
      .find(([, role]) => role === 'merlin')?.[0]
    const servantID = Array.from(roleByPlayer.entries())
      .find(([, role]) => role === 'loyal_servant')?.[0]
    const untouchedID = Array.from(roleByPlayer.keys())
      .find((playerID) => playerID !== merlinID && playerID !== servantID)
    if (merlinID === undefined || servantID === undefined || untouchedID === undefined) {
      throw new Error('Expected Merlin, Loyal Servant, and an untouched player')
    }

    const merlinPage = harness.pages[Number(merlinID)]!
    const servantPage = harness.pages[Number(servantID)]!
    const untouchedPage = harness.pages[Number(untouchedID)]!
    await merlinPage.getByRole('button', {
      exact: true,
      name: '我已记住身份',
    }).click()
    await expect(merlinPage.locator('[data-identity-recognition-state="waiting"]'))
      .toBeVisible()

    await servantPage.getByRole('button', {
      exact: true,
      name: '我已记住身份',
    }).click()
    await expect(servantPage.locator('[data-identity-recognition-state="waiting"]'))
      .toBeVisible()
    await expect(servantPage.getByRole('button', {
      name: '查看我的身份与已知信息',
    })).toBeVisible()
    await expect(servantPage.getByText('身份辨认进度已保存。')).toBeVisible()

    await expect(untouchedPage.locator('[data-identity-confirmation-state="revealed"]'))
      .toBeVisible()
    await expect(untouchedPage.getByRole('button', {
      exact: true,
      name: '我已记住身份',
    })).toBeVisible()
    await expect(merlinPage.getByRole('button', {
      exact: true,
      name: '查看线索',
    })).toHaveCount(0)
    await expect(merlinPage.getByText('等待其他玩家确认身份')).toBeVisible()

    for (const [playerID, page] of harness.pages.entries()) {
      if (String(playerID) === merlinID || String(playerID) === servantID) continue
      await page.getByRole('button', {
        exact: true,
        name: '我已记住身份',
      }).click()
    }

    await expect(merlinPage.locator('[data-identity-recognition-state="concealed"]'))
      .toBeVisible()
    await expect(servantPage.getByText('等待其他玩家完成线索辨认')).toBeVisible()

    await merlinPage.getByRole('button', { exact: true, name: '查看线索' }).click()
    await expect(
      merlinPage.locator('[data-recognition-seat-state="target"][data-recognition-tone="evil"]'),
    ).toHaveCount(2)
    await merlinPage.getByRole('button', { exact: true, name: '暂时隐藏' }).click()
    await expect(merlinPage.locator('[data-recognition-seat-state="target"]')).toHaveCount(0)

    await merlinPage.reload()
    await expect(merlinPage.locator('[data-identity-recognition-state="concealed"]'))
      .toBeVisible()
    await expect(merlinPage.locator('[data-recognition-seat-state="target"]')).toHaveCount(0)

    await merlinPage.getByRole('button', { exact: true, name: '查看线索' }).click()
    await merlinPage.getByRole('button', { exact: true, name: '我已辨认' }).click()
    await expect(merlinPage.locator('[data-identity-recognition-state="waiting"]'))
      .toBeVisible()
    await merlinPage.getByRole('button', {
      name: '查看我的身份与已知信息',
    }).click()
    await expect(merlinPage.locator('[data-role-avatar="merlin"]')).toBeVisible()
    await expect(
      merlinPage.locator('[data-known-player-info="evil"]'),
    ).toHaveCount(2)
    await expect(
      merlinPage.locator('[data-known-player-info="evil"]').first(),
    ).toBeVisible()

    for (const page of harness.pages) await finishPersonalRecognition(page)

    for (const page of harness.pages) {
      await expect(page.locator('[data-room-screen="true"]')).toHaveAttribute(
        'data-room-scene',
        'teamProposal',
      )
      await expect(page.locator('[data-curtain-state]')).toHaveCount(0)
      await expect(page.getByRole('button', {
        name: /^(查看|隐藏)我的身份与已知信息$/,
      })).toBeVisible()
    }
    expect(consoleErrors).toEqual([])
  } finally {
    await harness.close()
  }
})
