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

export type Circle = Readonly<{
  center: Point
  radius: number
}>

export type PlayerSeatLayout = Readonly<{
  relativeSeatIndex: number
  playerSeatBounds: Rect
  playerBoundaryCircle: Circle
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
  centerProtectionCircle: Circle
  seatGap: number
  adjacentBoundaryGaps: readonly number[]
  tabletopCenterOffsetY: number
}>

export type DetailedRoundTableStageLayout = RoundTableStageLayout & Readonly<{
  diagnostics: RoundTableStageDiagnostics
}>

export type DetailedRoundTableStageLayoutResult =
  | DetailedRoundTableStageLayout
  | RoundTableStageLayoutUnavailable
