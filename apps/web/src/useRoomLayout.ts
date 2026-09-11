import { useEffect, useMemo, useState, type RefCallback } from 'react'
import {
  resolveRoomShellMetrics,
  solveRoundTableStageLayout,
  type RoomCanvasSize,
  type RoomShellMetrics,
  type RoundTableStageLayoutResult,
} from '@avalon/ui-layout'
import type {
  DetailedRoundTableStageLayoutResult,
  RoundTableStageDiagnostics,
} from '@avalon/ui-layout/diagnostics'

import { contentSizesEqual, normalizeContentSize } from './element-content-size'
import { useObservedContentSize } from './useObservedContentSize'

export type RoomLayoutDiagnosticsMode = 'off' | 'metrics' | 'geometry'

export type RoomLayoutSnapshot = Readonly<{
  viewportSize: RoomCanvasSize | null
  canvasSize: RoomCanvasSize | null
  stageSize: RoomCanvasSize | null
  shellMetrics: RoomShellMetrics | null
  stageLayout: RoundTableStageLayoutResult | null
  diagnostics: RoundTableStageDiagnostics | null
}>

type ResolveRoomLayoutSnapshotInput = Readonly<{
  viewportSize: RoomCanvasSize | null
  canvasSize: RoomCanvasSize | null
  stageSize: RoomCanvasSize | null
  playerCount: number | null
  detailedResult?: DetailedRoundTableStageLayoutResult | null
}>

function supportsPlayerCount(playerCount: number | null): playerCount is number {
  return playerCount !== null &&
    Number.isInteger(playerCount) &&
    playerCount >= 5 &&
    playerCount <= 10
}

export function resolveRoomLayoutSnapshot(
  input: ResolveRoomLayoutSnapshotInput,
): RoomLayoutSnapshot {
  const shellMetrics = input.canvasSize === null
    ? null
    : resolveRoomShellMetrics(input.canvasSize)
  const stageLayout = input.detailedResult !== undefined
    ? input.detailedResult
    : input.stageSize === null || !supportsPlayerCount(input.playerCount)
      ? null
      : solveRoundTableStageLayout({
          maxStageWidth: input.stageSize.width,
          maxStageHeight: input.stageSize.height,
          playerCount: input.playerCount,
        })

  return {
    viewportSize: input.viewportSize,
    canvasSize: input.canvasSize,
    stageSize: input.stageSize,
    shellMetrics,
    stageLayout,
    diagnostics:
      input.detailedResult?.status === 'ready'
        ? input.detailedResult.diagnostics
        : null,
  }
}

function readViewportSize(): RoomCanvasSize | null {
  if (typeof window === 'undefined') return null
  const viewport = window.visualViewport
  return normalizeContentSize(
    viewport?.width ?? window.innerWidth,
    viewport?.height ?? window.innerHeight,
  )
}

function useViewportSize(): RoomCanvasSize | null {
  const [size, setSize] = useState<RoomCanvasSize | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      const nextSize = readViewportSize()
      setSize((previous) => contentSizesEqual(previous, nextSize) ? previous : nextSize)
    }

    update()
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
    }
  }, [])

  return size
}

export function useRoomLayout(
  playerCount: number | null,
  diagnosticsMode: RoomLayoutDiagnosticsMode,
): Readonly<{
  canvasRef: RefCallback<HTMLElement>
  stageRef: RefCallback<HTMLDivElement>
  snapshot: RoomLayoutSnapshot
}> {
  const viewportSize = useViewportSize()
  const canvas = useObservedContentSize<HTMLElement>()
  const stage = useObservedContentSize<HTMLDivElement>()
  const diagnosticsEnabled = import.meta.env.DEV && diagnosticsMode !== 'off'
  const [detailedResult, setDetailedResult] =
    useState<DetailedRoundTableStageLayoutResult | null>(null)

  useEffect(() => {
    let active = true
    setDetailedResult(null)
    if (
      !diagnosticsEnabled ||
      stage.size === null ||
      !supportsPlayerCount(playerCount)
    ) {
      return () => {
        active = false
      }
    }

    void import('@avalon/ui-layout/diagnostics').then(
      ({ solveRoundTableStageLayoutWithDiagnostics }) => {
        if (!active) return
        setDetailedResult(solveRoundTableStageLayoutWithDiagnostics({
          maxStageWidth: stage.size!.width,
          maxStageHeight: stage.size!.height,
          playerCount,
        }))
      },
    )

    return () => {
      active = false
    }
  }, [diagnosticsEnabled, playerCount, stage.size])

  const snapshot = useMemo(
    () => resolveRoomLayoutSnapshot({
      viewportSize,
      canvasSize: canvas.size,
      stageSize: stage.size,
      playerCount,
      detailedResult: diagnosticsEnabled ? detailedResult : undefined,
    }),
    [canvas.size, detailedResult, diagnosticsEnabled, playerCount, stage.size, viewportSize],
  )

  return {
    canvasRef: canvas.ref,
    stageRef: stage.ref,
    snapshot,
  }
}
