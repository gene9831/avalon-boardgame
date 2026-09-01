import { getPlayerCountConfig } from './config'
import {
  type AvalonRoleConfiguration,
  type Loyalty,
  type PlayerID,
  type Role,
  LEGACY_ROLE_CONFIGURATION,
} from './types'

export function loyaltyForRole(role: Role): Loyalty {
  return role === 'assassin' || role === 'morgana' || role === 'minion' ? 'evil' : 'good'
}

export function buildRoleDeck(
  playerCount: number,
  roleConfiguration: AvalonRoleConfiguration = LEGACY_ROLE_CONFIGURATION,
): Role[] {
  const config = getPlayerCountConfig(playerCount)
  const goodRoles: Role[] = ['merlin']
  const evilRoles: Role[] = ['assassin']

  if (roleConfiguration.percivalMorgana) {
    goodRoles.push('percival')
    evilRoles.push('morgana')
  }

  goodRoles.push(
    ...Array.from({ length: config.good - goodRoles.length }, () => 'loyal_servant' as const),
  )
  evilRoles.push(
    ...Array.from({ length: config.evil - evilRoles.length }, () => 'minion' as const),
  )

  return [...goodRoles, ...evilRoles]
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
