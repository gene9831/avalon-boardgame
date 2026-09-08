import type { LayoutInput, RoomLayoutResult } from './types'
import { solveVerticalRoomLayout } from './vertical'

function isValidInput(input: LayoutInput): boolean {
  return Number.isFinite(input.width)
    && Number.isFinite(input.height)
    && input.width > 0
    && input.height > 0
    && Number.isInteger(input.playerCount)
    && input.playerCount >= 5
    && input.playerCount <= 10
}

export function solveRoomLayout(input: LayoutInput): RoomLayoutResult {
  if (!isValidInput(input)) {
    return { status: 'unavailable', reason: 'invalid-input' }
  }

  if (input.width >= input.height) {
    return { status: 'unavailable', reason: 'horizontal-strategy-pending' }
  }

  return solveVerticalRoomLayout(input)
}
