import { rectangleBoundaryGap } from '../stadium-model/geometry'
import { solveStadiumRectangleLayout } from '../stadium-model/solve-stadium-rectangle-layout'
import { containsRect, createRect, pointToRectDistance, quantize, unionRects } from './geometry'
import type { DetailedRoundTableStageLayout, PlayerSeatLayout, Point, Rect, RoundTableStageLayoutInput, RoundTableStageLayoutUnavailable } from './types'

type SeatTier = Readonly<{ seatWidth: number, avatarDiameter: number, nameHeight: number, avatarTopClearance: number, centerPanelDiameterMin: number, centerPanelDiameterMax: number }>
type ResolvedSeatTier = SeatTier & Readonly<{ seatGap: number }>

const PLAYER_ORBIT_WIDTH_SCALE = 0.86
const TABLETOP_WIDTH_SCALE = 0.74
const CENTER_PANEL_GAP = 12
const NAME_GAP = 4
const MIN_AVATAR_SIZE = 36
const SEAT_TIER_ANCHORS: readonly SeatTier[] = [
  { seatWidth: 112, avatarDiameter: 56, nameHeight: 26, avatarTopClearance: 64 / 3, centerPanelDiameterMin: 152, centerPanelDiameterMax: 256 },
  { seatWidth: 96, avatarDiameter: 48, nameHeight: 24, avatarTopClearance: 56 / 3, centerPanelDiameterMin: 152, centerPanelDiameterMax: 256 },
  { seatWidth: 80, avatarDiameter: 40, nameHeight: 22, avatarTopClearance: 16, centerPanelDiameterMin: 152, centerPanelDiameterMax: 256 },
  { seatWidth: 72, avatarDiameter: 36, nameHeight: 20, avatarTopClearance: 12, centerPanelDiameterMin: 136, centerPanelDiameterMax: 152 },
]

function clamp(minimum: number, value: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum))
}

function interpolateSeatTier(avatarDiameter: number): SeatTier {
  const lowerIndex = SEAT_TIER_ANCHORS.findIndex((tier) => tier.avatarDiameter <= avatarDiameter)
  const lower = SEAT_TIER_ANCHORS[lowerIndex]
  if (lowerIndex === 0 || lower.avatarDiameter === avatarDiameter) return { ...lower, avatarDiameter }
  const upper = SEAT_TIER_ANCHORS[lowerIndex - 1]
  const ratio = (avatarDiameter - lower.avatarDiameter) / (upper.avatarDiameter - lower.avatarDiameter)
  const interpolate = (lowerValue: number, upperValue: number) => lowerValue + (upperValue - lowerValue) * ratio
  return { avatarDiameter, seatWidth: interpolate(lower.seatWidth, upper.seatWidth), nameHeight: interpolate(lower.nameHeight, upper.nameHeight), avatarTopClearance: interpolate(lower.avatarTopClearance, upper.avatarTopClearance), centerPanelDiameterMin: interpolate(lower.centerPanelDiameterMin, upper.centerPanelDiameterMin), centerPanelDiameterMax: interpolate(lower.centerPanelDiameterMax, upper.centerPanelDiameterMax) }
}

function createSeatTiers(maxAvatarSize: number, avatarSizeStep: number): readonly SeatTier[] {
  const step = Math.max(0.01, quantize(avatarSizeStep))
  const sizes: number[] = []
  for (let size = quantize(maxAvatarSize); size > MIN_AVATAR_SIZE; size = quantize(size - step)) sizes.push(size)
  sizes.push(MIN_AVATAR_SIZE)
  return sizes.map(interpolateSeatTier)
}

function translateRect(rectangle: Rect, x: number): Rect {
  return createRect(rectangle.x + x, rectangle.y, rectangle.width, rectangle.height)
}

function centerOf(rectangle: Rect): Point {
  return { x: rectangle.x + rectangle.width / 2, y: rectangle.y + rectangle.height / 2 }
}

function createPlayerSeats(playerRects: readonly Rect[], tier: ResolvedSeatTier): readonly PlayerSeatLayout[] {
  const contentHeight = tier.avatarTopClearance + tier.avatarDiameter + NAME_GAP + tier.nameHeight
  return playerRects.map((playerSeatBounds, relativeSeatIndex) => {
    const contentTop = playerSeatBounds.y + (playerSeatBounds.height - contentHeight) / 2
    const avatarRect = createRect(playerSeatBounds.x + (playerSeatBounds.width - tier.avatarDiameter) / 2, contentTop + tier.avatarTopClearance, tier.avatarDiameter, tier.avatarDiameter)
    const nameRect = createRect(playerSeatBounds.x + (playerSeatBounds.width - tier.seatWidth) / 2, avatarRect.y + avatarRect.height + NAME_GAP, tier.seatWidth, tier.nameHeight)
    return { relativeSeatIndex, playerSeatBounds, avatarRect, nameRect, avatarTopClearance: quantize(avatarRect.y - playerSeatBounds.y) }
  })
}

function validatesRenderedLayout(input: RoundTableStageLayoutInput, layout: DetailedRoundTableStageLayout): boolean {
  const stage = createRect(0, 0, input.maxStageWidth, input.maxStageHeight)
  const { diagnostics, playerSeats } = layout
  if (!containsRect(stage, diagnostics.roundTableFrame) || !containsRect(stage, diagnostics.roundTableFootprint) || !containsRect(stage, layout.tabletop) || !containsRect(stage, layout.centerPanel)) return false
  const tabletopCenter = centerOf(layout.centerPanel)
  for (let first = 0; first < playerSeats.length; first += 1) {
    const seat = playerSeats[first]
    if (!containsRect(stage, seat.playerSeatBounds) || !containsRect(seat.playerSeatBounds, seat.avatarRect) || !containsRect(seat.playerSeatBounds, seat.nameRect) || pointToRectDistance(tabletopCenter, seat.playerSeatBounds) < layout.centerPanel.width / 2 + CENTER_PANEL_GAP - 0.011) return false
    for (let second = first + 1; second < playerSeats.length; second += 1) {
      if (rectangleBoundaryGap(seat.playerSeatBounds, playerSeats[second].playerSeatBounds) < diagnostics.seatGap - 0.011) return false
    }
  }
  return true
}

function solveTier(input: RoundTableStageLayoutInput, tier: ResolvedSeatTier): DetailedRoundTableStageLayout | null {
  const businessContentHeight = tier.avatarTopClearance + tier.avatarDiameter + NAME_GAP + tier.nameHeight
  const playerCollisionSize = Math.max(tier.seatWidth, businessContentHeight)
  const internalSolveWidth = Math.min(input.maxStageWidth, playerCollisionSize + PLAYER_ORBIT_WIDTH_SCALE * 640)
  const strict = solveStadiumRectangleLayout({ maxStageWidth: internalSolveWidth, maxStageHeight: input.maxStageHeight, playerCount: input.playerCount, playerRectangleSize: playerCollisionSize, minimumGap: tier.seatGap })
  if (strict.status === 'unavailable') return null
  const offsetX = (input.maxStageWidth - internalSolveWidth) / 2
  const playerRects = strict.playerRects.map((rectangle) => translateRect(rectangle, offsetX))
  const centerlineBounds = translateRect(strict.centerlineBounds, offsetX)
  const center = centerOf(centerlineBounds)
  const frameWidth = centerlineBounds.width / PLAYER_ORBIT_WIDTH_SCALE
  const roundTableFrame = createRect(center.x - frameWidth / 2, center.y - (frameWidth + strict.stadiumStraightLength) / 2, frameWidth, frameWidth + strict.stadiumStraightLength)
  const tabletopWidth = TABLETOP_WIDTH_SCALE * frameWidth
  const tabletop = createRect(center.x - tabletopWidth / 2, center.y - (tabletopWidth + strict.stadiumStraightLength) / 2, tabletopWidth, tabletopWidth + strict.stadiumStraightLength)
  const centerPanelDiameter = clamp(tier.centerPanelDiameterMin, 0.38 * frameWidth, tier.centerPanelDiameterMax)
  const centerPanel = createRect(center.x - centerPanelDiameter / 2, center.y - centerPanelDiameter / 2, centerPanelDiameter, centerPanelDiameter)
  const playerSeats = createPlayerSeats(playerRects, tier)
  const layout: DetailedRoundTableStageLayout = {
    status: 'ready', shape: strict.shape, tabletop, centerPanel, playerSeats,
    diagnostics: {
      roundTableFrame,
      roundTableFootprint: unionRects([tabletop, ...playerRects]),
      placementGuide: { bounds: centerlineBounds, stadiumStraightLength: strict.stadiumStraightLength },
      seatGap: quantize(tier.seatGap),
      adjacentBoundaryGaps: playerRects.map((rectangle, index) => quantize(rectangleBoundaryGap(rectangle, playerRects[(index + 1) % playerRects.length]))),
      tabletopCenterOffsetY: 0,
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
