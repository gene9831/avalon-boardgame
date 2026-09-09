import { describe, expect, it } from 'vitest'

import { resolvePreviewRoomShell } from './preview-room-shell'

describe('preview room shell', () => {
  it('keeps compact top chrome while using the normal phase content at 375×667', () => {
    expect(resolvePreviewRoomShell({ width: 375, height: 667 })).toEqual({
      topBarHeight: 48,
      topBarPadding: 8,
      stageMargin: 8,
      phaseHeaderHeight: 48,
      phaseMiddleHeight: 56,
      phaseActionHeight: 56,
    })
  })

  it('uses normal top chrome and fixed phase content at 390×844', () => {
    expect(resolvePreviewRoomShell({ width: 390, height: 844 })).toEqual({
      topBarHeight: 56,
      topBarPadding: 12,
      stageMargin: 12,
      phaseHeaderHeight: 48,
      phaseMiddleHeight: 56,
      phaseActionHeight: 56,
    })
  })
})
