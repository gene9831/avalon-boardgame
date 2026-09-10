import { describe, expect, it } from 'vitest'

import {
  resolveRoomShellMetrics,
  solveRoundTableStageLayout,
} from '@avalon/ui-layout'
import {
  applyPreviewRoomShell,
} from './preview-room-shell'

const confirmedViewports = [
  [{ width: 375, height: 667 }, 'vertical', 359, 435],
  [{ width: 667, height: 375 }, 'compact-landscape', 403, 359],
  [{ width: 390, height: 844 }, 'vertical', 366, 596],
  [{ width: 844, height: 390 }, 'compact-landscape', 536, 374],
  [{ width: 430, height: 932 }, 'vertical', 406, 684],
  [{ width: 932, height: 430 }, 'compact-landscape', 599, 414],
  [{ width: 768, height: 1024 }, 'vertical', 744, 776],
  [{ width: 1024, height: 768 }, 'normal-landscape', 704, 680],
] as const

function expectContainedInStage(
  rect: Readonly<{ x: number, y: number, width: number, height: number }>,
  stageWidth: number,
  stageHeight: number,
): void {
  expect(rect.x).toBeGreaterThanOrEqual(0)
  expect(rect.y).toBeGreaterThanOrEqual(0)
  expect(rect.x + rect.width).toBeLessThanOrEqual(stageWidth)
  expect(rect.y + rect.height).toBeLessThanOrEqual(stageHeight)
}

describe('preview room shell', () => {
  it('uses vertical mode for tall portrait-like layouts', () => {
    expect(resolveRoomShellMetrics({ width: 375, height: 667 })).toMatchObject({
      mode: 'vertical',
      topBarHeight: 48,
      topBarPadding: 8,
      stageMargin: 8,
      taskRailWidth: 0,
      sidebarWidth: 0,
    })
  })

  it('keeps vertical layout dual mode at high portrait sizes', () => {
    expect(resolveRoomShellMetrics({ width: 390, height: 844 })).toMatchObject({
      mode: 'vertical',
      topBarHeight: 56,
      topBarPadding: 12,
      stageMargin: 12,
      taskRailWidth: 0,
      sidebarWidth: 0,
    })
  })

  it('uses compact-landscape for short landscape layouts', () => {
    expect(resolveRoomShellMetrics({ width: 667, height: 375 })).toMatchObject({
      mode: 'compact-landscape',
      topBarHeight: 0,
      stageMargin: 8,
      taskRailWidth: 56,
      sidebarWidth: 192,
    })

    expect(resolveRoomShellMetrics({ width: 900, height: 514 })).toMatchObject({
      mode: 'compact-landscape',
    })

    expect(resolveRoomShellMetrics({ width: 844, height: 390 })).toMatchObject({
      mode: 'compact-landscape',
      sidebarWidth: 236,
    })

    expect(resolveRoomShellMetrics({ width: 932, height: 430 })).toMatchObject({
      mode: 'compact-landscape',
      sidebarWidth: 261,
    })
  })

  it('uses normal-landscape for wider landscape layouts', () => {
    expect(resolveRoomShellMetrics({ width: 1024, height: 768 })).toMatchObject({
      mode: 'normal-landscape',
      topBarHeight: 56,
      topBarPadding: 12,
      stageMargin: 16,
      taskRailWidth: 0,
      sidebarWidth: 288,
    })

    expect(resolveRoomShellMetrics({ width: 900, height: 515 })).toMatchObject({
      mode: 'normal-landscape',
      topBarHeight: 48,
      topBarPadding: 8,
      stageMargin: 12,
      sidebarWidth: 288,
    })
  })

  it('keeps the normal-landscape height boundary adjacent and explicit', () => {
    expect(resolveRoomShellMetrics({ width: 1000, height: 679 })).toMatchObject({
      mode: 'normal-landscape',
      topBarHeight: 48,
      topBarPadding: 8,
      stageMargin: 12,
    })

    expect(resolveRoomShellMetrics({ width: 1000, height: 680 })).toMatchObject({
      mode: 'normal-landscape',
      topBarHeight: 56,
      topBarPadding: 12,
      stageMargin: 16,
    })
  })

  it('uses vertical mode for square layouts', () => {
    expect(resolveRoomShellMetrics({ width: 667, height: 667 })).toMatchObject({
      mode: 'vertical',
    })
  })

  it('applies shell layout values to canvas as css vars and data attribute', () => {
    const shell = resolveRoomShellMetrics({ width: 1024, height: 768 })
    const properties: Record<string, string> = {}
    const canvas = {
      style: {
        setProperty: (name: string, value: string): void => {
          properties[name] = value
        },
      },
      dataset: {},
    } as unknown as HTMLElement

    applyPreviewRoomShell(canvas, shell)

    expect(canvas.dataset.roomLayoutMode).toBe('normal-landscape')
    expect(properties['--room-topbar-height']).toBe('56px')
    expect(properties['--room-topbar-padding']).toBe('12px')
    expect(properties['--round-table-stage-margin']).toBe('16px')
    expect(properties['--task-rail-width']).toBe('0px')
    expect(properties['--phase-sidebar-width']).toBe('288px')
  })

  for (const [viewport, expectedMode, stageWidth, stageHeight] of confirmedViewports) {
    it(`resolves ${viewport.width} by ${viewport.height} as ${expectedMode}`, () => {
      expect(resolveRoomShellMetrics(viewport).mode).toBe(expectedMode)
    })

    for (let playerCount = 5; playerCount <= 10; playerCount += 1) {
      it(`contains ${playerCount} players within the ${viewport.width} by ${viewport.height} business stage`, () => {
        const result = solveRoundTableStageLayout({
          maxStageWidth: stageWidth,
          maxStageHeight: stageHeight,
          playerCount,
          gap: 8,
          maxAvatarSize: 56,
          avatarSizeStep: 8,
        })

        expect(result.status).toBe('ready')
        if (result.status !== 'ready') {
          throw new Error(`Expected ${playerCount} players to fit in the confirmed stage`)
        }

        expect(result.playerSeats).toHaveLength(playerCount)
        expect(result.playerSeats.map(({ relativeSeatIndex }) => relativeSeatIndex))
          .toEqual(Array.from({ length: playerCount }, (_, index) => index))
        expectContainedInStage(result.tabletop, stageWidth, stageHeight)
        expectContainedInStage(result.centerPanel, stageWidth, stageHeight)
        for (const seat of result.playerSeats) {
          expectContainedInStage(seat.playerSeatBounds, stageWidth, stageHeight)
          expectContainedInStage(seat.avatarRect, stageWidth, stageHeight)
          expectContainedInStage(seat.nameRect, stageWidth, stageHeight)
        }
      })
    }
  }
})
