import { getPlayerCountConfig } from './config'
import type { Loyalty, PlayerID, Role } from './types'

export function loyaltyForRole(role: Role): Loyalty {
  return role === 'assassin' || role === 'minion' ? 'evil' : 'good'
}

export function buildRoleDeck(playerCount: number): Role[] {
  const config = getPlayerCountConfig(playerCount)
  const roles: Role[] = ['merlin', 'assassin']

  roles.push(
    ...Array.from({ length: config.good - 1 }, () => 'loyal_servant' as const),
  )
  roles.push(
    ...Array.from({ length: config.evil - 1 }, () => 'minion' as const),
  )

  return roles
}

export function assignRoles(
  playerIDs: readonly PlayerID[],
  shuffledRoles: readonly Role[],
): Record<PlayerID, Role> {
  if (playerIDs.length !== shuffledRoles.length) {
    throw new Error('Role deck length must match player count')
  }

  if (new Set(playerIDs).size !== playerIDs.length) {
    throw new Error('Player IDs must be unique')
  }

  return Object.fromEntries(
    playerIDs.map((playerID, index) => [playerID, shuffledRoles[index]]),
  ) as Record<PlayerID, Role>
}
