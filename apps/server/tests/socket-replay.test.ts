import { describe, expect, it } from 'vitest'

import {
  createSocketReplayHarness,
} from './support/socket-replay'
import {
  playGeneratedGame,
  replayTranscript,
} from '@avalon/test-support'

describe('Socket.IO transcript replay', () => {
  it('replays one complete game without leaking secrets or the RNG seed', async () => {
    const masterSeed = 'socket-five-rejections'
    const generated = playGeneratedGame({
      decisions: [0],
      masterSeed,
      playerCount: 5,
    })
    const harness = await createSocketReplayHarness({
      masterSeed,
      playerCount: 5,
    })

    try {
      const snapshot = await replayTranscript(harness, generated.transcript)

      expect(snapshot.authoritative.G).toEqual(generated.finalState.G)
      expect(snapshot.authoritative.ctx.gameover).toEqual({
        winner: 'evil',
        reason: 'five_rejections',
      })
      for (const playerState of snapshot.playerStates) {
        expect(playerState.G).not.toHaveProperty('secret')
        expect(playerState.plugins.random).not.toHaveProperty('data.seed')
      }
    } finally {
      await harness.close()
    }
  }, 15000)
})
