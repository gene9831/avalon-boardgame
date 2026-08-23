import { expect, test } from '@playwright/test'

import { playScriptedScenario } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

test('players complete the curtain-based identity recognition ceremony', async ({
  browser,
}) => {
  const run = playScriptedScenario({
    masterSeed: process.env.E2E_MASTER_SEED ?? 'playwright-smoke',
    scenario: 'five-rejections',
  })
  const harness = await createBrowserReplayHarness({ browser, playerCount: 5 })
  const consoleErrors: string[] = []

  for (const page of harness.pages) {
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
  }

  try {
    const recognitionCommands = run.transcript.filter(
      ({ command }) => command === 'confirmIdentityRecognition',
    )
    const roleRevealCommands = recognitionCommands.slice(0, 5)
    const evilRecognitionCommands = recognitionCommands.slice(5, 7)
    const merlinRecognitionCommand = recognitionCommands[7]

    expect(roleRevealCommands).toHaveLength(5)
    expect(evilRecognitionCommands).toHaveLength(2)
    expect(merlinRecognitionCommand).toBeDefined()

    await harness.dispatch(run.transcript[0])
    for (const page of harness.pages) {
      await expect(page.locator('[data-identity-step="roleReveal"]')).toHaveAttribute(
        'data-curtain-state',
        'raised',
      )
      await expect(page.getByText('本局目标：')).toBeVisible()
      await expect(page.getByText(/\d+ 秒/)).toHaveCount(0)
      await expect(page.getByRole('button', {
        name: '显示已知角色信息',
      })).toHaveCount(0)
    }

    await harness.dispatch(roleRevealCommands[0])
    const firstConfirmedPage = harness.pages[Number(roleRevealCommands[0].actor)]
    await expect(firstConfirmedPage.getByRole('button', {
      name: '等待中',
    })).toBeDisabled()
    await expect(firstConfirmedPage.getByText('1/5 已确认')).toBeVisible()

    for (const command of roleRevealCommands.slice(1)) {
      await harness.dispatch(command)
    }

    const evilPlayerIDs = new Set(
      evilRecognitionCommands.map(({ actor }) => actor),
    )
    for (const [index, page] of harness.pages.entries()) {
      await expect(page.locator('[data-identity-step="evilRecognition"]')).toHaveAttribute(
        'data-curtain-state',
        evilPlayerIDs.has(String(index)) ? 'raised' : 'closed',
      )
    }
    await expect(
      harness.pages[Number(evilRecognitionCommands[0].actor)]
        .locator('[data-known-player-info]'),
    ).toHaveCount(1)

    for (const command of evilRecognitionCommands) {
      await harness.dispatch(command)
    }

    const merlinID = merlinRecognitionCommand.actor
    for (const [index, page] of harness.pages.entries()) {
      await expect(page.locator('[data-identity-step="merlinRecognition"]')).toHaveAttribute(
        'data-curtain-state',
        String(index) === merlinID ? 'raised' : 'closed',
      )
    }
    await expect(
      harness.pages[Number(merlinID)].locator('[data-known-player-info]'),
    ).toHaveCount(2)

    await harness.dispatch(merlinRecognitionCommand)
    for (const page of harness.pages) {
      await expect(page.locator('[data-identity-step]')).toHaveCount(0)
      await expect(page.getByRole('button', {
        name: '显示已知角色信息',
      })).toBeVisible()
    }
    expect(consoleErrors).toEqual([])
  } finally {
    await harness.close()
  }
})
