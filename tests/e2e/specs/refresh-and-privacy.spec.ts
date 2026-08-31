import { expect, test } from '@playwright/test'

import { playScriptedScenario } from '@avalon/test-support'

import {
  createBrowserReplayHarness,
  createRoom,
  playerName,
} from '../support/browser-replay'

const roomSessionKey = (matchID: string) =>
  `avalon:room-session:${encodeURIComponent(matchID)}`
const seatTransitionKey = (matchID: string) =>
  `avalon:seat-transition:${encodeURIComponent(matchID)}`

test('a transient committed seat change recovers both same-browser room routes at the target seat', async ({
  browser,
}) => {
  test.setTimeout(90_000)

  const context = await browser.newContext()
  const movingPage = await context.newPage()
  const stalePage = await context.newPage()
  let releaseTransientResponse: () => void = () => undefined
  let reportServerCommit: () => void = () => undefined
  const transientResponseReleased = new Promise<void>((resolve) => {
    releaseTransientResponse = resolve
  })
  const serverCommitted = new Promise<void>((resolve) => {
    reportServerCommit = resolve
  })

  try {
    const matchID = await createRoom(movingPage, 5, 'Recovering Owner')
    const roomURL = `/rooms/${matchID}`
    await stalePage.goto(roomURL)
    await expect(stalePage.getByLabel('5 人玩家圆桌')).toBeVisible()

    for (const page of [movingPage, stalePage]) {
      await page.evaluate((key) => {
        const raw = localStorage.getItem(key)
        if (raw === null) throw new Error('Expected a saved room session')
        const session = JSON.parse(raw) as { credentials?: unknown }
        if (typeof session.credentials !== 'string') {
          throw new Error('Expected saved room credentials')
        }
        sessionStorage.setItem('e2e:original-room-credentials', session.credentials)
      }, roomSessionKey(matchID))
    }

    await context.route('**/rooms/avalon/*/players/*/seat', async (route) => {
      const committed = await route.fetch()
      expect(committed.ok()).toBe(true)
      reportServerCommit()
      await transientResponseReleased
      await route.fulfill({
        body: JSON.stringify({ error: { code: 'transient_failure' } }),
        contentType: 'application/json',
        status: 503,
      })
    })

    await movingPage.getByRole('button', { name: '移至 5 号空座位' }).click()
    await serverCommitted
    await expect.poll(() => movingPage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { status?: unknown }).status ?? null
    }, seatTransitionKey(matchID))).toBe('requesting')

    await movingPage.waitForTimeout(3_000)
    await expect(movingPage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect(stalePage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect.poll(() => movingPage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { playerID?: unknown }).playerID ?? null
    }, roomSessionKey(matchID))).toBe('0')

    releaseTransientResponse()
    await expect(movingPage.getByText('换座失败，请重试。', { exact: true })).toBeVisible()
    await expect.poll(() => movingPage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { playerID?: unknown }).playerID ?? null
    }, roomSessionKey(matchID))).toBe('4')
    await expect.poll(() => movingPage.evaluate((key) => localStorage.getItem(key), seatTransitionKey(matchID)))
      .toBeNull()

    for (const page of [movingPage, stalePage]) {
      await expect(page).toHaveURL(new RegExp(`/rooms/${matchID}$`))
      await expect(page.locator('[data-round-table-player][data-player-id="4"]'))
        .toContainText('Recovering Owner')
      await expect.poll(() => page.evaluate((key) => {
        const raw = localStorage.getItem(key)
        if (raw === null) return false
        const current = JSON.parse(raw) as { credentials?: unknown, playerID?: unknown }
        return current.playerID === '4' &&
          current.credentials === sessionStorage.getItem('e2e:original-room-credentials')
      }, roomSessionKey(matchID))).toBe(true)
    }

    await stalePage.waitForTimeout(3_000)
    await expect.poll(() => stalePage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { playerID?: unknown }).playerID ?? null
    }, roomSessionKey(matchID))).toBe('4')
  } finally {
    releaseTransientResponse()
    await context.close()
  }
})

test('refresh restores server data and keeps pending choices private', async ({
  browser,
}) => {
  const run = playScriptedScenario({
    masterSeed: process.env.E2E_MASTER_SEED ?? 'playwright-smoke',
    scenario: 'three-failed-quests',
  })
  const harness = await createBrowserReplayHarness({ browser, playerCount: 5 })

  try {
    const proposeIndex = run.transcript.findIndex(
      ({ command }) => command === 'proposeTeam',
    )
    const firstVoteIndex = run.transcript.findIndex(
      ({ command }) => command === 'castTeamVote',
    )
    const firstQuestCardIndex = run.transcript.findIndex(
      ({ command }) => command === 'playQuestCard',
    )
    expect([proposeIndex, firstVoteIndex, firstQuestCardIndex]).not.toContain(-1)

    for (let index = 0; index < proposeIndex; index += 1) {
      await harness.dispatch(run.transcript[index])
    }
    const leaderPage = harness.pages[Number(run.transcript[proposeIndex].actor)]
    await leaderPage.reload()
    await expect(leaderPage.getByLabel('阿瓦隆游戏圆桌')).toBeVisible()
    await expect(leaderPage.getByRole('button', { name: /^确认队伍 0\// })).toBeDisabled()

    await harness.dispatch(run.transcript[proposeIndex])
    const firstVote = run.transcript[firstVoteIndex]
    if (firstVote.command !== 'castTeamVote') {
      throw new Error('Expected the first vote command')
    }
    const voteActor = firstVote.actor
    const votePage = harness.pages[Number(voteActor)]
    const submitterSeatBeforeVote = votePage.locator('[data-round-table-player]').filter({
      hasText: playerName(voteActor),
    }).first()
    const geometryBeforeVote = await submitterSeatBeforeVote.evaluate((seat) => {
      const avatar = seat.querySelector('[data-round-table-avatar]')!.getBoundingClientRect()
      const nameplate = seat.querySelector('[data-round-table-nameplate]')!.getBoundingClientRect()
      return {
        avatar: [avatar.x, avatar.y, avatar.width, avatar.height],
        nameplate: [nameplate.x, nameplate.y, nameplate.width, nameplate.height],
      }
    })

    await harness.dispatch(firstVote)
    await expect(
      votePage.getByText(
        `你已选择：${firstVote.payload.vote === 'approve' ? '赞成' : '反对'}`,
        { exact: true },
      ),
    ).toBeVisible()
    for (const [index, page] of harness.pages.entries()) {
      await expect(page.getByText('1/5 已投票', { exact: true })).toBeVisible()
      const submitterSeat = page.getByRole('button', {
        name: new RegExp(`^${playerName(voteActor)}.*已投票$`),
      })
      await expect(submitterSeat).toBeVisible()
      await expect(submitterSeat.locator('[data-team-vote-status="pending"]')).toHaveAttribute('title', '已投票')
      if (String(index) === voteActor) continue
      await expect(page.getByRole('button', { name: '赞成队伍' })).toBeEnabled()
      await expect(page.getByText(/你已选择：/)).toHaveCount(0)
    }
    const geometryAfterVote = await submitterSeatBeforeVote.evaluate((seat) => {
      const avatar = seat.querySelector('[data-round-table-avatar]')!.getBoundingClientRect()
      const nameplate = seat.querySelector('[data-round-table-nameplate]')!.getBoundingClientRect()
      const nameplateStyle = getComputedStyle(seat.querySelector('[data-round-table-nameplate]')!)
      const voteIndicatorElement = seat.querySelector('[data-team-vote-status]')!
      const voteIndicator = voteIndicatorElement.getBoundingClientRect()
      const voteIndicatorStyle = getComputedStyle(voteIndicatorElement)
      return {
        avatar: [avatar.x, avatar.y, avatar.width, avatar.height],
        iconLeft: voteIndicator.left,
        iconRight: voteIndicator.right,
        nameplate: [nameplate.x, nameplate.y, nameplate.width, nameplate.height],
        nameplateLeft: nameplate.left,
        nameplatePadding: [
          Number.parseFloat(nameplateStyle.paddingLeft),
          Number.parseFloat(nameplateStyle.paddingRight),
        ],
        nameplateRight: nameplate.right,
        pendingIconHasBorder: Number.parseFloat(voteIndicatorStyle.borderTopWidth) > 0,
        pendingIconHasOpaqueBackground: voteIndicatorStyle.backgroundColor !== 'rgba(0, 0, 0, 0)',
      }
    })
    geometryAfterVote.avatar.forEach((value, index) => {
      expect(value).toBeCloseTo(geometryBeforeVote.avatar[index]!, 1)
    })
    geometryAfterVote.nameplate.forEach((value, index) => {
      expect(value).toBeCloseTo(geometryBeforeVote.nameplate[index]!, 1)
    })
    expect(geometryAfterVote.nameplatePadding[1]).toBeCloseTo(
      geometryAfterVote.nameplatePadding[0]!,
      1,
    )
    expect(
      geometryAfterVote.iconRight <= geometryAfterVote.nameplateLeft - 2
      || geometryAfterVote.iconLeft >= geometryAfterVote.nameplateRight + 2,
    ).toBe(true)
    expect(geometryAfterVote.pendingIconHasBorder).toBe(false)
    expect(geometryAfterVote.pendingIconHasOpaqueBackground).toBe(false)

    await votePage.reload()
    await expect(
      votePage.getByText(
        `你已选择：${firstVote.payload.vote === 'approve' ? '赞成' : '反对'}`,
        { exact: true },
      ),
    ).toBeVisible()
    await expect(votePage.getByRole('button', { name: '赞成队伍' })).toHaveCount(0)

    for (let index = firstVoteIndex + 1; index < firstQuestCardIndex; index += 1) {
      await harness.dispatch(run.transcript[index])
    }

    const settledVotes = run.transcript
      .slice(firstVoteIndex, firstQuestCardIndex)
      .filter((entry) => entry.command === 'castTeamVote')
    const approvalCount = settledVotes.filter(
      (entry) => entry.payload.vote === 'approve',
    ).length
    const rejectionCount = settledVotes.length - approvalCount
    const settledSummary = `队伍${approvalCount > settledVotes.length / 2 ? '通过' : '否决'} · ${approvalCount} 赞成 / ${rejectionCount} 反对`

    for (const page of harness.pages) {
      await expect(page.getByText(settledSummary, { exact: true })).toBeVisible()
      for (const vote of settledVotes) {
        const expectedChoice = vote.payload.vote === 'approve' ? '赞成' : '反对'
        await expect(page.getByRole('button', {
          name: new RegExp(`^${playerName(vote.actor)}.*${expectedChoice}$`),
        })).toBeVisible()
      }
    }

    const settledIndicatorGeometry = await votePage
      .locator('[data-team-vote-status="approve"], [data-team-vote-status="reject"]')
      .evaluateAll((indicators) => indicators.map((indicator) => {
        const nameplate = indicator
          .closest('[data-round-table-player]')!
          .querySelector('[data-round-table-nameplate]')!
        const indicatorBounds = indicator.getBoundingClientRect()
        const nameplateBounds = nameplate.getBoundingClientRect()
        const indicatorStyle = getComputedStyle(indicator)
        return {
          centerDeltaY: Math.abs(
            indicatorBounds.top + indicatorBounds.height / 2
              - (nameplateBounds.top + nameplateBounds.height / 2),
          ),
          hasBorder: Number.parseFloat(indicatorStyle.borderTopWidth) > 0,
          hasOpaqueBackground: indicatorStyle.backgroundColor !== 'rgba(0, 0, 0, 0)',
        }
      }))
    expect(settledIndicatorGeometry).toHaveLength(5)
    for (const geometry of settledIndicatorGeometry) {
      expect(geometry.centerDeltaY).toBeLessThanOrEqual(0.5)
      expect(geometry.hasBorder).toBe(false)
      expect(geometry.hasOpaqueBackground).toBe(false)
    }

    await harness.dispatch(run.transcript[firstQuestCardIndex])
    const cardActor = run.transcript[firstQuestCardIndex].actor
    const cardPage = harness.pages[Number(cardActor)]
    const nextCardActor = run.transcript
      .slice(firstQuestCardIndex + 1)
      .find(({ command }) => command === 'playQuestCard')!.actor
    const pendingTeammatePage = harness.pages[Number(nextCardActor)]
    await expect(
      cardPage.locator('p:visible').filter({ hasText: '你已提交失败，等待任务结算。' }),
    ).toBeVisible()
    await expect(
      pendingTeammatePage.getByRole('button', { name: '让任务成功' }),
    ).toBeEnabled()
    for (const [index, page] of harness.pages.entries()) {
      if (String(index) === cardActor) continue
      await expect(page.getByText(/你已提交(?:成功|失败)/)).toHaveCount(0)
    }

    await cardPage.reload()
    await expect(
      cardPage.locator('p:visible').filter({ hasText: '你已提交失败，等待任务结算。' }),
    ).toBeVisible()
    await expect(cardPage.getByRole('button', { name: '让任务失败' })).toHaveCount(0)

    const nextPhaseCommandIndex = run.transcript.findIndex(
      ({ command }, index) => index > firstQuestCardIndex && command !== 'playQuestCard',
    )
    expect(nextPhaseCommandIndex).toBeGreaterThan(firstQuestCardIndex)
    for (let index = firstQuestCardIndex + 1; index < nextPhaseCommandIndex; index += 1) {
      await harness.dispatch(run.transcript[index])
    }
    for (const page of harness.pages) {
      await expect(page.locator('[data-team-vote-status]')).toHaveCount(0)
      await expect(page.getByText(settledSummary, { exact: true })).toHaveCount(0)
    }

    for (let index = nextPhaseCommandIndex; index < run.transcript.length; index += 1) {
      await harness.dispatch(run.transcript[index])
    }
    const snapshot = await harness.snapshot()
    expect(snapshot.resultHeadings).toEqual(
      Array.from({ length: 5 }, () => '邪恶阵营获胜'),
    )
    for (const page of harness.pages) {
      await expect(page.locator('[data-round-table-avatar] [data-role-avatar]')).toHaveCount(5)
      await expect(page.locator('[data-visible-role]')).toHaveCount(5)
      await expect(page.getByRole('button', { name: /我的身份与已知信息/ })).toHaveCount(0)
      await expect(page.locator('[data-known-player-info]')).toHaveCount(0)
    }
  } finally {
    await harness.close()
  }
})
