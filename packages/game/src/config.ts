import type { PlayerCountConfig } from './types'

const PLAYER_COUNT_CONFIGS: Record<number, PlayerCountConfig> = {
  5: {
    good: 3,
    evil: 2,
    questTeamSizes: [2, 3, 2, 3, 3],
    questFailThresholds: [1, 1, 1, 1, 1],
  },
  6: {
    good: 4,
    evil: 2,
    questTeamSizes: [2, 3, 4, 3, 4],
    questFailThresholds: [1, 1, 1, 1, 1],
  },
  7: {
    good: 4,
    evil: 3,
    questTeamSizes: [2, 3, 3, 4, 4],
    questFailThresholds: [1, 1, 1, 2, 1],
  },
  8: {
    good: 5,
    evil: 3,
    questTeamSizes: [3, 4, 4, 5, 5],
    questFailThresholds: [1, 1, 1, 2, 1],
  },
  9: {
    good: 6,
    evil: 3,
    questTeamSizes: [3, 4, 4, 5, 5],
    questFailThresholds: [1, 1, 1, 2, 1],
  },
  10: {
    good: 6,
    evil: 4,
    questTeamSizes: [3, 4, 4, 5, 5],
    questFailThresholds: [1, 1, 1, 2, 1],
  },
}

export function getPlayerCountConfig(playerCount: number): PlayerCountConfig {
  const config = PLAYER_COUNT_CONFIGS[playerCount]

  if (config === undefined) {
    throw new Error(`Unsupported Avalon player count: ${playerCount}`)
  }

  return config
}
