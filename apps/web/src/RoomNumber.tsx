import { formatRoomID } from './room-id'

export function RoomNumber({ matchID }: { matchID: string }) {
  return (
    <p className="truncate text-sm font-semibold text-slate-100" title={matchID}>
      房间 <span className="font-mono">{formatRoomID(matchID)}</span>
    </p>
  )
}
