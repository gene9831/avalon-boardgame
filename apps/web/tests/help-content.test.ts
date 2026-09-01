import { describe, expect, it } from 'vitest'

import {
  getHelpPlayerRows,
  getHelpRoleOrder,
  HELP_KEY_RULES,
} from '../src/help-content'
import { ROLE_GUIDANCE } from '../src/role-guidance'

describe('help content', () => {
  it('places Percival and Morgana first only for contextual role help', () => {
    expect(getHelpRoleOrder(true).slice(0, 2)).toEqual(['percival', 'morgana'])
    expect(getHelpRoleOrder(false)).toEqual([
      'merlin',
      'percival',
      'loyal_servant',
      'assassin',
      'morgana',
      'minion',
    ])
  })

  it('contains the important production rules and every player count', () => {
    expect(HELP_KEY_RULES.join(' ')).toContain('连续 5 次')
    expect(HELP_KEY_RULES.join(' ')).toContain('第 4 个任务')
    expect(getHelpPlayerRows().map(({ playerCount }) => playerCount)).toEqual([
      5, 6, 7, 8, 9, 10,
    ])
  })

  it('documents ability, objective, and a beginner tip for every supported role', () => {
    expect(Object.keys(ROLE_GUIDANCE)).toHaveLength(6)
    for (const guidance of Object.values(ROLE_GUIDANCE)) {
      expect(guidance.ability.length).toBeGreaterThan(0)
      expect(guidance.objective.length).toBeGreaterThan(0)
      expect(guidance.beginnerTip.length).toBeGreaterThan(0)
    }
  })
})
