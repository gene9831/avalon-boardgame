import { describe, expect, it } from 'vitest'

import {
  AVALON_RNG_ALGORITHM_VERSION,
  createAvalonReplayArtifact,
  createAvalonRuleDriver,
  deriveAvalonSeeds,
  generateSeededDecisions,
  getIdentityRecognitionCommands,
  playGeneratedGame,
  replayAvalonArtifact,
  replayTranscript,
  type AvalonCommand,
  type ReplayDriver,
} from '../src/index'

describe('Avalon replay support', () => {
  it('constructs generated games with every authoritative lobby seat occupied', () => {
    const driver = createAvalonRuleDriver({
      masterSeed: 'full-lobby-replay',
      playerCount: 5,
    })

    expect(driver.snapshot().G.lobby).toEqual({
      authorityVersion: 1,
      ownerPlayerID: '0',
      occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    })
  })

  it('derives stable independent game and action seeds from one master seed', () => {
    expect(AVALON_RNG_ALGORITHM_VERSION).toBe(
      'boardgame.io-alea@0.50.2+avalon-rng-v1',
    )
    expect(deriveAvalonSeeds('master-seed')).toEqual({
      gameSeed:
        'bec2b81d87f245dc4560d8ac6e9aa3dfe61f4d84216b55580b1bf49658299165',
      actionSeed:
        'da3b9f1c2571fe0a161804588f6cd52d7dd1276667482fb0ace667d9e11eed6a',
    })
    expect(generateSeededDecisions('master-seed', 5)).toEqual([
      2463184368,
      964859687,
      128847892,
      1882368642,
      2302541395,
    ])
  })

  it('dispatches a transcript in order and returns the final snapshot', async () => {
    const received: AvalonCommand[] = []
    const transcript: AvalonCommand[] = [
      { actor: '0', command: 'startGame' },
      {
        actor: '3',
        command: 'proposeTeam',
        payload: { team: ['1', '4'] },
      },
      {
        actor: '0',
        command: 'castTeamVote',
        payload: { vote: 'approve' },
      },
    ]
    const driver: ReplayDriver<{ dispatched: number }> = {
      dispatch(command) {
        received.push(command)
      },
      snapshot() {
        return { dispatched: received.length }
      },
    }

    const snapshot = await replayTranscript(driver, transcript)

    expect(received).toEqual(transcript)
    expect(snapshot).toEqual({ dispatched: 3 })
  })

  it('reports safe command progress before each transcript dispatch', async () => {
    const events: string[] = []
    const progress: unknown[] = []
    const transcript: AvalonCommand[] = [
      { actor: '0', command: 'startGame' },
      {
        actor: '3',
        command: 'proposeTeam',
        payload: { team: ['1', '4'] },
      },
      {
        actor: '0',
        command: 'castTeamVote',
        payload: { vote: 'approve' },
      },
    ]
    const driver: ReplayDriver<void> = {
      dispatch(command) {
        events.push(`dispatch:${command.command}`)
      },
      snapshot() {},
    }

    await replayTranscript(driver, transcript, {
      onCommandStart(value) {
        events.push(`progress:${value.currentCommand}`)
        progress.push(value)
      },
    })

    expect(events).toEqual([
      'progress:startGame',
      'dispatch:startGame',
      'progress:proposeTeam',
      'dispatch:proposeTeam',
      'progress:castTeamVote',
      'dispatch:castTeamVote',
    ])
    expect(progress).toEqual([
      {
        completedCommands: 0,
        currentCommand: 'startGame',
        totalCommands: 3,
      },
      {
        completedCommands: 1,
        currentCommand: 'proposeTeam',
        totalCommands: 3,
      },
      {
        completedCommands: 2,
        currentCommand: 'castTeamVote',
        totalCommands: 3,
      },
    ])
  })

  it('replays the same authoritative game state from one seed and transcript', async () => {
    const transcript: AvalonCommand[] = [
      { actor: '0', command: 'startGame' },
    ]
    const first = createAvalonRuleDriver({
      masterSeed: 'complete-game-replay',
      playerCount: 10,
    })
    const second = createAvalonRuleDriver({
      masterSeed: 'complete-game-replay',
      playerCount: 10,
    })

    await replayTranscript(first, transcript)
    while (first.snapshot().ctx.phase === 'identityRecognition') {
      const commands = getIdentityRecognitionCommands(first.snapshot().G)
      transcript.push(...commands)
      await replayTranscript(first, commands)
    }
    const firstSnapshot = first.snapshot()
    const secondSnapshot = await replayTranscript(second, transcript)

    expect(firstSnapshot).toEqual(secondSnapshot)
    expect(firstSnapshot.ctx.phase).toBe('teamProposal')
    expect(Object.keys(firstSnapshot.G.secret.roleByPlayer)).toHaveLength(10)
  })

  it('uses the action seed to generate a replayable complete game', () => {
    const first = playGeneratedGame({
      masterSeed: 'seeded-complete-game',
      playerCount: 7,
    })
    const second = playGeneratedGame({
      masterSeed: 'seeded-complete-game',
      playerCount: 7,
    })

    expect(first.transcript).toEqual(second.transcript)
    expect(first.finalState).toEqual(second.finalState)
    expect(first.finalState.G.status).toBe('finished')
  })

  it('round-trips a JSON replay artifact without storing authoritative secrets', async () => {
    const generated = playGeneratedGame({
      masterSeed: 'artifact-seed',
      playerCount: 5,
    })
    const artifact = createAvalonReplayArtifact({
      codeVersion: 'test-version',
      masterSeed: 'artifact-seed',
      playerCount: 5,
      transcript: generated.transcript,
    })
    const serialized = JSON.stringify(artifact)

    expect(serialized).not.toContain('roleByPlayer')
    expect(serialized).not.toContain('credentials')
    expect(serialized).not.toContain('adminToken')
    expect(await replayAvalonArtifact(JSON.parse(serialized))).toEqual(
      generated.finalState,
    )
  })
})
