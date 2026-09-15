import { expect, test } from '@playwright/test'

import { playScriptedScenario } from '@avalon/test-support'

import {
  createBrowserReplayHarness,
  createRoom,
  joinRoom,
} from '../support/browser-replay'

const roomSessionKey = (matchID: string) =>
  `avalon:room-session:${encodeURIComponent(matchID)}`
const seatTransitionKey = (matchID: string) =>
  `avalon:seat-transition:${encodeURIComponent(matchID)}`

test('the IndexedDB lock fallback serializes two tabs and recovers a transient committed seat change', async ({
  browser,
}) => {
  test.setTimeout(90_000)

  const hostContext = await browser.newContext()
  const context = await browser.newContext()
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })
  })
  const hostPage = await hostContext.newPage()
  const movingPage = await context.newPage()
  const stalePage = await context.newPage()
  let releaseTransientResponse: () => void = () => undefined
  let releaseExitRequest: () => void = () => undefined
  let releaseRecoveryRequests: () => void = () => undefined
  let reportServerCommit: () => void = () => undefined
  let reportExitRequest: () => void = () => undefined
  let reportExitResponse: (status: number) => void = () => undefined
  let seatChangeRequestCount = 0
  const transientResponseReleased = new Promise<void>((resolve) => {
    releaseTransientResponse = resolve
  })
  const exitRequestReleased = new Promise<void>((resolve) => {
    releaseExitRequest = resolve
  })
  const recoveryRequestsReleased = new Promise<void>((resolve) => {
    releaseRecoveryRequests = resolve
  })
  const serverCommitted = new Promise<void>((resolve) => {
    reportServerCommit = resolve
  })
  const exitRequestStarted = new Promise<void>((resolve) => {
    reportExitRequest = resolve
  })
  const exitResponse = new Promise<number>((resolve) => {
    reportExitResponse = resolve
  })

  try {
    const matchID = await createRoom(hostPage, 5, 'Room Owner')
    const roomURL = `/rooms/${matchID}`
    await joinRoom(movingPage, matchID, '1', 'Recovering Guest')
    await stalePage.goto(roomURL)
    await expect(stalePage.getByLabel('5 人游戏圆桌')).toBeVisible()
    await expect.poll(() => Promise.all([
      movingPage.evaluate(() => navigator.locks === undefined),
      stalePage.evaluate(() => navigator.locks === undefined),
    ])).toEqual([true, true])

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
      seatChangeRequestCount += 1
      if (seatChangeRequestCount > 1) {
        await recoveryRequestsReleased
        const replayed = await route.fetch()
        expect(replayed.ok()).toBe(true)
        await route.fulfill({ response: replayed })
        return
      }

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

    await context.route(`**/rooms/avalon/${matchID}/players/1`, async (route) => {
      reportExitRequest()
      await exitRequestReleased
      const response = await route.fetch()
      reportExitResponse(response.status())
      await route.fulfill({ response })
    })

    await stalePage.getByRole('button', { name: '房间操作' }).click()
    await stalePage.getByRole('menuitem', { name: '退出房间' }).click()
    const exitDialog = stalePage.getByRole('dialog', { name: '确认退出房间' })
    await exitDialog.getByRole('button', { name: '退出房间' }).click()
    await exitRequestStarted

    await movingPage.getByRole('button', { name: '移至 5 号空座位' }).click()
    await serverCommitted
    await expect.poll(() => movingPage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { status?: unknown }).status ?? null
    }, seatTransitionKey(matchID))).toBe('requesting')
    await expect(stalePage.getByRole('button', { name: '重新连接' })).toBeVisible()
    expect(seatChangeRequestCount).toBe(1)
    const contender = await stalePage.evaluate(async (roomID) => {
      const modulePath = '/src/room-participation.ts'
      const roomParticipation = await import(modulePath) as {
        withBrowserSeatTransitionLock: <T>(
          matchID: string,
          action: () => Promise<T>,
        ) => Promise<T | null>
      }
      let actionStarted = false
      const result = await roomParticipation.withBrowserSeatTransitionLock(
        roomID,
        async () => {
          actionStarted = true
          return 'started'
        },
      )
      return { actionStarted, result }
    }, matchID)
    expect(contender).toEqual({ actionStarted: false, result: null })
    expect(seatChangeRequestCount).toBe(1)

    await expect(movingPage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect(stalePage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect.poll(() => movingPage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { playerID?: unknown }).playerID ?? null
    }, roomSessionKey(matchID))).toBe('1')

    releaseExitRequest()
    await expect(exitResponse).resolves.toBe(403)
    await expect(movingPage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect(stalePage).toHaveURL(new RegExp(`/rooms/${matchID}$`))
    await expect.poll(() => stalePage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { playerID?: unknown }).playerID ?? null
    }, roomSessionKey(matchID))).toBe('1')

    releaseTransientResponse()
    await expect(movingPage.getByText('网络不稳定，正在确认换座结果。', { exact: true })).toBeVisible()
    await expect(movingPage.locator('[data-round-table-player][data-player-id="4"] [data-seat-state="pending"]'))
      .toBeVisible()
    await expect(movingPage.getByText('正在进入房间', { exact: true })).toHaveCount(0)
    await expect.poll(() => movingPage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { status?: unknown }).status ?? null
    }, seatTransitionKey(matchID))).toBe('uncertain')

    for (const page of [movingPage, stalePage]) {
      const exitButton = page.getByRole('menuitem', { name: '退出房间' })
      const roomMenu = page.getByRole('button', { name: '房间操作' })
      if (await roomMenu.count() === 0) {
        await expect(exitButton).toHaveCount(0)
        continue
      }
      if (!await exitButton.isVisible()) {
        await roomMenu.click()
      }
      await expect(exitButton).toBeDisabled()
    }

    releaseRecoveryRequests()
    await expect.poll(() => movingPage.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return (JSON.parse(raw) as { playerID?: unknown }).playerID ?? null
    }, roomSessionKey(matchID))).toBe('4')
    await expect.poll(() => movingPage.evaluate((key) => localStorage.getItem(key), seatTransitionKey(matchID)))
      .toBeNull()
    await expect(movingPage.getByText('已换到 5 号位', { exact: true })).toBeVisible()
    expect(seatChangeRequestCount).toBeGreaterThanOrEqual(2)

    for (const page of [movingPage, stalePage]) {
      await expect(page).toHaveURL(new RegExp(`/rooms/${matchID}$`))
      await expect(page.locator('[data-round-table-player][data-player-id="4"]'))
        .toContainText('Recovering Guest')
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
    releaseExitRequest()
    releaseTransientResponse()
    releaseRecoveryRequests()
    await Promise.allSettled([context.close(), hostContext.close()])
  }
})

test('refresh restores the unified room and keeps pending choices private', async ({
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
      await harness.dispatch(run.transcript[index]!)
    }

    const leaderPage = harness.pages[Number(run.transcript[proposeIndex]!.actor)]
    await leaderPage.reload()
    await expect(leaderPage.locator('[data-room-screen="true"]')).toHaveCount(1)
    await expect(leaderPage.getByLabel('5 人游戏圆桌')).toBeVisible()
    await expect(
      leaderPage.getByRole('button', { exact: true, name: '确认队伍' }),
    ).toBeDisabled()

    await harness.dispatch(run.transcript[proposeIndex]!)
    const firstVote = run.transcript[firstVoteIndex]
    if (firstVote?.command !== 'castTeamVote') {
      throw new Error('Expected the first vote command')
    }

    const votePage = harness.pages[Number(firstVote.actor)]
    await expect(votePage.locator('[data-room-screen="true"]')).toHaveAttribute(
      'data-room-scene',
      'teamVote',
    )
    await expect(votePage.getByLabel('5 人游戏圆桌')).toHaveAttribute(
      'data-stage-layout-status',
      'ready',
    )
    const submitterSeat = votePage.locator(
      `[data-round-table-player][data-player-id="${firstVote.actor}"]`,
    )
    await expect(submitterSeat).toBeVisible()
    const geometryBeforeVote = await submitterSeat.evaluate((seat) => {
      const avatar = seat
        .querySelector('[data-round-table-avatar]')!
        .getBoundingClientRect()
      const nameplate = seat
        .querySelector('[data-round-table-nameplate]')!
        .getBoundingClientRect()
      return {
        avatar: [avatar.x, avatar.y, avatar.width, avatar.height],
        nameplate: [nameplate.x, nameplate.y, nameplate.width, nameplate.height],
      }
    })

    await harness.dispatch(firstVote)
    for (const [index, page] of harness.pages.entries()) {
      await expect(
        page.getByLabel('5 人游戏圆桌'),
      ).toContainText('已投票 1 / 5')
      const publicSubmitterSeat = page.locator(
        `[data-round-table-player][data-player-id="${firstVote.actor}"]`,
      )
      await expect(publicSubmitterSeat).toHaveAttribute('aria-label', /已投票/)
      await expect(
        publicSubmitterSeat.locator('[data-seat-decoration="vote"]'),
      ).toHaveCount(1)

      if (String(index) === firstVote.actor) {
        await expect(
          page.locator('[data-room-slot="phase-middle"]'),
        ).toContainText(
          `你已提交${firstVote.payload.vote === 'approve' ? '同意票' : '反对票'}`,
        )
      } else {
        await expect(
          page.getByRole('button', { exact: true, name: '同意任务队伍' }),
        ).toBeEnabled()
      }
      if (String(index) !== firstVote.actor) {
        await expect(page.getByText(/你已提交(?:同意票|反对票)/)).toHaveCount(0)
      }
    }

    const geometryAfterVote = await submitterSeat.evaluate((seat) => {
      const avatar = seat
        .querySelector('[data-round-table-avatar]')!
        .getBoundingClientRect()
      const nameplate = seat
        .querySelector('[data-round-table-nameplate]')!
        .getBoundingClientRect()
      return {
        avatar: [avatar.x, avatar.y, avatar.width, avatar.height],
        nameplate: [nameplate.x, nameplate.y, nameplate.width, nameplate.height],
      }
    })
    geometryAfterVote.avatar.forEach((value, index) => {
      expect(value).toBeCloseTo(geometryBeforeVote.avatar[index]!, 1)
    })
    geometryAfterVote.nameplate.forEach((value, index) => {
      expect(value).toBeCloseTo(geometryBeforeVote.nameplate[index]!, 1)
    })

    await votePage.reload()
    await expect(
      votePage.locator('[data-room-slot="phase-middle"]'),
    ).toContainText(
      `你已提交${firstVote.payload.vote === 'approve' ? '同意票' : '反对票'}`,
    )
    await expect(
      votePage.getByRole('button', { exact: true, name: '同意任务队伍' }),
    ).toHaveCount(0)

    for (let index = firstVoteIndex + 1; index < firstQuestCardIndex; index += 1) {
      await harness.dispatch(run.transcript[index]!)
    }

    const settledVotes = run.transcript
      .slice(firstVoteIndex, firstQuestCardIndex)
      .filter((entry) => entry.command === 'castTeamVote')
    for (const page of harness.pages) {
      for (const vote of settledVotes) {
        const expectedChoice = vote.payload.vote === 'approve' ? '赞成' : '反对'
        await expect(page.locator(
          `[data-round-table-player][data-player-id="${vote.actor}"]`,
        )).toHaveAttribute('aria-label', new RegExp(expectedChoice))
      }
    }

    const firstQuestCard = run.transcript[firstQuestCardIndex]
    if (firstQuestCard?.command !== 'playQuestCard') {
      throw new Error('Expected a quest card command')
    }
    await harness.dispatch(firstQuestCard)
    const cardPage = harness.pages[Number(firstQuestCard.actor)]
    const nextCard = run.transcript
      .slice(firstQuestCardIndex + 1)
      .find(({ command }) => command === 'playQuestCard')
    if (nextCard?.command !== 'playQuestCard') {
      throw new Error('Expected another quest card command')
    }
    const pendingTeammatePage = harness.pages[Number(nextCard.actor)]

    await expect(
      cardPage.locator('[data-room-slot="phase-middle"]'),
    ).toContainText(
      `你已提交${firstQuestCard.payload.card === 'success' ? '成功牌' : '失败牌'}`,
    )
    await expect(
      cardPage.getByRole('button', { name: /^(提交成功牌|确认任务牌|选择成功任务牌|选择失败任务牌)$/ }),
    ).toHaveCount(0)
    await expect(
      pendingTeammatePage.getByRole('button', { name: /^(提交成功牌|选择成功任务牌)$/ }),
    ).toBeEnabled()
    for (const [index, page] of harness.pages.entries()) {
      if (String(index) === firstQuestCard.actor) continue
      await expect(page.getByText(/你已提交(?:成功|失败)/)).toHaveCount(0)
    }

    await cardPage.reload()
    await expect(
      cardPage.locator('[data-room-slot="phase-middle"]'),
    ).toContainText(
      `你已提交${firstQuestCard.payload.card === 'success' ? '成功牌' : '失败牌'}`,
    )
    await expect(
      cardPage.getByRole('button', { name: /^(提交成功牌|确认任务牌|选择成功任务牌|选择失败任务牌)$/ }),
    ).toHaveCount(0)

    for (
      let index = firstQuestCardIndex + 1;
      index < run.transcript.length;
      index += 1
    ) {
      await harness.dispatch(run.transcript[index]!)
    }

    const snapshot = await harness.snapshot()
    expect(snapshot.resultHeadings).toEqual(
      Array.from({ length: 5 }, () => '邪恶阵营获胜'),
    )
    for (const page of harness.pages) {
      await expect(
        page.locator('[data-round-table-avatar] [data-role-avatar]'),
      ).toHaveCount(5)
      await expect(
        page.getByRole('button', { name: /我的身份与已知信息/ }),
      ).toHaveCount(0)
    }
  } finally {
    await harness.close()
  }
})
