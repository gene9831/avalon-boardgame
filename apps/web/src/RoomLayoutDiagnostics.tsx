import type { Circle, Rect } from '@avalon/ui-layout'
import type { RoomSafeAreaInsets } from './room-layout-diagnostics'
import type { RoomLayoutDiagnosticsMode, RoomLayoutSnapshot } from './useRoomLayout'

export interface RoomLayoutDiagnosticsProps {
  mode: Exclude<RoomLayoutDiagnosticsMode, 'off'>
  playerCount: number | null
  safeArea: RoomSafeAreaInsets
  snapshot: RoomLayoutSnapshot
}

const size = (value: Readonly<{ width: number; height: number }> | null) => value === null ? '—' : `${value.width}×${value.height}`
const svgRect = (rect: Rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
const svgCircle = (circle: Circle) => ({ cx: circle.center.x, cy: circle.center.y, r: circle.radius })

export function RoomLayoutDiagnostics({ mode, playerCount, safeArea, snapshot }: RoomLayoutDiagnosticsProps) {
  const ready = snapshot.stageLayout?.status === 'ready' ? snapshot.stageLayout : null
  const avatarSize = ready?.playerSeats[0]?.avatarRect.width ?? null
  const solverStatus = snapshot.stageLayout?.status ?? 'measuring'
  return (
    <>
      <output aria-live="polite" className="room-layout-diagnostics pointer-events-none">
        {`viewport ${size(snapshot.viewportSize)} · safe ${safeArea.top}/${safeArea.right}/${safeArea.bottom}/${safeArea.left} · canvas ${size(snapshot.canvasSize)} · ${snapshot.shellMetrics?.mode ?? 'measuring'} · stage ${size(snapshot.stageSize)} · players ${playerCount ?? '未知'} · avatar ${avatarSize ?? '—'}px · ${ready?.shape ?? solverStatus}`}
      </output>
      {mode === 'geometry' && snapshot.diagnostics !== null && snapshot.stageSize !== null && ready !== null && (
        <svg aria-hidden="true" className="room-layout-geometry pointer-events-none" viewBox={`0 0 ${snapshot.stageSize.width} ${snapshot.stageSize.height}`}>
          <rect {...svgRect(snapshot.diagnostics.roundTableFrame)} data-layout-boundary="stage-frame" />
          <rect {...svgRect(ready.tabletop)} data-layout-boundary="tabletop" />
          <circle {...svgCircle(snapshot.diagnostics.centerProtectionCircle)} data-layout-boundary="center-protection" />
          {ready.playerSeats.map((seat) => <g data-relative-seat-index={seat.relativeSeatIndex} key={seat.relativeSeatIndex}><circle {...svgCircle(seat.playerBoundaryCircle)} data-layout-boundary="player-circle" /><rect {...svgRect(seat.avatarRect)} data-layout-boundary="avatar" /><rect {...svgRect(seat.nameRect)} data-layout-boundary="name" /></g>)}
        </svg>
      )}
    </>
  )
}
