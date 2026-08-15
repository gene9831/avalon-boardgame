import { describe, expect, it } from 'vitest'

import { getPlayerCountConfig } from '../src/config'
import {
  assignRoles,
  buildRoleDeck,
  loyaltyForRole,
} from '../src/roles'

describe('Avalon role configuration', () => {
  it.each([5, 6, 7, 8, 9, 10])(
    'builds the configured role counts for %i players',
    (playerCount) => {
      const config = getPlayerCountConfig(playerCount)
      const roles = buildRoleDeck(playerCount)

      expect(roles).toHaveLength(playerCount)
      expect(
        roles.filter((role) => loyaltyForRole(role) === 'good'),
      ).toHaveLength(config.good)
      expect(
        roles.filter((role) => loyaltyForRole(role) === 'evil'),
      ).toHaveLength(config.evil)
      expect(roles.filter((role) => role === 'merlin')).toHaveLength(1)
      expect(roles.filter((role) => role === 'assassin')).toHaveLength(1)
      expect(roles.filter((role) => role === 'loyal_servant')).toHaveLength(
        config.good - 1,
      )
      expect(roles.filter((role) => role === 'minion')).toHaveLength(
        config.evil - 1,
      )
    },
  )

  it.each([4, 11])('rejects unsupported player count %i', (playerCount) => {
    expect(() => getPlayerCountConfig(playerCount)).toThrow(
      `Unsupported Avalon player count: ${playerCount}`,
    )
    expect(() => buildRoleDeck(playerCount)).toThrow(
      `Unsupported Avalon player count: ${playerCount}`,
    )
  })

  it('assigns one supplied role to each supplied player ID', () => {
    expect(assignRoles(['0', '1'], ['merlin', 'assassin'])).toEqual({
      '0': 'merlin',
      '1': 'assassin',
    })
  })

  it('rejects a role deck whose length does not match the seats', () => {
    expect(() => assignRoles(['0'], ['merlin', 'assassin'])).toThrow(
      'Role deck length must match player count',
    )
  })
})
