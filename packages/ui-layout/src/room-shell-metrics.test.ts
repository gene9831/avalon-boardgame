import { describe, expect, it } from 'vitest'

import { resolveRoomShellMetrics } from './index'

describe('resolveRoomShellMetrics', () => {
  it('selects the compact vertical chrome for the minimum portrait canvas', () => {
    expect(resolveRoomShellMetrics({ width: 375, height: 667 })).toEqual({
      mode: 'vertical',
      topBarHeight: 48,
      topBarPadding: 8,
      stageMargin: 8,
      taskRailWidth: 0,
      sidebarWidth: 0,
      phaseHeaderHeight: 48,
      phaseMiddleHeight: 56,
      phaseActionHeight: 56,
    })
  })

  it('selects the compact horizontal shell below 515px high', () => {
    expect(resolveRoomShellMetrics({ width: 667, height: 375 })).toMatchObject({
      mode: 'compact-landscape',
      topBarHeight: 0,
      stageMargin: 8,
      taskRailWidth: 56,
      sidebarWidth: 192,
    })
    expect(resolveRoomShellMetrics({ width: 900, height: 514 }).mode).toBe('compact-landscape')
  })

  it('selects the normal horizontal shell at 515px and rounds its sidebar', () => {
    expect(resolveRoomShellMetrics({ width: 900, height: 515 })).toMatchObject({
      mode: 'normal-landscape',
      topBarHeight: 48,
      stageMargin: 12,
      sidebarWidth: 288,
    })
    expect(resolveRoomShellMetrics({ width: 1024, height: 768 }).sidebarWidth).toBe(288)
  })

  it('expands normal horizontal chrome at 680px high', () => {
    expect(resolveRoomShellMetrics({ width: 1_000, height: 679 })).toMatchObject({
      topBarHeight: 48,
      topBarPadding: 8,
      stageMargin: 12,
    })
    expect(resolveRoomShellMetrics({ width: 1_000, height: 680 })).toMatchObject({
      topBarHeight: 56,
      topBarPadding: 12,
      stageMargin: 16,
    })
  })

  it('treats a square business canvas as vertical', () => {
    expect(resolveRoomShellMetrics({ width: 667, height: 667 }).mode).toBe('vertical')
  })
})
