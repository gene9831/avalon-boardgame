import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

import type { AvalonCommand, ReplayDriver } from '@avalon/test-support'

export interface BrowserReplaySnapshot {
  resultHeadings: string[]
  urls: string[]
}

export interface BrowserReplayHarness
  extends ReplayDriver<BrowserReplaySnapshot> {
  matchID: string
  pages: Page[]
  close(): Promise<void>
}

export function playerName(playerID: string) {
  return `Replay Player ${Number(playerID) + 1}`
}

export async function setPlayerProfileName(page: Page, name: string) {
  await page.getByRole('button', { name: '打开用户中心' }).click()
  const profile = page.getByRole('dialog', { name: '用户中心' })
  await profile.getByRole('textbox', { name: '显示名称' }).fill(name)
  await profile.getByRole('button', { name: '保存资料' }).click()
}

export async function createRoom(
  page: Page,
  playerCount: number,
  name = playerName('0'),
) {
  await page.goto('/')
  await setPlayerProfileName(page, name)
  const createButton = page.getByRole('button', { name: '创建房间' })
  await expect(createButton).toBeEnabled()
  await createButton.click()
  const createDialog = page.getByRole('dialog', { name: '创建一局阿瓦隆' })
  await createDialog.getByRole('button', { name: String(playerCount), exact: true }).click()
  await createDialog.getByRole('button', { name: '创建房间' }).click()
  await expect(page).toHaveURL(/\/rooms\/[^/]+$/)

  const match = /\/rooms\/([^/]+)$/.exec(new URL(page.url()).pathname)
  if (match === null) throw new Error('Created room URL has no match ID')
  return decodeURIComponent(match[1])
}

export async function joinRoom(
  page: Page,
  matchID: string,
  playerID: string,
  name = playerName(playerID),
) {
  await page.goto('/')
  await setPlayerProfileName(page, name)
  const roomHeading = page.getByText(`房间 ${matchID}`, { exact: true })
  await expect(roomHeading).toBeVisible()
  const room = roomHeading.locator('xpath=ancestor::article')
  await room.getByLabel(`选择 ${matchID} 的座位`).selectOption(playerID)
  await room.getByRole('button', { name: '加入' }).click()
  await expect(page).toHaveURL(new RegExp(`/rooms/${matchID}$`))
}

export async function createBrowserReplayHarness(options: {
  browser: Browser
  playerCount: number
}): Promise<BrowserReplayHarness> {
  const contexts: BrowserContext[] = []

  try {
    for (let index = 0; index < options.playerCount; index += 1) {
      contexts.push(await options.browser.newContext())
    }
    const pages = await Promise.all(contexts.map((context) => context.newPage()))
    const matchID = await createRoom(pages[0], options.playerCount)
    for (let index = 1; index < options.playerCount; index += 1) {
      await joinRoom(pages[index], matchID, String(index))
    }
    await expect(
      pages[0].getByRole('button', { name: '开始游戏' }),
    ).toBeEnabled()

    return {
      matchID,
      pages,
      async dispatch(command: AvalonCommand) {
        const page = pages[Number(command.actor)]
        if (page === undefined) {
          throw new Error(`No browser page for player ${command.actor}`)
        }

        switch (command.command) {
          case 'startGame':
            await page.getByRole('button', { name: '开始游戏' }).click()
            await expect(
              pages[0].locator('[data-curtain-state="lowered"]'),
            ).toBeVisible()
            return
          case 'confirmIdentityRecognition':
            const confirmationButton = page.getByRole('button', {
              name: /^我已(确认身份|辨认同伴|辨认邪恶阵营)$/,
            })
            const confirmationLabel = await confirmationButton.textContent()
            if (confirmationLabel === null) {
              throw new Error('Identity confirmation button has no label')
            }
            await confirmationButton.click()
            await expect(page.getByRole('button', {
              exact: true,
              name: confirmationLabel,
            })).toHaveCount(0)
            return
          case 'proposeTeam':
            for (const teamMemberID of command.payload.team) {
              await page.getByRole('button', {
                name: `选择 ${playerName(teamMemberID)} 加入任务队伍`,
              }).click()
            }
            await page.getByRole('button', {
              name: `确认队伍 ${command.payload.team.length}/${command.payload.team.length}`,
            }).click()
            return
          case 'castTeamVote':
            await page.getByRole('button', {
              name: command.payload.vote === 'approve' ? '赞成队伍' : '反对队伍',
            }).click()
            return
          case 'playQuestCard':
            await page.getByRole('button', {
              name: command.payload.card === 'success'
                ? '让任务成功'
                : '让任务失败',
            }).click()
            return
          case 'assassinate':
            await page.getByRole('button', {
              name: `选择 ${playerName(command.payload.targetID)} 作为刺杀目标`,
            }).click()
            await page.getByRole('button', { name: '确认目标' }).click()
        }
      },
      async snapshot() {
        const resultHeadings = await Promise.all(
          pages.map(async (page) => {
            const heading = page
              .locator('p:visible')
              .filter({ hasText: /^(正义|邪恶)阵营获胜$/ })
              .first()
            await expect(heading).toBeVisible()
            return (await heading.textContent()) ?? ''
          }),
        )
        return {
          resultHeadings,
          urls: pages.map((page) => page.url()),
        }
      },
      async close() {
        await Promise.allSettled(contexts.map((context) => context.close()))
      },
    }
  } catch (error) {
    await Promise.all(contexts.map((context) => context.close()))
    throw error
  }
}
