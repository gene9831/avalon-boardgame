export type LayoutInput = Readonly<{
  width: number
  height: number
  playerCount: number
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

export type PlayerOrbitLayout = Readonly<{
  shape: 'circle' | 'stadium'
  bounds: Rect
  stadiumStraightLength: number
}>

export type RoundTableLayout = Readonly<{
  shape: 'circle' | 'stadium'
  seatTier: '56px' | '48px' | '40px' | '36px'
  avatarDiameter: number
  seatGap: number
  frame: Rect
  tabletop: Rect
  centerPanel: Rect
  playerOrbit: PlayerOrbitLayout
  footprint: Rect
  centerAisleGap: number
}>

export type LayoutDiagnostics = Readonly<{
  standardBoundaryGaps: readonly number[]
  centerAisleGaps: readonly number[]
  centerAislePairs: readonly (readonly [number, number])[]
  tabletopCenterOffsetY: number
}>

export type LayoutUnavailableReason =
  | 'invalid-input'
  | 'insufficient-viewport'
  | 'horizontal-strategy-pending'
  | 'no-fitting-vertical-tier'

export type LayoutUnavailable = Readonly<{
  status: 'unavailable'
  reason: LayoutUnavailableReason
}>

export type VerticalRoomLayout = Readonly<{
  status: 'ready'
  mode: 'vertical'
  variant: 'compact' | 'normal'
  width: number
  height: number
  regions: Readonly<{
    topBar: Rect
    stage: Rect
    safeStage: Rect
    phasePanel: Rect
    phaseContent: Rect
    phaseHeader: Rect
    phaseMiddle: Rect
    phaseAction: Rect
  }>
  roundTable: RoundTableLayout
  playerSeats: readonly PlayerSeatLayout[]
  diagnostics: LayoutDiagnostics
}>

export type RoomLayoutResult = VerticalRoomLayout | LayoutUnavailable
