import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

import type { AvalonCommand, ReplayDriver } from '@avalon/test-support'

interface BrowserRoleConfiguration {
  percivalMorgana: boolean
}

export type BrowserRecognitionStep =
  | 'roleReveal'
  | 'evilRecognition'
  | 'merlinRecognition'
  | 'percivalRecognition'

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
  roleConfiguration: BrowserRoleConfiguration = { percivalMorgana: false },
) {
  await page.goto('/')
  await setPlayerProfileName(page, name)
  const createButton = page.getByRole('button', { name: '创建房间' })
  await expect(createButton).toBeEnabled()
  await createButton.click()
  const createDialog = page.getByRole('dialog', { name: '创建一局阿瓦隆' })
  await createDialog.getByRole('button', { name: String(playerCount), exact: true }).click()
  const pairedRoleSwitch = createDialog.getByRole('switch', {
    name: /帕西维尔与莫甘娜/,
  })
  if (await pairedRoleSwitch.isChecked() !== roleConfiguration.percivalMorgana) {
    await pairedRoleSwitch.click()
  }
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
  const roomHeading = page.getByTitle(matchID, { exact: true })
  await expect(roomHeading).toBeVisible()
  const room = roomHeading.locator('xpath=ancestor::article')
  await room.getByRole('button', { name: '加入' }).click()
  await expect(page).toHaveURL(new RegExp(`/rooms/${matchID}$`))
}

const RECOGNITION_CONFIRMATION_LABELS: Record<BrowserRecognitionStep, string> = {
  roleReveal: '我已记住身份',
  evilRecognition: '我已辨认',
  merlinRecognition: '我已辨认',
  percivalRecognition: '我已辨认',
}

export async function confirmRecognitionParticipants(
  pages: readonly Page[],
  step: BrowserRecognitionStep,
) {
  const confirmationLabel = RECOGNITION_CONFIRMATION_LABELS[step]
  const participants: { page: Page; playerID: string }[] = []

  for (const [index, page] of pages.entries()) {
    if (step === 'roleReveal') {
      await expect(page.locator('[data-room-scene="identityConfirmation"]')).toBeVisible()
      const revealIdentity = page.locator('[data-room-slot="phase-action"]')
        .getByRole('button', { exact: true, name: '揭示身份' })
      if (
        await revealIdentity.count() === 1 &&
        await revealIdentity.isVisible() &&
        await revealIdentity.isEnabled()
      ) {
        await revealIdentity.click()
      }
      const confirmation = page.getByRole('button', { exact: true, name: confirmationLabel })
      await expect(confirmation).toBeVisible()
      participants.push({ page, playerID: String(index) })
      continue
    }
    const reveal = page.getByRole('button', { exact: true, name: '查看线索' })
    if (await reveal.count() === 1) {
      await reveal.click()
      await expect(page.getByRole('button', {
        exact: true,
        name: confirmationLabel,
      })).toBeVisible()
    }
    const confirmation = page.getByRole('button', { exact: true, name: confirmationLabel })
    if (await confirmation.count() === 1 && await confirmation.isVisible()) {
      participants.push({ page, playerID: String(index) })
    }
  }

  for (const { page } of participants) {
    await page.getByRole('button', {
      exact: true,
      name: confirmationLabel,
    }).click()
    await expect(page.getByRole('button', {
      exact: true,
      name: confirmationLabel,
    })).toHaveCount(0)
  }

  return participants.map(({ playerID }) => playerID)
}

export async function createBrowserReplayHarness(options: {
  browser: Browser
  playerCount: number
  roleConfiguration?: BrowserRoleConfiguration
}): Promise<BrowserReplayHarness> {
  const contexts: BrowserContext[] = []
  let submittedTeamVotes = 0
  let submittedQuestCards = 0
  let requiredQuestCards = 0

  try {
    for (let index = 0; index < options.playerCount; index += 1) {
      contexts.push(await options.browser.newContext())
    }
    const pages = await Promise.all(contexts.map((context) => context.newPage()))
    const matchID = await createRoom(
      pages[0],
      options.playerCount,
      playerName('0'),
      options.roleConfiguration,
    )
    for (let index = 1; index < options.playerCount; index += 1) {
      await joinRoom(pages[index], matchID, String(index))
    }
    await expect(
      pages[0].getByRole('button', { name: '开始游戏' }),
    ).toBeEnabled()
    const continueSettlement = async (name: RegExp) => {
      await Promise.all(pages.map((currentPage) => currentPage.getByRole('button', {
        exact: true,
        name,
      }).click()))
    }

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
              pages[0].locator('[data-room-scene="identityConfirmation"]'),
            ).toBeVisible()
            await expect(pages[0].locator('[data-identity-confirmation-state="concealed"]')).toBeVisible()
            return
          case 'confirmIdentityRecognition':
            let confirmationButton = page.getByRole('button', {
              exact: true,
              name: /^(我已记住身份|我已辨认|我已了解)$/,
            })
            if (await confirmationButton.count() === 0) {
              const revealIdentity = page.locator('[data-room-slot="phase-action"]')
                .getByRole('button', { exact: true, name: '揭示身份' })
              if (
                await revealIdentity.count() === 1 &&
                await revealIdentity.isVisible() &&
                await revealIdentity.isEnabled()
              ) {
                await revealIdentity.click()
              } else {
                const revealClue = page.getByRole('button', { exact: true, name: '查看线索' })
                if (await revealIdentity.count() === 0) await revealClue.click()
              }
              confirmationButton = page.getByRole('button', {
                exact: true,
                name: /^(我已记住身份|我已辨认|我已了解)$/,
              })
              await expect(confirmationButton).toBeVisible()
            }
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
              exact: true,
              name: '确认队伍',
            }).click()
            requiredQuestCards = command.payload.team.length
            return
          case 'castTeamVote':
            await page.getByRole('button', {
              exact: true,
              name: command.payload.vote === 'approve' ? '同意任务队伍' : '反对任务队伍',
            }).click()
            await page.getByRole('button', { exact: true, name: '确认投票' }).click()
            submittedTeamVotes += 1
            if (submittedTeamVotes === options.playerCount) {
              await continueSettlement(/^(继续|查看对局结果)$/)
              submittedTeamVotes = 0
            }
            return
          case 'playQuestCard':
            if (command.payload.card === 'success') {
              const goodSubmission = page.getByRole('button', {
                exact: true,
                name: '提交成功牌',
              })
              if (await goodSubmission.count() === 1) {
                await goodSubmission.click()
              } else {
                await page.getByRole('button', {
                  exact: true,
                  name: '选择成功任务牌',
                }).click()
                await page.getByRole('button', { exact: true, name: '确认任务牌' }).click()
              }
            } else {
              await page.getByRole('button', {
                exact: true,
                name: '选择失败任务牌',
              }).click()
              await page.getByRole('button', { exact: true, name: '确认任务牌' }).click()
            }
            submittedQuestCards += 1
            if (submittedQuestCards === requiredQuestCards) {
              await continueSettlement(/^(继续|进入刺杀阶段|查看对局结果)$/)
              submittedQuestCards = 0
            }
            return
          case 'assassinate':
            await page.getByRole('button', {
              name: `选择 ${playerName(command.payload.targetID)} 作为刺杀目标`,
            }).click()
            await page.getByRole('button', { exact: true, name: '确认刺杀' }).click()
            await continueSettlement(/^查看对局结果$/)
        }
      },
      async snapshot() {
        const resultHeadings = await Promise.all(
          pages.map(async (page) => {
            const heading = page
              .getByText(/^(正义|邪恶)阵营获胜$/, { exact: true })
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
