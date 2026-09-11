import type { CSSProperties, ReactNode } from 'react'
import type {
  PlayerSeatLayout,
  Rect,
  RoundTableStageLayoutResult,
} from '@avalon/ui-layout'

import type { RoomPlayerModel } from './room-screen-model'

export interface RoomStageProps {
  ariaLabel: string
  center: ReactNode
  layout: RoundTableStageLayoutResult | null
  players: readonly RoomPlayerModel[]
  renderPlayer: (
    player: RoomPlayerModel,
    layout: PlayerSeatLayout,
  ) => ReactNode
}

function rectStyle(rect: Rect): CSSProperties {
  return {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

export function RoomStage({
  ariaLabel,
  center,
  layout,
  players,
  renderPlayer,
}: RoomStageProps) {
  if (layout?.status !== 'ready') {
    return (
      <section
        aria-label={ariaLabel}
        className="room-stage relative size-full isolate"
        data-round-table-seat-count={players.length}
        data-stage-layout-status={layout?.status ?? 'measuring'}
      >
        {layout?.status === 'unavailable' && (
          <div className="room-stage__unavailable absolute inset-0 grid place-items-center px-6 text-center" role="status">
            <p className="max-w-sm text-sm font-semibold text-amber-100">
              当前空间不足，无法安排圆桌，请调整窗口或旋转设备。
            </p>
          </div>
        )}
      </section>
    )
  }

  const playersByRelativeIndex = new Map(
    players.map((player) => [player.relativeSeatIndex, player]),
  )

  return (
    <section
      aria-label={ariaLabel}
      className="room-stage relative size-full isolate"
      data-round-table-seat-count={players.length}
      data-round-table-shape={layout.shape}
      data-stage-layout-status="ready"
    >
      <div
        aria-hidden="true"
        className={`room-stage__tabletop absolute ${layout.shape === 'circle' ? 'rounded-full' : 'rounded-[9999px]'}`}
        style={rectStyle(layout.tabletop)}
      />
      <div
        className="room-stage__center absolute flex items-center justify-center"
        data-round-table-center
        style={rectStyle(layout.centerPanel)}
      >
        {center}
      </div>
      <div className="room-stage__players pointer-events-none absolute inset-0" data-room-player-layer="true">
        {layout.playerSeats.map((playerSeatLayout) => {
          const player = playersByRelativeIndex.get(
            playerSeatLayout.relativeSeatIndex,
          )
          if (player === undefined) return null

          return (
            <div
              className="pointer-events-none absolute"
              data-relative-seat-index={playerSeatLayout.relativeSeatIndex}
              data-round-table-seat="true"
              key={player.playerID}
              style={rectStyle(playerSeatLayout.playerSeatBounds)}
            >
              {renderPlayer(player, playerSeatLayout)}
            </div>
          )
        })}
      </div>
    </section>
  )
}
