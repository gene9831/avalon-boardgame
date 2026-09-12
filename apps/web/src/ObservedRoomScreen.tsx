import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { RoomLayoutDiagnostics } from './RoomLayoutDiagnostics'
import { RoomScreen } from './RoomScreen'
import { readRoomSafeAreaInsets, type RoomSafeAreaInsets } from './room-layout-diagnostics'
import type { RoomScreenProps } from './room-screen-props'
import { useRoomLayout, type RoomLayoutDiagnosticsMode } from './useRoomLayout'

type WithoutGeometry<Props> = Props extends unknown ? Omit<Props, 'geometry'> : never

/**
 * Measurement and development-only diagnostics adapter for RoomScreen.
 *
 * Geometry belongs here so the public production scene contract stays pure.
 */
export type ObservedRoomScreenProps = WithoutGeometry<RoomScreenProps> & Readonly<{
  diagnosticsMode?: RoomLayoutDiagnosticsMode
}>

export function ObservedRoomScreen({ diagnosticsMode = 'off', ...props }: ObservedRoomScreenProps) {
  const { canvasRef, stageRef, snapshot } = useRoomLayout(props.scene.playerCount, diagnosticsMode)
  const rootRef = useRef<HTMLElement | null>(null)
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null)
  const [safeArea, setSafeArea] = useState<RoomSafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 })
  const setCanvasRef = useCallback((node: HTMLElement | null) => {
    rootRef.current = node
    canvasRef(node)
  }, [canvasRef])
  const setObservedStageRef = useCallback((node: HTMLDivElement | null) => {
    stageRef(node)
    setStageElement(node)
  }, [stageRef])

  useEffect(() => {
    if (rootRef.current !== null) setSafeArea(readRoomSafeAreaInsets(rootRef.current))
  }, [snapshot.viewportSize])

  return (
    <>
      <RoomScreen {...props} geometry={{ layoutRef: setCanvasRef, stageLayout: snapshot.stageLayout, stageRef: setObservedStageRef }} />
      {diagnosticsMode !== 'off' && stageElement !== null && createPortal(
        <RoomLayoutDiagnostics mode={diagnosticsMode} playerCount={props.scene.playerCount} safeArea={safeArea} snapshot={snapshot} />,
        stageElement,
      )}
    </>
  )
}
