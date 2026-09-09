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

export type BoundaryGapSegment = Readonly<{
  start: Point
  end: Point
  distance: number
}>

export type StadiumPlayerLayoutInput = Readonly<{
  maxStageWidth: number
  maxStageHeight: number
  playerCount: number
  avatarSize: number
  minimumGap: number
}>

export type StadiumPlayerLayoutReady = Readonly<{
  status: 'ready'
  shape: 'circle' | 'stadium'
  centerlineBounds: Rect
  stadiumStraightLength: number
  targetGap: number
  playerRects: readonly Rect[]
  playerCenters: readonly Point[]
  adjacentBoundaryGaps: readonly number[]
  occupiedBounds: Rect
}>

export type StadiumPlayerLayoutUnavailable = Readonly<{
  status: 'unavailable'
  reason: 'invalid-input' | 'no-fitting-layout'
}>

export type StadiumPlayerLayoutResult =
  | StadiumPlayerLayoutReady
  | StadiumPlayerLayoutUnavailable
