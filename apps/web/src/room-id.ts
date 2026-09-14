const ROOM_ID_DISPLAY_LENGTH = 7

export function formatRoomID(matchID: string) {
  return matchID.slice(0, ROOM_ID_DISPLAY_LENGTH)
}
