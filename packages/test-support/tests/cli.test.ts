import { describe, expect, it } from 'vitest'

import { parseReplayCliArgs } from '../src/cli'

describe('replay CLI arguments', () => {
  it('accepts one seed and player count for a generated replay', () => {
    expect(
      parseReplayCliArgs(['--seed', 'nightly-42', '--players', '7']),
    ).toEqual({
      mode: 'generate',
      masterSeed: 'nightly-42',
      playerCount: 7,
    })
  })

  it('accepts a saved JSON artifact path', () => {
    expect(parseReplayCliArgs(['--file', 'failure.json'])).toEqual({
      mode: 'artifact',
      path: 'failure.json',
    })
  })

  it('rejects unsupported player counts', () => {
    expect(() =>
      parseReplayCliArgs(['--seed', 'nightly-42', '--players', '4']),
    ).toThrow('Player count must be an integer from 5 to 10')
  })
})
