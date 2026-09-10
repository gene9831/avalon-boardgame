import type { CSSProperties, ReactNode } from 'react'
import type {
  PlayerSeatLayout,
  Rect,
  RoundTableStageLayoutResult,
} from '@avalon/ui-layout'

import type { RoundTableSeat } from './RoundTable'

interface SolvedRoundTableStageProps {
  ariaLabel: string
  center: ReactNode
  layout: RoundTableStageLayoutResult | null
  measuredSize?: Readonly<{ width: number; height: number }> | null
  renderSeat: (seat: RoundTableSeat, layout: PlayerSeatLayout) => ReactNode
  seats: readonly RoundTableSeat[]
}

function rectStyle(rect: Rect): CSSProperties {
  return {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

export function SolvedRoundTableStage({
  ariaLabel,
  center,
  layout,
  measuredSize,
  renderSeat,
  seats,
}: SolvedRoundTableStageProps) {
  if (layout?.status !== 'ready') {
    return (
      <section
        aria-label={ariaLabel}
        className="solved-round-table-stage relative size-full isolate"
        data-stage-layout-height={measuredSize?.height}
        data-round-table-seat-count={seats.length}
        data-stage-layout-status={layout?.status ?? 'measuring'}
        data-stage-layout-width={measuredSize?.width}
      >
        {layout?.status === 'unavailable' && (
          <div className="stage-layout-unavailable absolute inset-0 grid place-items-center px-6 text-center" role="status">
            <p className="max-w-sm text-sm font-semibold text-amber-100">当前空间不足，无法安排圆桌，请调整窗口或旋转设备。</p>
          </div>
        )}
      </section>
    )
  }

  const seatsByRelativeIndex = new Map(
    seats.map((seat) => [seat.relativeSeatIndex, seat]),
  )

  return (
    <section
      aria-label={ariaLabel}
      className="solved-round-table-stage relative size-full isolate"
      data-stage-layout-height={measuredSize?.height}
      data-round-table-seat-count={seats.length}
      data-round-table-shape={layout.shape}
      data-stage-layout-status="ready"
      data-stage-layout-width={measuredSize?.width}
    >
      <div
        aria-hidden="true"
        className={`solved-round-table-tabletop absolute z-0 border-[clamp(0.45rem,1.6vw,1.15rem)] border-amber-200/25 bg-[radial-gradient(circle_at_45%_38%,_rgba(53,79,65,0.98),_rgba(18,42,37,0.98)_55%,_rgba(8,22,27,0.98)_100%)] shadow-[0_22px_65px_rgba(0,0,0,0.5),inset_0_0_0_2px_rgba(251,191,36,0.16),inset_0_0_70px_rgba(0,0,0,0.42)] ${layout.shape === 'circle' ? 'rounded-full' : 'rounded-[9999px]'}`}
        style={rectStyle(layout.tabletop)}
      />

      <div
        className="solved-round-table-center absolute z-10 flex items-center justify-center"
        data-round-table-center
        style={rectStyle(layout.centerPanel)}
      >
        {center}
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {layout.playerSeats.map((playerSeatLayout) => {
          const seat = seatsByRelativeIndex.get(playerSeatLayout.relativeSeatIndex)
          if (seat === undefined) return null

          return (
            <div
              className="pointer-events-none absolute"
              data-relative-seat-index={playerSeatLayout.relativeSeatIndex}
              data-round-table-seat="true"
              key={seat.playerID}
              style={rectStyle(playerSeatLayout.playerSeatBounds)}
            >
              {renderSeat(seat, playerSeatLayout)}
            </div>
          )
        })}
      </div>
    </section>
  )
}
