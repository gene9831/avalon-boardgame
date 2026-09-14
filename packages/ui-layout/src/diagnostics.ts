export {
  MAX_STAGE_HEIGHT,
  MAX_STAGE_WIDTH,
  hasSupportedStageDimensions,
} from './stage-dimensions'
export {
  circleBoundaryGap,
  closestCircleBoundarySegment,
  containsCircle,
  containsRect,
  pointDistance,
  PUBLIC_UNIT,
  quantize,
  quantizeUp,
  VALIDATION_TOLERANCE,
} from './stadium-model/geometry'
export { solveStadiumPlayerLayout } from './stadium-model/solve-stadium-player-layout'
export type {
  BoundaryGapSegment,
  Circle as StadiumCircle,
  Point as StadiumPoint,
  Rect as StadiumRect,
  StadiumPlayerLayoutInput,
  StadiumPlayerLayoutReady,
  StadiumPlayerLayoutResult,
  StadiumPlayerLayoutUnavailable,
} from './stadium-model/types'
export { solveRoundTableStageLayoutWithDiagnostics } from './stage-layout/solve-round-table-stage-layout'
export type {
  DetailedRoundTableStageLayout,
  DetailedRoundTableStageLayoutResult,
  PlacementGuideDiagnostics,
  RoundTableStageDiagnostics,
} from './stage-layout/types'
