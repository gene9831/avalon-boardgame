import { expect, test } from '@playwright/test'

import {
  playGeneratedGame,
  replayTranscript,
  type ReplayCommandProgress,
} from '@avalon/test-support'

import { createBrowserReplayHarness } from '../support/browser-replay'

const allPlayerCounts = [5, 6, 7, 8, 9, 10]
const matrixTestTimeoutMs = 120_000
const progressReportIntervalMs = 10_000
const selectedPlayerCount = process.env.E2E_PLAYER_COUNT === undefined
  ? undefined
  : Number(process.env.E2E_PLAYER_COUNT)

if (
  selectedPlayerCount !== undefined &&
  !allPlayerCounts.includes(selectedPlayerCount)
) {
  throw new Error('E2E_PLAYER_COUNT must be an integer from 5 through 10')
}

const playerCounts = selectedPlayerCount === undefined
  ? allPlayerCounts
  : [selectedPlayerCount]

type ReplayPhase =
  | 'browserSetup'
  | 'gameStart'
  | 'identityRecognition'
  | 'teamProposal'
  | 'teamVote'
  | 'quest'
  | 'assassination'
  | 'complete'

function phaseForCommand(
  command: ReplayCommandProgress['currentCommand'],
): ReplayPhase {
  switch (command) {
    case 'startGame':
      return 'gameStart'
    case 'confirmIdentityRecognition':
      return 'identityRecognition'
    case 'proposeTeam':
      return 'teamProposal'
    case 'castTeamVote':
      return 'teamVote'
    case 'playQuestCard':
      return 'quest'
    case 'assassinate':
      return 'assassination'
  }
}

test.describe('nightly player-count matrix', () => {
  test.setTimeout(matrixTestTimeoutMs)

  test.skip(
    process.env.E2E_MATRIX !== '1',
    'The 5–10 browser matrix runs only in the nightly workflow',
  )

  for (const playerCount of playerCounts) {
    test(`${playerCount} isolated players complete a seeded game`, async ({
      browser,
    }) => {
      const startedAt = Date.now()
      const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
      const generated = playGeneratedGame({ masterSeed, playerCount })
      let completedCommands = 0
      let currentCommand = 'createBrowserReplayHarness'
      let currentPhase: ReplayPhase = 'browserSetup'
      let harness:
        | Awaited<ReturnType<typeof createBrowserReplayHarness>>
        | undefined

      const reportProgress = (status: 'running' | 'complete' | 'failed') => {
        console.log(
          [
            'nightly-matrix',
            `status=${status}`,
            `players=${playerCount}`,
            `commands=${completedCommands}/${generated.transcript.length}`,
            `phase=${currentPhase}`,
            `command=${currentCommand}`,
            `elapsedMs=${Date.now() - startedAt}`,
          ].join(' '),
        )
      }
      const progressTimer = setInterval(
        () => reportProgress('running'),
        progressReportIntervalMs,
      )

      reportProgress('running')

      try {
        harness = await createBrowserReplayHarness({ browser, playerCount })
        const snapshot = await replayTranscript(harness, generated.transcript, {
          onCommandStart(progress) {
            completedCommands = progress.completedCommands
            currentCommand = progress.currentCommand
            currentPhase = phaseForCommand(progress.currentCommand)
          },
        })
        completedCommands = generated.transcript.length
        currentCommand = 'complete'
        currentPhase = 'complete'

        const expectedHeading = generated.finalState.G.result?.winner === 'good'
          ? '正义阵营获胜'
          : '邪恶阵营获胜'

        expect(snapshot.resultHeadings).toEqual(
          Array.from({ length: playerCount }, () => expectedHeading),
        )
        reportProgress('complete')
      } catch (error) {
        reportProgress('failed')
        throw error
      } finally {
        clearInterval(progressTimer)
        await harness?.close()
      }
    })
  }
})
