import { describe, expect, it } from 'vitest'

import {
  createSocketReplayHarness,
  type SocketReplayHarness,
} from './support/socket-replay'
import {
  getIdentityRecognitionCommands,
  replayTranscript,
  type AvalonCommand,
} from '@avalon/test-support'
import { getPlayerCountConfig, type AvalonG } from '@avalon/game'

async function playFiveRejections(harness: SocketReplayHarness) {
  const transcript: AvalonCommand[] = []
  const dispatch = async (command: AvalonCommand) => {
    transcript.push(command)
    await harness.dispatch(command)
  }

  for (let step = 0; step < 100; step += 1) {
    const snapshot = await harness.snapshot()
    const G = snapshot.authoritative.G as AvalonG
    if (G.status === 'finished') return { snapshot, transcript }

    if (snapshot.authoritative.ctx.phase === 'lobby') {
      await dispatch({ actor: '0', command: 'startGame' })
      continue
    }
    if (snapshot.authoritative.ctx.phase === 'identityRecognition') {
      for (const command of getIdentityRecognitionCommands(G)) {
        await dispatch(command)
      }
      continue
    }
    if (snapshot.authoritative.ctx.phase === 'teamProposal') {
      if (G.leaderID === null) throw new Error('Expected a proposal leader')
      const teamSize = getPlayerCountConfig(5).questTeamSizes[G.questIndex]
      await dispatch({
        actor: G.leaderID,
        command: 'proposeTeam',
        payload: {
          team: snapshot.authoritative.ctx.playOrder.slice(0, teamSize),
        },
      })
      continue
    }
    if (snapshot.authoritative.ctx.phase === 'teamVote') {
      for (const actor of snapshot.authoritative.ctx.playOrder) {
        await dispatch({ actor, command: 'castTeamVote', payload: { vote: 'reject' } })
      }
      continue
    }
    throw new Error(`Unexpected phase: ${snapshot.authoritative.ctx.phase}`)
  }

  throw new Error('Socket replay did not finish within 100 commands')
}

describe('Socket.IO transcript replay', () => {
  it('replays one complete game without leaking secrets or the RNG seed', async () => {
    const masterSeed = 'socket-five-rejections'
    const harness = await createSocketReplayHarness({
      masterSeed,
      playerCount: 5,
    })
    let replayHarness: SocketReplayHarness | undefined

    try {
      const generated = await playFiveRejections(harness)
      replayHarness = await createSocketReplayHarness({
        masterSeed,
        playerCount: 5,
      })
      const snapshot = await replayTranscript(replayHarness, generated.transcript)

      expect(snapshot.authoritative.G).toEqual(generated.snapshot.authoritative.G)
      expect(snapshot.authoritative.ctx.gameover).toEqual({
        winner: 'evil',
        reason: 'five_rejections',
      })
      for (const playerState of snapshot.playerStates) {
        expect(playerState.G).not.toHaveProperty('secret')
        expect(playerState.plugins.random).not.toHaveProperty('data.seed')
      }
    } finally {
      await replayHarness?.close()
      await harness.close()
    }
  }, 15000)
})
