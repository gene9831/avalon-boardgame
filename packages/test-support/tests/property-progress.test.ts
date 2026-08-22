import { describe, expect, it, vi } from 'vitest'

import { createPropertyProgress } from './property-progress'

describe('property progress', () => {
  it('writes directly to stdout so CI can stream checkpoints', () => {
    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      createPropertyProgress({
        label: '5 players',
        now: () => 1_000,
        totalRuns: 10,
      })

      expect(stdoutWrite).toHaveBeenCalledWith(
        '[property] 5 players: 0/10 (0%) elapsed=0s\n',
      )
    } finally {
      stdoutWrite.mockRestore()
      consoleLog.mockRestore()
    }
  })

  it('reports start, ten-percent checkpoints, and completion with elapsed time', () => {
    const messages: string[] = []
    let now = 1_000
    const progress = createPropertyProgress({
      label: '7 players',
      now: () => now,
      totalRuns: 20,
      write: (message) => messages.push(message),
    })

    for (let completed = 1; completed <= 20; completed += 1) {
      now += 100
      progress.advance()
    }
    progress.complete()

    expect(messages).toEqual([
      '[property] 7 players: 0/20 (0%) elapsed=0s',
      '[property] 7 players: 2/20 (10%) elapsed=0.2s',
      '[property] 7 players: 4/20 (20%) elapsed=0.4s',
      '[property] 7 players: 6/20 (30%) elapsed=0.6s',
      '[property] 7 players: 8/20 (40%) elapsed=0.8s',
      '[property] 7 players: 10/20 (50%) elapsed=1s',
      '[property] 7 players: 12/20 (60%) elapsed=1.2s',
      '[property] 7 players: 14/20 (70%) elapsed=1.4s',
      '[property] 7 players: 16/20 (80%) elapsed=1.6s',
      '[property] 7 players: 18/20 (90%) elapsed=1.8s',
      '[property] 7 players: 20/20 (100%) elapsed=2s complete',
    ])
  })
})
