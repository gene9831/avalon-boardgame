import { createHash } from 'node:crypto'

export const AVALON_SEED_DERIVATION_VERSION = 'avalon-rng-v1'
export const AVALON_RNG_ALGORITHM_VERSION =
  'boardgame.io-alea@0.50.2+avalon-rng-v1'
export const AVALON_ACTION_RNG_ALGORITHM_VERSION = 'xorshift32-v1'

function deriveSeed(masterSeed: string, stream: 'game' | 'actions') {
  return createHash('sha256')
    .update(`${AVALON_SEED_DERIVATION_VERSION}\0${stream}\0${masterSeed}`)
    .digest('hex')
}

export function deriveAvalonSeeds(masterSeed: string) {
  return {
    gameSeed: deriveSeed(masterSeed, 'game'),
    actionSeed: deriveSeed(masterSeed, 'actions'),
  }
}

export function generateSeededDecisions(masterSeed: string, count: number) {
  let state = Number.parseInt(
    deriveAvalonSeeds(masterSeed).actionSeed.slice(0, 8),
    16,
  ) >>> 0
  const decisions: number[] = []

  for (let index = 0; index < count; index += 1) {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state >>>= 0
    state ^= state << 5
    state >>>= 0
    decisions.push(state)
  }

  return decisions
}
