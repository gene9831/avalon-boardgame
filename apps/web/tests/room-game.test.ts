import { describe, expect, it } from 'vitest'

import {
  canSubmitTeam,
  getQuestTeamSize,
  toggleTeamMember,
} from '../src/room-game'

describe('room game interaction helpers', () => {
  it('uses the configured team size for the current quest', () => {
    expect(getQuestTeamSize(5, 0)).toBe(2)
    expect(getQuestTeamSize(7, 3)).toBe(4)
  })

  it('toggles a player without exceeding the required team size', () => {
    expect(toggleTeamMember([], '0', 2)).toEqual(['0'])
    expect(toggleTeamMember(['0'], '0', 2)).toEqual([])
    expect(toggleTeamMember(['0', '1'], '2', 2)).toEqual(['0', '1'])
  })

  it('allows submission only for the active leader with a complete team', () => {
    expect(
      canSubmitTeam({
        activeStage: 'leader',
        leaderID: '1',
        playerID: '1',
        requiredTeamSize: 2,
        selectedTeam: ['1', '2'],
      }),
    ).toBe(true)
    expect(
      canSubmitTeam({
        activeStage: 'leader',
        leaderID: '1',
        playerID: '0',
        requiredTeamSize: 2,
        selectedTeam: ['1', '2'],
      }),
    ).toBe(false)
    expect(
      canSubmitTeam({
        activeStage: 'leader',
        leaderID: '1',
        playerID: '1',
        requiredTeamSize: 2,
        selectedTeam: ['1'],
      }),
    ).toBe(false)
  })
})
