import { solveTallRoundTableStageLayout } from './tall-stage'
import { hasSupportedStageDimensions } from '../stage-dimensions'
import type {
  DetailedRoundTableStageLayoutResult,
  RoundTableStageLayoutInput,
  RoundTableStageLayoutResult,
} from './types'

const DEFAULT_MAX_AVATAR_SIZE = 56
const MIN_AVATAR_SIZE = 36
const DEFAULT_AVATAR_SIZE_STEP = 8

function isValidInput(input: RoundTableStageLayoutInput): boolean {
  const maxAvatarSize = input.maxAvatarSize ?? DEFAULT_MAX_AVATAR_SIZE
  const avatarSizeStep = input.avatarSizeStep ?? DEFAULT_AVATAR_SIZE_STEP
  return hasSupportedStageDimensions(input.maxStageWidth, input.maxStageHeight)
    && Number.isInteger(input.playerCount)
    && input.playerCount >= 5
    && input.playerCount <= 10
    && (input.gap === undefined || (Number.isFinite(input.gap) && input.gap >= 0))
    && Number.isFinite(maxAvatarSize)
    && maxAvatarSize >= MIN_AVATAR_SIZE
    && maxAvatarSize <= DEFAULT_MAX_AVATAR_SIZE
    && Number.isFinite(avatarSizeStep)
    && avatarSizeStep >= 4
}

export function solveRoundTableStageLayoutWithDiagnostics(
  input: RoundTableStageLayoutInput,
): DetailedRoundTableStageLayoutResult {
  if (!isValidInput(input)) {
    return { status: 'unavailable', reason: 'invalid-input' }
  }

  if (input.maxStageWidth >= input.maxStageHeight) {
    return { status: 'unavailable', reason: 'wide-stage-strategy-pending' }
  }

  return solveTallRoundTableStageLayout(
    input,
    input.gap ?? 8,
    input.maxAvatarSize ?? DEFAULT_MAX_AVATAR_SIZE,
    input.avatarSizeStep ?? DEFAULT_AVATAR_SIZE_STEP,
  )
}

export function solveRoundTableStageLayout(
  input: RoundTableStageLayoutInput,
): RoundTableStageLayoutResult {
  const result = solveRoundTableStageLayoutWithDiagnostics(input)
  if (result.status === 'unavailable') return result
  return {
    status: 'ready',
    shape: result.shape,
    tabletop: result.tabletop,
    centerPanel: result.centerPanel,
    playerSeats: result.playerSeats,
  }
}
