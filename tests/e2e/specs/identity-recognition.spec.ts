import { expect, test } from '@playwright/test'

import { playGeneratedGame, playScriptedScenario } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

const recognitionViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 1339, height: 786 },
]

async function expectRecognitionControlsAvoidSeats({
  page,
  playerCount,
  viewport,
}: {
  page: import('@playwright/test').Page
  playerCount: number
  viewport: { width: number, height: number }
}) {
  await page.setViewportSize(viewport)

  const recognitionLayer = page.getByLabel('身份辨认', { exact: true })
  const questBoard = page.getByLabel('任务计分板', { exact: true })
  const landscape = viewport.width > viewport.height

  await expect(recognitionLayer).toBeVisible()
  await expect(recognitionLayer.getByRole('button')).toHaveCount(1)
  if (landscape) {
    await expect(questBoard).toBeHidden()
  } else {
    await expect(questBoard).toBeVisible()
  }

  const geometry = await recognitionLayer.evaluate((layer, options) => {
    const table = document.querySelector(
      `[aria-label="${options.playerCount} 人游戏圆桌"]`,
    )
    const center = table?.querySelector('[data-round-table-center]')
    const visualSurfaces = options.landscape
      ? [layer.querySelector('.identity-recognition-responsive-panel')]
      : [
          layer.querySelector('.identity-recognition-header'),
          layer.querySelector('.identity-recognition-confirmation'),
        ]
    const surfaces = visualSurfaces.filter((element): element is Element => element !== null)
    const seatParts = Array.from(
      table?.querySelectorAll('[data-round-table-avatar], [data-round-table-nameplate]') ?? [],
    )
    const intersects = (left: DOMRect, right: DOMRect, tolerance = 1) => (
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance
      && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance
    )
    const centerRect = center?.getBoundingClientRect()
    const buttonRect = layer.querySelector('button')?.getBoundingClientRect()

    return {
      buttonSize: buttonRect === undefined
        ? null
        : { height: buttonRect.height, width: buttonRect.width },
      controlsInsideCenter: centerRect !== undefined && surfaces.every((surface) => {
        const rect = surface.getBoundingClientRect()
        return rect.left >= centerRect.left - 1
          && rect.right <= centerRect.right + 1
          && rect.top >= centerRect.top - 1
          && rect.bottom <= centerRect.bottom + 1
      }),
      controlSeatOverlaps: surfaces.flatMap((surface, controlIndex) => {
        const controlRect = surface.getBoundingClientRect()
        return seatParts.flatMap((seatPart, seatIndex) => (
          intersects(controlRect, seatPart.getBoundingClientRect())
            ? [`${controlIndex + 1}:${seatIndex + 1}`]
            : []
        ))
      }),
    }
  }, { landscape, playerCount })

  expect(geometry.buttonSize).not.toBeNull()
  expect(geometry.buttonSize!.height).toBeGreaterThanOrEqual(44)
  expect(geometry.buttonSize!.width).toBeGreaterThanOrEqual(44)
  expect(
    geometry.controlSeatOverlaps,
    `${playerCount} players @ ${viewport.width}x${viewport.height}`,
  ).toEqual([])
  if (landscape) {
    expect(
      geometry.controlsInsideCenter,
      `${playerCount} players @ ${viewport.width}x${viewport.height}`,
    ).toBe(true)
  }

}

test('recognition controls float in portrait and replace the quest board in landscape', async ({
  browser,
}) => {
  test.setTimeout(180_000)

  for (const playerCount of [5, 10]) {
    const run = playGeneratedGame({
      masterSeed: process.env.E2E_MASTER_SEED ?? 'playwright-smoke',
      playerCount,
    })
    const harness = await createBrowserReplayHarness({ browser, playerCount })

    try {
      const recognitionCommands = run.transcript.filter(
        ({ command }) => command === 'confirmIdentityRecognition',
      )
      const roleRevealCommands = recognitionCommands.slice(0, playerCount)
      const firstRecognitionCommand = recognitionCommands[playerCount]

      expect(roleRevealCommands).toHaveLength(playerCount)
      expect(firstRecognitionCommand).toBeDefined()

      await harness.dispatch(run.transcript[0]!)
      for (const command of roleRevealCommands) {
        await harness.dispatch(command)
      }

      const participantPage = harness.pages[Number(firstRecognitionCommand!.actor)]!
      for (const viewport of recognitionViewports) {
        await expectRecognitionControlsAvoidSeats({
          page: participantPage,
          playerCount,
          viewport,
        })
      }

      await participantPage.setViewportSize({ width: 390, height: 844 })
      const confirmationButton = participantPage.getByRole('button', {
        name: /我已辨认/,
      })
      await confirmationButton.focus()
      await expect(confirmationButton).toBeFocused()
      await participantPage.setViewportSize({ width: 1339, height: 786 })
      await expect(confirmationButton).toBeFocused()
    } finally {
      await harness.close()
    }
  }
})

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
      const recognitionLayer = page.locator('[data-identity-step="roleReveal"]')
      await expect(recognitionLayer).toHaveAttribute(
        'data-curtain-state',
        'lowered',
      )
      await expect(page.getByText('本局目标：')).toBeVisible()
      await expect(page.getByText(/\d+ 秒/)).toHaveCount(0)
      await expect(page.getByRole('button', {
        name: '显示已知角色信息',
      })).toHaveCount(0)

      const headerZIndex = await page.locator('.round-table-header').evaluate(
        (header) => Number.parseInt(getComputedStyle(header).zIndex, 10) || 0,
      )
      const recognitionZIndex = await recognitionLayer.evaluate(
        (layer) => Number.parseInt(getComputedStyle(layer).zIndex, 10) || 0,
      )
      expect(headerZIndex).toBeGreaterThan(recognitionZIndex)
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
    const nonParticipantPage = harness.pages.find(
      (_, index) => !evilPlayerIDs.has(String(index)),
    )
    if (nonParticipantPage === undefined) {
      throw new Error('Expected an Evil-recognition nonparticipant')
    }
    const closedCurtain = nonParticipantPage.locator(
      '[data-curtain-state="closed"]',
    )
    await expect(closedCurtain).toHaveCSS('animation-name', 'none')
    const backButton = nonParticipantPage.getByRole('button', {
      name: '返回主页',
    })
    await expect(backButton).toBeVisible()
    expect(await backButton.evaluate((button) => {
      const bounds = button.getBoundingClientRect()
      const topmost = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      )
      return topmost === button || button.contains(topmost)
    })).toBe(true)
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
