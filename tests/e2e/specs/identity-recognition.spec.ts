import { expect, test } from '@playwright/test'

import {
  type BrowserRecognitionStep,
  confirmRecognitionParticipants,
  createBrowserReplayHarness,
  playerName,
} from '../support/browser-replay'

const baseRecognitionOrder = [
  'roleReveal',
  'evilRecognition',
  'merlinRecognition',
] as const satisfies readonly BrowserRecognitionStep[]
const pairedRecognitionOrder = [
  ...baseRecognitionOrder,
  'percivalRecognition',
] as const satisfies readonly BrowserRecognitionStep[]

type PresentedRole =
  | 'merlin'
  | 'percival'
  | 'assassin'
  | 'morgana'
  | 'loyal_servant'
  | 'minion'

const recognitionViewports = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
  { width: 1339, height: 786 },
]

async function expectRecognitionLayerCoversStage({
  page,
  playerCount,
  viewport,
}: {
  page: import('@playwright/test').Page
  playerCount: number
  viewport: { width: number, height: number }
}) {
  await page.setViewportSize(viewport)

  const recognitionOverlay = page.locator('[data-room-slot="stage-atmosphere"]')
  const recognitionLayer = page.locator('[data-identity-recognition-atmosphere]')
  const confirmationButton = page.getByRole('button', { exact: true, name: '我已辨认' })

  await expect(recognitionOverlay).toBeVisible()
  await expect(recognitionLayer).toBeVisible()
  await expect(recognitionOverlay.getByRole('button')).toHaveCount(0)
  await expect(confirmationButton).toBeVisible()

  const geometry = await recognitionOverlay.evaluate((layer) => {
    const stage = layer.closest('[data-room-slot="stage"]')
      ?.querySelector('.avalon-room-layout__stage-content')
    const stageRect = stage?.getBoundingClientRect()
    const layerRect = layer.getBoundingClientRect()

    return {
      coversStage: stageRect !== undefined
        && Math.abs(layerRect.left - stageRect.left) <= 1
        && Math.abs(layerRect.right - stageRect.right) <= 1
        && Math.abs(layerRect.top - stageRect.top) <= 1
        && Math.abs(layerRect.bottom - stageRect.bottom) <= 1,
    }
  })

  const buttonSize = await confirmationButton.evaluate((button) => {
    const bounds = button.getBoundingClientRect()
    return { height: bounds.height, width: bounds.width }
  })
  expect(buttonSize.height).toBeGreaterThanOrEqual(44)
  expect(buttonSize.width).toBeGreaterThanOrEqual(44)
  expect(
    geometry.coversStage,
    `${playerCount} players @ ${viewport.width}x${viewport.height}`,
  ).toBe(true)

}

test('recognition overlay covers the measured stage in every business shell', async ({
  browser,
}) => {
  test.setTimeout(180_000)

  for (const playerCount of [5, 10]) {
    const harness = await createBrowserReplayHarness({
      browser,
      playerCount,
      roleConfiguration: { percivalMorgana: false },
    })

    try {
      await harness.dispatch({ actor: '0', command: 'startGame' })
      await confirmRecognitionParticipants(harness.pages, 'roleReveal')

      const participantIndex = await Promise.all(harness.pages.map(async (page, index) => (
        await page.getByRole('button', { exact: true, name: '我已辨认' }).count() === 1
          ? index
          : -1
      ))).then((indices) => indices.find((index) => index >= 0))
      if (participantIndex === undefined) throw new Error('Expected an Evil-recognition participant')
      const responsiveParticipantPage = harness.pages[participantIndex]!
      for (const viewport of recognitionViewports) {
        await expectRecognitionLayerCoversStage({
          page: responsiveParticipantPage,
          playerCount,
          viewport,
        })
      }

      await responsiveParticipantPage.setViewportSize({ width: 390, height: 844 })
      const confirmationButton = responsiveParticipantPage.getByRole('button', {
        name: /我已辨认/,
      })
      await confirmationButton.focus()
      await expect(confirmationButton).toBeFocused()
      await responsiveParticipantPage.setViewportSize({ width: 1339, height: 786 })
      await expect(confirmationButton).toBeFocused()

      for (const step of baseRecognitionOrder.slice(1)) {
        await confirmRecognitionParticipants(harness.pages, step)
      }
      for (const page of harness.pages) {
        await expect(page.locator('[data-room-screen="true"]')).toHaveAttribute(
          'data-room-scene',
          'teamProposal',
        )
        await expect(page.locator('[data-identity-recognition-atmosphere]')).toHaveCount(0)
      }
    } finally {
      await harness.close()
    }
  }
})

test('players complete the curtain-based identity recognition ceremony', async ({
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
    const roleByPlayer = new Map<string, PresentedRole>()
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

      const backButton = page.getByRole('button', { name: '返回主页' })
      expect(await backButton.evaluate((button) => {
        const bounds = button.getBoundingClientRect()
        const topmost = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
        return topmost === button || button.contains(topmost)
      })).toBe(true)
    }
    for (const [index, page] of harness.pages.entries()) {
      const role = await page.locator('[data-role-card]').getAttribute('data-role-card')
      if (role === null) throw new Error(`Player ${index} has no role card`)
      roleByPlayer.set(String(index), role as PresentedRole)
    }

    for (const step of pairedRecognitionOrder) {
      const expectedParticipantIDs = Array.from(roleByPlayer.entries())
        .filter(([, role]) => (
          step === 'roleReveal'
            ? true
            : step === 'evilRecognition'
              ? role === 'assassin' || role === 'morgana' || role === 'minion'
              : step === 'merlinRecognition'
                ? role === 'merlin'
                : role === 'percival'
        ))
        .map(([playerID]) => playerID)
        .sort()

      if (step !== 'roleReveal') {
        for (const [index, page] of harness.pages.entries()) {
          const confirmation = page.getByRole('button', { exact: true, name: '我已辨认' })
          if (expectedParticipantIDs.includes(String(index))) {
            await expect(confirmation).toBeVisible()
          } else {
            await expect(confirmation).toHaveCount(0)
            await expect(page.locator('[data-identity-recognition-label]')).toHaveCount(0)
          }
        }
      }

      if (step === 'evilRecognition') {
        const nonParticipantPage = harness.pages.find(
          (_, index) => !expectedParticipantIDs.includes(String(index)),
        )
        if (nonParticipantPage === undefined) throw new Error('Expected an Evil-recognition nonparticipant')
        await expect(nonParticipantPage.locator('[data-identity-recognition-atmosphere]')).toHaveCount(0)
        const backButton = nonParticipantPage.getByRole('button', { name: '返回主页' })
        await expect(backButton).toBeVisible()
        expect(await backButton.evaluate((button) => {
          const bounds = button.getBoundingClientRect()
          const topmost = document.elementFromPoint(
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
          )
          return topmost === button || button.contains(topmost)
        })).toBe(true)
        const evilPage = harness.pages[Number(expectedParticipantIDs[0])]
        await expect(evilPage.locator('[data-identity-recognition-label][data-recognition-tone="ally"]'))
          .toHaveCount(expectedParticipantIDs.length - 1)
      }

      if (step === 'merlinRecognition') {
        await expect(
          harness.pages[Number(expectedParticipantIDs[0])]
            .locator('[data-identity-recognition-label][data-recognition-tone="evil"]'),
        ).toHaveCount(2)
      }

      if (step === 'percivalRecognition') {
        const percivalPage = harness.pages[Number(expectedParticipantIDs[0])]
        const candidateIDs = Array.from(roleByPlayer.entries())
          .filter(([, role]) => role === 'merlin' || role === 'morgana')
          .map(([playerID]) => playerID)
          .sort()
        const candidateBadges = percivalPage.locator(
          '[data-identity-recognition-label][data-recognition-tone="candidate"]',
        )
        await expect(candidateBadges).toHaveCount(2)
        const markedPlayerIDs = await candidateBadges.evaluateAll((badges) => badges.map((badge) => (
          badge.closest('[data-player-id]')?.getAttribute('data-player-id') ?? ''
        )).sort())
        expect(markedPlayerIDs).toEqual(candidateIDs)
        for (const [index, page] of harness.pages.entries()) {
          if (String(index) === expectedParticipantIDs[0]) continue
          await expect(page.locator('[data-identity-recognition-label][data-recognition-tone="candidate"]'))
            .toHaveCount(0)
        }
      }

      const confirmedParticipantIDs = await confirmRecognitionParticipants(
        harness.pages,
        step,
      )
      expect(confirmedParticipantIDs.sort()).toEqual(expectedParticipantIDs)
    }

    const percivalID = Array.from(roleByPlayer.entries()).find(([, role]) => role === 'percival')?.[0]
    if (percivalID === undefined) throw new Error('Expected Percival in paired-role room')
    for (const page of harness.pages) {
      await expect(page.locator('[data-room-screen="true"]')).toHaveAttribute(
        'data-room-scene',
        'teamProposal',
      )
      await expect(page.getByRole('button', {
        name: '查看我的身份与已知信息',
      })).toBeVisible()
    }
    const percivalPage = harness.pages[Number(percivalID)]
    for (const page of harness.pages) {
      await expect(page.getByLabel('Merlin 候选', { exact: true })).toHaveCount(0)
    }
    await percivalPage.getByRole('button', {
      name: '查看我的身份与已知信息',
    }).click()
    await expect(percivalPage.getByLabel('Merlin 候选', { exact: true })).toHaveCount(2)
    await percivalPage.getByRole('button', {
      name: '隐藏我的身份与已知信息',
    }).click()
    await expect(percivalPage.getByLabel('Merlin 候选', { exact: true })).toHaveCount(0)

    const evilID = Array.from(roleByPlayer.entries()).find(([, role]) => (
      role === 'assassin' || role === 'morgana' || role === 'minion'
    ))?.[0]
    if (evilID === undefined) throw new Error('Expected an Evil player')
    const evilPage = harness.pages[Number(evilID)]
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
    await expect(evilPage.getByLabel('五次任务进度', { exact: true })).toBeVisible()
    await expect(evilPage.locator('[data-role-card]')).toHaveCount(0)
    await expect(evilAvatar.locator('[data-role-avatar]')).toBeVisible()
    const evilSeatGeometryAfter = await evilSeat.evaluate((seat) => {
      const avatar = seat.querySelector('[data-round-table-avatar]')!.getBoundingClientRect()
      const nameplate = seat.querySelector('[data-round-table-nameplate]')!.getBoundingClientRect()
      return {
        avatar: [avatar.x, avatar.y, avatar.width, avatar.height],
        nameplate: [nameplate.x, nameplate.y, nameplate.width, nameplate.height],
      }
    })
    expect(evilSeatGeometryAfter.avatar).toEqual(evilSeatGeometryBefore.avatar)
    expect(evilSeatGeometryAfter.nameplate).toEqual(evilSeatGeometryBefore.nameplate)
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

    const leaderID = await harness.pages[0]
      .locator('[data-round-table-player][aria-label*="队长"]')
      .getAttribute('data-player-id')
    if (leaderID === null) throw new Error('Expected a leader after recognition')
    const leaderPage = harness.pages[Number(leaderID)]
    const proposalTeam = ['0', '1']
    const preservedPlayerID = proposalTeam[0]
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
    await expect(leaderPage.getByLabel('五次任务进度', { exact: true })).toBeVisible()
    await expect(preservedSeat).toBeEnabled()
    await expect(preservedSeat).toHaveAttribute('aria-pressed', 'true')

    for (const teamMemberID of proposalTeam.slice(1)) {
      await leaderPage.getByRole('button', {
        name: `选择 ${playerName(teamMemberID)} 加入任务队伍`,
      }).click()
    }
    await leaderPage.getByRole('button', {
      exact: true,
      name: '确认队伍',
    }).click()

    await harness.dispatch({
      actor: '0',
      command: 'castTeamVote',
      payload: { vote: 'approve' },
    })
    const submittedVotePage = harness.pages[0]
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
    for (let index = 1; index < harness.pages.length; index += 1) {
      await harness.dispatch({
        actor: String(index),
        command: 'castTeamVote',
        payload: { vote: 'approve' },
      })
    }
    await expect(submittedVotePage.locator('#current-player-avatar [data-role-avatar]')).toBeVisible()
    await expect(submittedVotePage.getByLabel('五次任务进度', { exact: true })).toBeVisible()
    expect(consoleErrors).toEqual([])
  } finally {
    await harness.close()
  }
})
