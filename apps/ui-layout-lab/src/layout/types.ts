export type RoundTableStageLayoutInput = Readonly<{
  maxStageWidth: number
  maxStageHeight: number
  playerCount: number
  gap?: number
  maxAvatarSize?: number
  avatarSizeStep?: number
}>

export type Point = Readonly<{
  x: number
  y: number
}>

export type Rect = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

export type PlayerSeatLayout = Readonly<{
  relativeSeatIndex: number
  playerSeatBounds: Rect
  avatarRect: Rect
  nameRect: Rect
  avatarTopClearance: number
}>

export type RoundTableShape = 'circle' | 'stadium'

export type RoundTableStageLayout = Readonly<{
  status: 'ready'
  shape: RoundTableShape
  tabletop: Rect
  centerPanel: Rect
  playerSeats: readonly PlayerSeatLayout[]
}>

export type RoundTableStageLayoutUnavailableReason =
  | 'invalid-input'
  | 'wide-stage-strategy-pending'
  | 'no-fitting-stage-layout'

export type RoundTableStageLayoutUnavailable = Readonly<{
  status: 'unavailable'
  reason: RoundTableStageLayoutUnavailableReason
}>

export type RoundTableStageLayoutResult =
  | RoundTableStageLayout
  | RoundTableStageLayoutUnavailable

export type PlacementGuideDiagnostics = Readonly<{
  bounds: Rect
  stadiumStraightLength: number
}>

export type RoundTableStageDiagnostics = Readonly<{
  roundTableFrame: Rect
  roundTableFootprint: Rect
  placementGuide: PlacementGuideDiagnostics
  seatGap: number
  centerAisleGap: number
  standardBoundaryGaps: readonly number[]
  centerAisleGaps: readonly number[]
  centerAislePairs: readonly (readonly [number, number])[]
  tabletopCenterOffsetY: number
}>

export type DetailedRoundTableStageLayout = RoundTableStageLayout & Readonly<{
  diagnostics: RoundTableStageDiagnostics
}>

export type DetailedRoundTableStageLayoutResult =
  | DetailedRoundTableStageLayout
  | RoundTableStageLayoutUnavailable
