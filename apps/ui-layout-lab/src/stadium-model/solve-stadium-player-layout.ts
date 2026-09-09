import { solveStadiumRectangleLayout } from './solve-stadium-rectangle-layout'
import type {
  StadiumPlayerLayoutInput,
  StadiumPlayerLayoutResult,
} from './types'

export function solveStadiumPlayerLayout(input: StadiumPlayerLayoutInput): StadiumPlayerLayoutResult {
  return solveStadiumRectangleLayout({
    maxStageWidth: input.maxStageWidth,
    maxStageHeight: input.maxStageHeight,
    playerCount: input.playerCount,
    playerRectangleSize: 2 * input.avatarSize,
    minimumGap: input.minimumGap,
  })
}
