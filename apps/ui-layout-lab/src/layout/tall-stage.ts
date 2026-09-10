import { circleBoundaryGap, containsCircle, pointDistance, quantizeUp } from '../stadium-model/geometry'
import { solveStadiumPlayerLayout } from '../stadium-model/solve-stadium-player-layout'
import { containsRect, createRect, quantize, unionRects } from './geometry'
import type { Circle, DetailedRoundTableStageLayout, PlayerSeatLayout, Point, Rect, RoundTableStageLayoutInput, RoundTableStageLayoutUnavailable } from './types'

type SeatTier = Readonly<{ seatWidth: number, avatarDiameter: number, nameHeight: number }>
type ResolvedSeatTier = SeatTier & Readonly<{ seatGap: number }>

const PLAYER_ORBIT_WIDTH_SCALE = 0.86
const TABLETOP_WIDTH_SCALE = 0.74
const CENTER_PROTECTION_RADIUS = 80
const CENTER_PANEL_DIAMETER = 152
const NAME_GAP = 4
const MIN_AVATAR_SIZE = 36
const SEAT_TIER_ANCHORS: readonly SeatTier[] = [
  { seatWidth: 112, avatarDiameter: 56, nameHeight: 26 },
  { seatWidth: 96, avatarDiameter: 48, nameHeight: 24 },
  { seatWidth: 80, avatarDiameter: 40, nameHeight: 22 },
  { seatWidth: 72, avatarDiameter: 36, nameHeight: 20 },
]

function interpolateSeatTier(avatarDiameter: number): SeatTier {
  const lowerIndex = SEAT_TIER_ANCHORS.findIndex((tier) => tier.avatarDiameter <= avatarDiameter)
  const lower = SEAT_TIER_ANCHORS[lowerIndex]
  if (lowerIndex === 0 || lower.avatarDiameter === avatarDiameter) return { ...lower, avatarDiameter }
  const upper = SEAT_TIER_ANCHORS[lowerIndex - 1]
  const ratio = (avatarDiameter - lower.avatarDiameter) / (upper.avatarDiameter - lower.avatarDiameter)
  const interpolate = (lowerValue: number, upperValue: number) => lowerValue + (upperValue - lowerValue) * ratio
  return { avatarDiameter, seatWidth: interpolate(lower.seatWidth, upper.seatWidth), nameHeight: interpolate(lower.nameHeight, upper.nameHeight) }
}

function createSeatTiers(maxAvatarSize: number, avatarSizeStep: number): readonly SeatTier[] {
  const step = Math.max(0.01, quantize(avatarSizeStep))
  const sizes: number[] = []
  for (let size = Math.floor(maxAvatarSize * 100) / 100; size > MIN_AVATAR_SIZE; size = quantize(size - step)) sizes.push(size)
  sizes.push(MIN_AVATAR_SIZE)
  return sizes.map(interpolateSeatTier)
}

function translateCircle(circle: Circle, x: number, y: number): Circle {
  return {
    center: { x: quantize(circle.center.x + x), y: quantize(circle.center.y + y) },
    radius: quantize(circle.radius),
  }
}

function centerOf(rectangle: Rect): Point {
  return { x: rectangle.x + rectangle.width / 2, y: rectangle.y + rectangle.height / 2 }
}

function createPlayerSeats(playerCircles: readonly Circle[], tier: ResolvedSeatTier): readonly PlayerSeatLayout[] {
  return playerCircles.map((playerBoundaryCircle, relativeSeatIndex) => {
    const playerSeatBounds = createRect(
      playerBoundaryCircle.center.x - playerBoundaryCircle.radius,
      playerBoundaryCircle.center.y - playerBoundaryCircle.radius,
      2 * playerBoundaryCircle.radius,
      2 * playerBoundaryCircle.radius,
    )
    const avatarRect = createRect(
      playerBoundaryCircle.center.x - tier.avatarDiameter / 2,
      playerBoundaryCircle.center.y - tier.avatarDiameter / 2,
      tier.avatarDiameter,
      tier.avatarDiameter,
    )
    const nameRect = createRect(playerSeatBounds.x + (playerSeatBounds.width - tier.seatWidth) / 2, avatarRect.y + avatarRect.height + NAME_GAP, tier.seatWidth, tier.nameHeight)
    return { relativeSeatIndex, playerSeatBounds, playerBoundaryCircle, avatarRect, nameRect, avatarTopClearance: quantize(avatarRect.y - playerSeatBounds.y) }
  })
}

function validatesRenderedLayout(input: RoundTableStageLayoutInput, layout: DetailedRoundTableStageLayout): boolean {
  const stage = createRect(0, 0, input.maxStageWidth, input.maxStageHeight)
  const { diagnostics, playerSeats } = layout
  if (!containsRect(stage, diagnostics.roundTableFrame) || !containsRect(stage, diagnostics.roundTableFootprint) || !containsRect(stage, layout.tabletop) || !containsRect(stage, layout.centerPanel)) return false
  for (let first = 0; first < playerSeats.length; first += 1) {
    const seat = playerSeats[first]
    const avatarCenter = {
      x: seat.avatarRect.x + seat.avatarRect.width / 2,
      y: seat.avatarRect.y + seat.avatarRect.height / 2,
    }
    if (!containsRect(stage, seat.playerSeatBounds) || !containsCircle(stage, seat.playerBoundaryCircle, 0.011) || !containsRect(seat.playerSeatBounds, seat.avatarRect) || !containsRect(stage, seat.nameRect) || pointDistance(seat.playerBoundaryCircle.center, avatarCenter) > 0.011 || pointDistance(diagnostics.centerProtectionCircle.center, seat.playerBoundaryCircle.center) - seat.playerBoundaryCircle.radius < diagnostics.centerProtectionCircle.radius - 0.011) return false
    for (let second = first + 1; second < playerSeats.length; second += 1) {
      if (circleBoundaryGap(seat.playerBoundaryCircle, playerSeats[second].playerBoundaryCircle) < diagnostics.seatGap - 0.011) return false
    }
  }
  return true
}

function solveTier(input: RoundTableStageLayoutInput, tier: ResolvedSeatTier): DetailedRoundTableStageLayout | null {
  const nameOverflow = quantizeUp(Math.max(0, NAME_GAP + tier.nameHeight - tier.avatarDiameter / 2))
  const internalSolveWidth = Math.min(input.maxStageWidth, input.maxStageHeight, 2 * tier.avatarDiameter + PLAYER_ORBIT_WIDTH_SCALE * 640) - nameOverflow
  const strict = solveStadiumPlayerLayout({ maxStageWidth: internalSolveWidth, maxStageHeight: input.maxStageHeight, playerCount: input.playerCount, avatarSize: tier.avatarDiameter, minimumGap: tier.seatGap, centerProtectionRadius: CENTER_PROTECTION_RADIUS })
  if (strict.status === 'unavailable') return null
  const offsetX = (input.maxStageWidth - internalSolveWidth) / 2
  const offsetY = quantize(-nameOverflow / 2)
  const playerCircles = strict.playerCircles.map((circle) => translateCircle(circle, offsetX, offsetY))
  const centerlineBounds = createRect(
    strict.centerlineBounds.x + offsetX,
    strict.centerlineBounds.y + offsetY,
    strict.centerlineBounds.width,
    strict.centerlineBounds.height,
  )
  const center = centerOf(centerlineBounds)
  const frameWidth = centerlineBounds.width / PLAYER_ORBIT_WIDTH_SCALE
  const roundTableFrame = createRect(center.x - frameWidth / 2, center.y - (frameWidth + strict.stadiumStraightLength) / 2, frameWidth, frameWidth + strict.stadiumStraightLength)
  const tabletopWidth = TABLETOP_WIDTH_SCALE * frameWidth
  const tabletop = createRect(center.x - tabletopWidth / 2, center.y - (tabletopWidth + strict.stadiumStraightLength) / 2, tabletopWidth, tabletopWidth + strict.stadiumStraightLength)
  const centerPanel = createRect(center.x - CENTER_PANEL_DIAMETER / 2, center.y - CENTER_PANEL_DIAMETER / 2, CENTER_PANEL_DIAMETER, CENTER_PANEL_DIAMETER)
  const playerSeats = createPlayerSeats(playerCircles, tier)
  const layout: DetailedRoundTableStageLayout = {
    status: 'ready', shape: strict.shape, tabletop, centerPanel, playerSeats,
    diagnostics: {
      roundTableFrame,
      roundTableFootprint: unionRects([tabletop, ...playerSeats.flatMap(({ playerSeatBounds, nameRect }) => [playerSeatBounds, nameRect])]),
      placementGuide: { bounds: centerlineBounds, stadiumStraightLength: strict.stadiumStraightLength },
      centerProtectionCircle: { center, radius: CENTER_PROTECTION_RADIUS },
      seatGap: quantize(tier.seatGap),
      adjacentBoundaryGaps: strict.adjacentBoundaryGaps,
      tabletopCenterOffsetY: offsetY,
    },
  }
  return validatesRenderedLayout(input, layout) ? layout : null
}

export function solveTallRoundTableStageLayout(input: RoundTableStageLayoutInput, minimumGap: number, maxAvatarSize: number, avatarSizeStep: number): DetailedRoundTableStageLayout | RoundTableStageLayoutUnavailable {
  for (const seatTier of createSeatTiers(maxAvatarSize, avatarSizeStep)) {
    const tier = { ...seatTier, seatGap: minimumGap }
    const layouts = Array.from({ length: input.playerCount - 4 }, (_, index) => solveTier(
      { ...input, playerCount: index + 5 },
      tier,
    ))
    const layout = layouts.at(-1)
    if (layout === undefined) continue
    if (layout !== null && layouts.every((candidate) => candidate !== null)) return layout
  }
  return { status: 'unavailable', reason: 'no-fitting-stage-layout' }
}
