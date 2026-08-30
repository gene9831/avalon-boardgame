import { expect, test } from '@playwright/test'

import { playGeneratedGame, playScriptedScenario } from '@avalon/test-support'

import { createBrowserReplayHarness, playerName } from '../support/browser-replay'

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
  test.setTimeout(120_000)

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
        name: '查看我的身份与已知信息',
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
      name: '等待其他玩家确认',
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
        name: '查看我的身份与已知信息',
      })).toBeVisible()
    }

    const evilPage = harness.pages[Number(evilRecognitionCommands[0].actor)]
    const evilSeatGeometryBefore = await evilPage.locator('#current-player-avatar').evaluate((avatar) => {
      const nameplate = avatar.closest('[data-round-table-player]')!
        .querySelector('[data-round-table-nameplate]')!
        .getBoundingClientRect()
      const avatarRect = avatar.getBoundingClientRect()
      return {
        avatar: [avatarRect.x, avatarRect.y, avatarRect.width, avatarRect.height],
        nameplate: [nameplate.x, nameplate.y, nameplate.width, nameplate.height],
      }
    })
    await evilPage.getByRole('button', {
      name: '查看我的身份与已知信息',
    }).click()
    const evilAvatar = evilPage.locator('#current-player-avatar')
    const evilSeat = evilAvatar.locator('xpath=ancestor::*[@data-round-table-player]')
    await expect(evilPage.getByLabel('任务计分板', { exact: true })).toBeVisible()
    await expect(evilPage.locator('[data-role-card]')).toHaveCount(0)
    await expect(evilAvatar.locator('[data-role-avatar]')).toBeVisible()
    await expect(evilSeat.locator('[data-current-role-label]')).toBeVisible()
    const evilSeatGeometryAfter = await evilSeat.evaluate((seat) => {
      const avatar = seat.querySelector('[data-round-table-avatar]')!.getBoundingClientRect()
      const nameplate = seat.querySelector('[data-round-table-nameplate]')!.getBoundingClientRect()
      const roleLabel = seat.querySelector('[data-current-role-label]')!.getBoundingClientRect()
      return {
        avatar: [avatar.x, avatar.y, avatar.width, avatar.height],
        labelTop: roleLabel.top,
        nameplate: [nameplate.x, nameplate.y, nameplate.width, nameplate.height],
        nameplateBottom: nameplate.bottom,
      }
    })
    expect(evilSeatGeometryAfter.avatar).toEqual(evilSeatGeometryBefore.avatar)
    expect(evilSeatGeometryAfter.nameplate).toEqual(evilSeatGeometryBefore.nameplate)
    expect(evilSeatGeometryAfter.labelTop).toBeGreaterThanOrEqual(
      evilSeatGeometryAfter.nameplateBottom + 1,
    )
    await expect(evilPage.locator('[data-known-player-info]')).toHaveCount(1)
    await evilPage.keyboard.press('Escape')
    await expect(evilAvatar.locator('[data-role-avatar]')).toBeVisible()

    await evilPage.reload()
    await expect(evilPage.getByRole('button', {
      name: '隐藏我的身份与已知信息',
    })).toBeVisible()
    await expect(evilPage.locator('#current-player-avatar [data-role-avatar]')).toBeVisible()

    const sameBrowserPage = await evilPage.context().newPage()
    await sameBrowserPage.goto(evilPage.url())
    await expect(sameBrowserPage.getByRole('button', {
      name: '隐藏我的身份与已知信息',
    })).toBeVisible()
    await sameBrowserPage.getByRole('button', {
      name: '隐藏我的身份与已知信息',
    }).click()
    await expect(evilPage.getByRole('button', {
      name: '查看我的身份与已知信息',
    })).toBeVisible()
    await expect(evilPage.locator('#current-player-avatar [data-role-avatar]')).toHaveCount(0)
    await sameBrowserPage.close()

    const proposal = run.transcript.find(
      ({ command }) => command === 'proposeTeam',
    )
    if (proposal?.command !== 'proposeTeam') {
      throw new Error('Expected a team proposal after recognition')
    }
    const leaderPage = harness.pages[Number(proposal.actor)]
    const preservedPlayerID = proposal.payload.team[0]
    const preservedSeat = leaderPage.locator('[data-round-table-player]').filter({
      hasText: playerName(preservedPlayerID),
    }).first()
    await leaderPage.getByRole('button', {
      name: `选择 ${playerName(preservedPlayerID)} 加入任务队伍`,
    }).click()
    await expect(preservedSeat).toHaveAttribute('aria-pressed', 'true')

    await leaderPage.getByRole('button', {
      name: '查看我的身份与已知信息',
    }).click()
    await expect(leaderPage.locator('#current-player-avatar [data-role-avatar]')).toBeVisible()
    await expect(leaderPage.getByLabel('任务计分板', { exact: true })).toBeVisible()
    await expect(preservedSeat).toBeEnabled()
    await expect(preservedSeat).toHaveAttribute('aria-pressed', 'true')

    for (const teamMemberID of proposal.payload.team.slice(1)) {
      await leaderPage.getByRole('button', {
        name: `选择 ${playerName(teamMemberID)} 加入任务队伍`,
      }).click()
    }
    await leaderPage.getByRole('button', {
      name: `确认队伍 ${proposal.payload.team.length}/${proposal.payload.team.length}`,
    }).click()

    const firstVoteIndex = run.transcript.findIndex(
      ({ command }) => command === 'castTeamVote',
    )
    const nextCommandIndex = run.transcript.findIndex(
      ({ command }, index) => index > firstVoteIndex && command !== 'castTeamVote',
    )
    expect(firstVoteIndex).toBeGreaterThan(-1)
    expect(nextCommandIndex).toBeGreaterThan(firstVoteIndex)
    await harness.dispatch(run.transcript[firstVoteIndex])
    const submittedVotePage = harness.pages[Number(run.transcript[firstVoteIndex].actor)]
    const showSubmittedVoterRole = submittedVotePage.getByRole('button', {
      name: '查看我的身份与已知信息',
    })
    if (await showSubmittedVoterRole.isVisible()) {
      await showSubmittedVoterRole.click()
    }
    await expect(submittedVotePage.getByRole('button', {
      name: '隐藏我的身份与已知信息',
    })).toBeVisible()
    await expect(submittedVotePage.locator('#current-player-avatar [data-role-avatar]')).toBeVisible()
    for (let index = firstVoteIndex + 1; index < nextCommandIndex; index += 1) {
      await harness.dispatch(run.transcript[index])
    }
    await expect(submittedVotePage.locator('#current-player-avatar [data-role-avatar]')).toBeVisible()
    await expect(submittedVotePage.getByLabel('任务计分板', { exact: true })).toBeVisible()
    expect(consoleErrors).toEqual([])
  } finally {
    await harness.close()
  }
})
