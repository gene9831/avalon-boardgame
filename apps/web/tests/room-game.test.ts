import { describe, expect, it, vi } from 'vitest'

import {
  canSubmitTeam,
  getIdentityRecognitionWakeDelay,
  getQuestTeamSize,
  toggleTeamMember,
} from '../src/room-game'

describe('room game interaction helpers', () => {
  it('uses the authoritative recognition deadline for wake-up requests', () => {
    expect(getIdentityRecognitionWakeDelay({
      deadlineAt: 11_000,
      deadlineRefreshRequired: false,
      serverNow: 4_000,
      playerID: '0',
    })).toBe(7_100)
    expect(getIdentityRecognitionWakeDelay({
      deadlineAt: 11_000,
      deadlineRefreshRequired: false,
      serverNow: 12_000,
      playerID: '0',
    })).toBe(100)
    expect(getIdentityRecognitionWakeDelay({
      deadlineAt: 11_000,
      deadlineRefreshRequired: true,
      serverNow: 4_000,
      playerID: '3',
    })).toBe(400)
    expect(getIdentityRecognitionWakeDelay({
      deadlineAt: 11_000,
      deadlineRefreshRequired: false,
      serverNow: 4_000,
      playerID: '3',
    })).toBe(7_400)
  })

  it('does not use the browser wall clock to schedule recognition wake-up', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2099-01-01T00:00:00Z'))
      expect(getIdentityRecognitionWakeDelay({
        deadlineAt: 11_000,
        deadlineRefreshRequired: false,
        serverNow: 4_000,
        playerID: '0',
      })).toBe(7_100)
    } finally {
      vi.useRealTimers()
    }
  })

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
