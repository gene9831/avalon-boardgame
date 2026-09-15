export interface RoomSeatNumberBadgeProps {
  seatNumber: number
}

export function RoomSeatNumberBadge({ seatNumber }: RoomSeatNumberBadgeProps) {
  return (
    <span aria-hidden="true" className="room-seat-number-badge" data-numeric-text="true" data-room-seat-number-badge="true">
      {seatNumber}
    </span>
  )
}
