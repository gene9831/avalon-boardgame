import { solveStadiumCircleLayout } from './solve-stadium-circle-layout'
import type {
  StadiumPlayerLayoutInput,
  StadiumPlayerLayoutResult,
} from './types'

export function solveStadiumPlayerLayout(input: StadiumPlayerLayoutInput): StadiumPlayerLayoutResult {
  return solveStadiumCircleLayout(input)
}
