import { expect, test } from '@playwright/test'

import { playScriptedScenario } from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

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

    await harness.dispatch(run.transcript[0])
    const leaderPage = harness.pages[Number(run.transcript[proposeIndex].actor)]
    await leaderPage.reload()
    await expect(leaderPage.getByText('你的身份', { exact: true })).toBeVisible()
    await expect(leaderPage.getByRole('button', { name: /^提交 0\// })).toBeDisabled()

    await harness.dispatch(run.transcript[proposeIndex])
    await harness.dispatch(run.transcript[firstVoteIndex])
    const voteActor = run.transcript[firstVoteIndex].actor
    const votePage = harness.pages[Number(voteActor)]
    await expect(
      votePage.locator('p:visible').filter({ hasText: '你已投票：同意。等待其他玩家。' }),
    ).toBeVisible()
    for (const [index, page] of harness.pages.entries()) {
      if (String(index) === voteActor) continue
      await expect(page.getByRole('button', { name: '同意队伍' })).toBeEnabled()
      await expect(page.getByText(/你已投票/)).toHaveCount(0)
    }

    await votePage.reload()
    await expect(
      votePage.locator('p:visible').filter({ hasText: '你已投票：同意。等待其他玩家。' }),
    ).toBeVisible()
    await expect(votePage.getByRole('button', { name: '同意队伍' })).toHaveCount(0)

    for (let index = firstVoteIndex + 1; index < firstQuestCardIndex; index += 1) {
      await harness.dispatch(run.transcript[index])
    }

    await harness.dispatch(run.transcript[firstQuestCardIndex])
    const cardActor = run.transcript[firstQuestCardIndex].actor
    const cardPage = harness.pages[Number(cardActor)]
    const nextCardActor = run.transcript
      .slice(firstQuestCardIndex + 1)
      .find(({ command }) => command === 'playQuestCard')!.actor
    const pendingTeammatePage = harness.pages[Number(nextCardActor)]
    await expect(
      cardPage.locator('p:visible').filter({ hasText: '你已提交 Fail，等待任务结算。' }),
    ).toBeVisible()
    await expect(
      pendingTeammatePage.getByRole('button', { name: '让任务成功' }),
    ).toBeEnabled()
    for (const [index, page] of harness.pages.entries()) {
      if (String(index) === cardActor) continue
      await expect(page.getByText(/你已提交 (?:Success|Fail)/)).toHaveCount(0)
    }

    await cardPage.reload()
    await expect(
      cardPage.locator('p:visible').filter({ hasText: '你已提交 Fail，等待任务结算。' }),
    ).toBeVisible()
    await expect(cardPage.getByRole('button', { name: '让任务失败' })).toHaveCount(0)

    for (let index = firstQuestCardIndex + 1; index < run.transcript.length; index += 1) {
      await harness.dispatch(run.transcript[index])
    }
    const snapshot = await harness.snapshot()
    expect(snapshot.resultHeadings).toEqual(
      Array.from({ length: 5 }, () => '邪恶阵营获胜'),
    )
  } finally {
    await harness.close()
  }
})
