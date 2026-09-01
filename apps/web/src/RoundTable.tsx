import type { CSSProperties, ReactNode } from 'react'

import type { LobbyPlayer } from './lobby'
import { getSeatAvatarID } from './seat-avatar'
import type { PlayerAvatarID } from './player-profile'

export interface RoundTableSeat {
  avatarID: PlayerAvatarID
  playerID: string
  seatNumber: number
  name: string
  occupied: boolean
  connected: boolean
  isCurrentPlayer: boolean
  isOwner: boolean
  labelPlacement: 'bottom' | 'left' | 'right' | 'top'
  left: number
  top: number
}

interface RoundTableProps {
  ariaLabel: string
  center: ReactNode
  renderSeat: (seat: RoundTableSeat) => ReactNode
  seats: readonly RoundTableSeat[]
}

// oxlint-disable-next-line react/only-export-components
export function buildRoundTableSeats(
  players: readonly LobbyPlayer[],
  numPlayers: number,
  viewerPlayerID: string,
  ownerPlayerID?: string | null,
): RoundTableSeat[] {
  const viewerIndex = Number(viewerPlayerID)

  return Array.from({ length: numPlayers }, (_, index) => {
    const player = players.find(({ id }) => id === index)
    const occupied = player?.name !== undefined && player.name !== null
    const relativeIndex = (index - viewerIndex + numPlayers) % numPlayers
    const angle = (90 + relativeIndex * (360 / numPlayers)) * Math.PI / 180
    const horizontal = Math.cos(angle)
    const vertical = Math.sin(angle)

    return {
      avatarID: getSeatAvatarID(player?.data, index),
      playerID: String(index),
      seatNumber: index + 1,
      name: occupied ? player.name! : '等待加入',
      occupied,
      connected: occupied && player?.isConnected === true,
      isCurrentPlayer: String(index) === viewerPlayerID,
      isOwner: String(index) === ownerPlayerID,
      labelPlacement: vertical > 0.5
        ? 'bottom'
        : vertical < -0.5
          ? 'top'
          : horizontal > 0
            ? 'right'
            : 'left',
      left: Math.round((50 + 43 * Math.cos(angle)) * 100) / 100,
      top: Math.round((50 + 43 * Math.sin(angle)) * 100) / 100,
    }
  })
}

export function RoundTable({ ariaLabel, center, renderSeat, seats }: RoundTableProps) {
  return (
    <section
      aria-label={ariaLabel}
      className="round-table-layout relative mx-auto aspect-square shrink-0"
      data-round-table-seat-count={seats.length}
    >
      <div
        aria-hidden="true"
        className="absolute inset-[13%] rounded-full border-[clamp(0.45rem,1.6vw,1.15rem)] border-amber-200/25 bg-[radial-gradient(circle_at_45%_38%,_rgba(53,79,65,0.98),_rgba(18,42,37,0.98)_55%,_rgba(8,22,27,0.98)_100%)] shadow-[0_22px_65px_rgba(0,0,0,0.5),inset_0_0_0_2px_rgba(251,191,36,0.16),inset_0_0_70px_rgba(0,0,0,0.42)]"
      />

      <div className="round-table-center-shell absolute inset-[26%] z-10 flex items-center justify-center sm:inset-[24%] lg:inset-[23%]" data-round-table-center>
        {center}
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {seats.map((seat) => (
          <div
            className="absolute flex -translate-x-1/2 -translate-y-1/2 justify-center"
            data-round-table-seat="true"
            key={seat.playerID}
            style={{ left: `${seat.left}%`, top: `${seat.top}%` } as CSSProperties}
          >
            {renderSeat(seat)}
          </div>
        ))}
      </div>
    </section>
  )
}
