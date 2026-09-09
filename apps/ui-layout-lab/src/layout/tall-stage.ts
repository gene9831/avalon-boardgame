import {
  adjacentBoundaryGap,
  clamp,
  containsRect,
  createRect,
  pointToRectDistance,
  quantize,
  quantizePoint,
  unionRects,
} from './geometry'
import type {
  DetailedRoundTableStageLayout,
  PlayerSeatLayout,
  Point,
  Rect,
  RoundTableStageLayoutInput,
  RoundTableStageLayoutUnavailable,
} from './types'

type SeatTier = Readonly<{
  seatWidth: number
  avatarDiameter: number
  nameHeight: number
  avatarTopClearance: number
  centerPanelDiameterMin: number
  centerPanelDiameterMax: number
}>

type ResolvedSeatTier = SeatTier & Readonly<{
  seatGap: number
}>

type StadiumGeometry = Readonly<{
  points: readonly Point[]
  centerAisleGap: number
  centerAislePairs: readonly (readonly [number, number])[]
  tabletopCenterOffsetY: number
  equalArcDeviation: number
}>

type TallStageCandidate = Readonly<{
  tier: ResolvedSeatTier
  shape: 'circle' | 'stadium'
  roundTableFrameWidth: number
  stadiumStraightLength: number
  playerOrbitWidth: number
  playerOrbitHeight: number
  tabletopWidth: number
  tabletopHeight: number
  centerPanelDiameter: number
  centerAisleGap: number
  centerAislePairs: readonly (readonly [number, number])[]
  tabletopCenterOffsetY: number
  equalArcDeviation: number
  points: readonly Point[]
}>

const PLAYER_ORBIT_WIDTH_SCALE = 0.86
const TABLETOP_WIDTH_SCALE = 0.74
const TABLETOP_CENTER_OFFSET_SCALE_CAP = 0.06
const CENTER_PANEL_GAP = 12
const NAME_GAP = 4

const MIN_AVATAR_SIZE = 36
const SEAT_TIER_ANCHORS: readonly SeatTier[] = [
  {
    seatWidth: 112, avatarDiameter: 56, nameHeight: 26,
    avatarTopClearance: 64 / 3,
    centerPanelDiameterMin: 152, centerPanelDiameterMax: 256,
  },
  {
    seatWidth: 96, avatarDiameter: 48, nameHeight: 24,
    avatarTopClearance: 56 / 3,
    centerPanelDiameterMin: 152, centerPanelDiameterMax: 256,
  },
  {
    seatWidth: 80, avatarDiameter: 40, nameHeight: 22,
    avatarTopClearance: 16,
    centerPanelDiameterMin: 152, centerPanelDiameterMax: 256,
  },
  {
    seatWidth: 72, avatarDiameter: 36, nameHeight: 20,
    avatarTopClearance: 12,
    centerPanelDiameterMin: 136, centerPanelDiameterMax: 152,
  },
]

function interpolateSeatTier(avatarDiameter: number): SeatTier {
  const upperAnchorIndex = SEAT_TIER_ANCHORS.findIndex((anchor) => (
    anchor.avatarDiameter <= avatarDiameter
  ))
  const lowerAnchor = SEAT_TIER_ANCHORS[upperAnchorIndex]
  if (lowerAnchor.avatarDiameter === avatarDiameter || upperAnchorIndex === 0) {
    return { ...lowerAnchor, avatarDiameter }
  }
  const upperAnchor = SEAT_TIER_ANCHORS[upperAnchorIndex - 1]
  const interpolationRatio = (
    avatarDiameter - lowerAnchor.avatarDiameter
  ) / (upperAnchor.avatarDiameter - lowerAnchor.avatarDiameter)
  const interpolate = (lowerValue: number, upperValue: number): number => (
    lowerValue + (upperValue - lowerValue) * interpolationRatio
  )
  return {
    avatarDiameter,
    seatWidth: interpolate(lowerAnchor.seatWidth, upperAnchor.seatWidth),
    nameHeight: interpolate(lowerAnchor.nameHeight, upperAnchor.nameHeight),
    avatarTopClearance: interpolate(
      lowerAnchor.avatarTopClearance,
      upperAnchor.avatarTopClearance,
    ),
    centerPanelDiameterMin: interpolate(
      lowerAnchor.centerPanelDiameterMin,
      upperAnchor.centerPanelDiameterMin,
    ),
    centerPanelDiameterMax: interpolate(
      lowerAnchor.centerPanelDiameterMax,
      upperAnchor.centerPanelDiameterMax,
    ),
  }
}

function createSeatTiers(maxAvatarSize: number, avatarSizeStep: number): readonly SeatTier[] {
  const quantizedStep = Math.max(0.01, quantize(avatarSizeStep))
  const avatarSizes: number[] = []
  for (
    let avatarSize = quantize(maxAvatarSize);
    avatarSize > MIN_AVATAR_SIZE;
    avatarSize = quantize(avatarSize - quantizedStep)
  ) {
    avatarSizes.push(avatarSize)
  }
  avatarSizes.push(MIN_AVATAR_SIZE)
  return avatarSizes.map(interpolateSeatTier)
}

function seatTopExtent(tier: SeatTier): number {
  return tier.avatarDiameter / 2 + tier.avatarTopClearance
}

function seatBottomExtent(tier: SeatTier): number {
  return tier.avatarDiameter / 2 + NAME_GAP + tier.nameHeight
}

function measurePlayerSeatBounds(point: Point, tier: SeatTier): Rect {
  return {
    x: point.x - tier.seatWidth / 2,
    y: point.y - seatTopExtent(tier),
    width: tier.seatWidth,
    height: seatTopExtent(tier) + seatBottomExtent(tier),
  }
}

function seatPointsFit(
  points: readonly Point[],
  tier: ResolvedSeatTier,
  centerPanelDiameter: number,
  tabletopCenter: Point = { x: 0, y: 0 },
): boolean {
  const bounds = points.map((point) => measurePlayerSeatBounds(point, tier))
  for (let seatIndex = 0; seatIndex < bounds.length; seatIndex += 1) {
    if (
      pointToRectDistance(tabletopCenter, bounds[seatIndex])
      < centerPanelDiameter / 2 + CENTER_PANEL_GAP
    ) return false

    for (let otherSeatIndex = seatIndex + 1; otherSeatIndex < bounds.length; otherSeatIndex += 1) {
      if (adjacentBoundaryGap(bounds[seatIndex], bounds[otherSeatIndex]) < tier.seatGap) {
        return false
      }
    }
  }
  return true
}

function verticalStadiumHalfPoint(
  distance: number,
  playerOrbitWidth: number,
  stadiumStraightLength: number,
): Point {
  const playerOrbitRadius = playerOrbitWidth / 2
  const quarterArcLength = Math.PI * playerOrbitRadius / 2
  if (distance <= quarterArcLength) {
    const playerOrbitAngle = Math.PI / 2 + distance / playerOrbitRadius
    return {
      x: playerOrbitRadius * Math.cos(playerOrbitAngle),
      y: stadiumStraightLength / 2 + playerOrbitRadius * Math.sin(playerOrbitAngle),
    }
  }

  const sideDistance = distance - quarterArcLength
  if (sideDistance <= stadiumStraightLength) {
    return { x: -playerOrbitRadius, y: stadiumStraightLength / 2 - sideDistance }
  }

  const upperArcDistance = sideDistance - stadiumStraightLength
  const playerOrbitAngle = Math.PI + upperArcDistance / playerOrbitRadius
  return {
    x: playerOrbitRadius * Math.cos(playerOrbitAngle),
    y: -stadiumStraightLength / 2 + playerOrbitRadius * Math.sin(playerOrbitAngle),
  }
}

function packedOrbitDistance(input: Readonly<{
  anchorDistance: number
  direction: -1 | 1
  limitDistance: number
  playerOrbitWidth: number
  stadiumStraightLength: number
  tier: ResolvedSeatTier
}>): number | null {
  const anchorPoint = verticalStadiumHalfPoint(
    input.anchorDistance,
    input.playerOrbitWidth,
    input.stadiumStraightLength,
  )
  const anchorBounds = measurePlayerSeatBounds(anchorPoint, input.tier)
  const gapAtTravel = (travel: number): number => {
    const point = verticalStadiumHalfPoint(
      input.anchorDistance + input.direction * travel,
      input.playerOrbitWidth,
      input.stadiumStraightLength,
    )
    return adjacentBoundaryGap(anchorBounds, measurePlayerSeatBounds(point, input.tier))
  }
  const maximumTravel = Math.abs(input.limitDistance - input.anchorDistance)
  let previousTravel = 0

  for (let travel = 1; travel <= maximumTravel; travel += 1) {
    if (gapAtTravel(travel) < input.tier.seatGap) {
      previousTravel = travel
      continue
    }
    let lowerTravel = previousTravel
    let upperTravel = travel
    for (let iteration = 0; iteration < 16; iteration += 1) {
      const middleTravel = (lowerTravel + upperTravel) / 2
      if (gapAtTravel(middleTravel) >= input.tier.seatGap) upperTravel = middleTravel
      else lowerTravel = middleTravel
    }
    return input.anchorDistance + input.direction * upperTravel
  }
  return null
}

function buildCenteredSideSeatStadiumGeometry(
  playerCount: number,
  sideSeatCount: number,
  hasTopSeat: boolean,
  halfOrbitLength: number,
  playerOrbitWidth: number,
  stadiumStraightLength: number,
  tier: ResolvedSeatTier,
  centerPanelDiameter: number,
): StadiumGeometry | null {
  const centerDistance = halfOrbitLength / 2
  const pairedSeatCount = (sideSeatCount - 1) / 2
  const lowerDistancesDescending: number[] = []
  let lowerAnchorDistance = centerDistance
  for (let seatIndex = 0; seatIndex < pairedSeatCount; seatIndex += 1) {
    const distance = packedOrbitDistance({
      anchorDistance: lowerAnchorDistance,
      direction: -1,
      limitDistance: 0,
      playerOrbitWidth,
      stadiumStraightLength,
      tier,
    })
    if (distance === null) return null
    lowerDistancesDescending.push(distance)
    lowerAnchorDistance = distance
  }

  const upperDistances: number[] = []
  let upperAnchorDistance = centerDistance
  for (let seatIndex = 0; seatIndex < pairedSeatCount; seatIndex += 1) {
    const distance = packedOrbitDistance({
      anchorDistance: upperAnchorDistance,
      direction: 1,
      limitDistance: halfOrbitLength,
      playerOrbitWidth,
      stadiumStraightLength,
      tier,
    })
    if (distance === null) return null
    upperDistances.push(distance)
    upperAnchorDistance = distance
  }

  const leftDistances = [
    ...lowerDistancesDescending.reverse(),
    centerDistance,
    ...upperDistances,
  ]
  const leftPoints = leftDistances.map((distance) => verticalStadiumHalfPoint(
    distance,
    playerOrbitWidth,
    stadiumStraightLength,
  ))
  const playerOrbitRadius = playerOrbitWidth / 2
  const bottomPoint = { x: 0, y: stadiumStraightLength / 2 + playerOrbitRadius }
  const topPoint = { x: 0, y: -stadiumStraightLength / 2 - playerOrbitRadius }
  const mirroredPoints = leftPoints
    .slice()
    .reverse()
    .map((point) => ({ x: -point.x, y: point.y }))
  const points = hasTopSeat
    ? [bottomPoint, ...leftPoints, topPoint, ...mirroredPoints]
    : [bottomPoint, ...leftPoints, ...mirroredPoints]
  if (
    points.length !== playerCount
    || !seatPointsFit(points, tier, centerPanelDiameter)
  ) return null

  const averageInterval = 2 * halfOrbitLength / playerCount
  const equalArcDeviation = leftDistances.reduce((sum, distance, index) => (
    sum + Math.abs(distance - averageInterval * (index + 1))
  ), 0)
  return {
    points,
    centerAisleGap: 0,
    centerAislePairs: [],
    tabletopCenterOffsetY: 0,
    equalArcDeviation,
  }
}

type SafeBandGeometryCandidate = Readonly<{
  geometry: StadiumGeometry
  leftPoints: readonly Point[]
  boundaryGapRange: number
  boundaryGapDeviation: number
  footprintArea: number
}>

type PartialSafeBandPlacement = Readonly<{
  leftPoints: readonly Point[]
  roundedBoundaryGaps: readonly number[]
}>

function compareNumberArrays(
  first: readonly number[],
  second: readonly number[],
): number {
  for (let index = 0; index < Math.min(first.length, second.length); index += 1) {
    if (first[index] !== second[index]) return first[index] - second[index]
  }
  return first.length - second.length
}

function compareSafeBandGeometryCandidates(
  first: SafeBandGeometryCandidate,
  second: SafeBandGeometryCandidate,
): number {
  return first.boundaryGapRange - second.boundaryGapRange
    || first.boundaryGapDeviation - second.boundaryGapDeviation
    || first.footprintArea - second.footprintArea
    || compareNumberArrays(
      first.leftPoints.flatMap((point) => [point.y, point.x]),
      second.leftPoints.flatMap((point) => [point.y, point.x]),
    )
}

function buildSafeBandStadiumGeometry(
  playerCount: number,
  playerOrbitWidth: number,
  stadiumStraightLength: number,
  tier: ResolvedSeatTier,
  roundTableFrameWidth: number,
  centerPanelDiameter: number,
  maxStageWidth: number,
): StadiumGeometry | null {
  const leftSeatCount = playerCount % 2 === 0
    ? (playerCount - 2) / 2
    : (playerCount - 1) / 2
  const hasTopSeat = playerCount % 2 === 0
  const playerOrbitRadius = playerOrbitWidth / 2
  const anchorCenterY = stadiumStraightLength / 2 + playerOrbitRadius
  const bottomPoint = { x: 0, y: anchorCenterY }
  const topPoint = { x: 0, y: -anchorCenterY }
  const maximumHorizontalCenterOffset = (maxStageWidth - tier.seatWidth) / 2
  const minimumHorizontalCenterOffset = (tier.seatWidth + tier.seatGap) / 2

  const buildPoints = (leftPoints: readonly Point[]): readonly Point[] => {
    const mirroredPoints = leftPoints
      .slice()
      .reverse()
      .map((point) => ({ x: -point.x, y: point.y }))
    return hasTopSeat
      ? [bottomPoint, ...leftPoints, topPoint, ...mirroredPoints]
      : [bottomPoint, ...leftPoints, ...mirroredPoints]
  }

  const evaluateLeftPoints = (
    leftPoints: readonly Point[],
  ): SafeBandGeometryCandidate | null => {
    if (leftPoints.length !== leftSeatCount) return null
    const points = buildPoints(leftPoints)
    if (!seatPointsFit(points, tier, centerPanelDiameter)) return null

    const seatBounds = points.map((point) => measurePlayerSeatBounds(point, tier))
    const roundedBoundaryGaps = seatBounds.map((bounds, seatIndex) => Math.round(
      adjacentBoundaryGap(bounds, seatBounds[(seatIndex + 1) % seatBounds.length]),
    ))
    const minimumBoundaryGap = Math.min(...roundedBoundaryGaps)
    const maximumBoundaryGap = Math.max(...roundedBoundaryGaps)
    const averageBoundaryGap = roundedBoundaryGaps.reduce((sum, gap) => sum + gap, 0)
      / roundedBoundaryGaps.length
    const boundaryGapDeviation = roundedBoundaryGaps.reduce((sum, gap) => (
      sum + Math.abs(gap - averageBoundaryGap)
    ), 0)
    const tabletopWidth = TABLETOP_WIDTH_SCALE * roundTableFrameWidth
    const tabletopHeight = tabletopWidth + stadiumStraightLength
    const tabletop = createRect(
      -tabletopWidth / 2,
      -tabletopHeight / 2,
      tabletopWidth,
      tabletopHeight,
    )
    const footprint = unionRects([tabletop, ...seatBounds])
    const halfOrbitLength = Math.PI * playerOrbitWidth / 2 + stadiumStraightLength
    const averageInterval = 2 * halfOrbitLength / playerCount
    const equalArcDeviation = leftPoints.reduce((sum, point, index) => {
      const referencePoint = verticalStadiumHalfPoint(
        averageInterval * (index + 1),
        playerOrbitWidth,
        stadiumStraightLength,
      )
      return sum + Math.hypot(point.x - referencePoint.x, point.y - referencePoint.y)
    }, 0)
    return {
      leftPoints,
      boundaryGapRange: maximumBoundaryGap - minimumBoundaryGap,
      boundaryGapDeviation,
      footprintArea: footprint.width * footprint.height,
      geometry: {
        points,
        centerAisleGap: 0,
        centerAislePairs: [],
        tabletopCenterOffsetY: 0,
        equalArcDeviation,
      },
    }
  }

  const gridValues = (
    minimum: number,
    maximum: number,
    step: number,
  ): readonly number[] => {
    const values: number[] = []
    for (
      let value = Math.ceil(minimum / step) * step;
      value <= maximum;
      value += step
    ) values.push(value)
    return values
  }

  const verticalOffsets = gridValues(
    Math.ceil(-anchorCenterY + 1),
    Math.floor(anchorCenterY - 1),
    4,
  ).slice().reverse()
  const safePoints = verticalOffsets.flatMap((y) => {
    const seatBoundsAtCenter = measurePlayerSeatBounds({ x: 0, y }, tier)
    const verticalDistance = Math.max(
      seatBoundsAtCenter.y,
      0,
      -(seatBoundsAtCenter.y + seatBoundsAtCenter.height),
    )
    const protectedCenterRadius = centerPanelDiameter / 2 + CENTER_PANEL_GAP
    const requiredHorizontalDistance = verticalDistance >= protectedCenterRadius
      ? 0
      : Math.sqrt(protectedCenterRadius ** 2 - verticalDistance ** 2)
    const minimumOffsetAtY = Math.max(
      minimumHorizontalCenterOffset,
      tier.seatWidth / 2 + requiredHorizontalDistance,
    )
    if (minimumOffsetAtY > maximumHorizontalCenterOffset) return []

    const minimumOffset = Math.ceil(minimumOffsetAtY / 4) * 4
    const maximumOffset = Math.floor(maximumHorizontalCenterOffset / 4) * 4
    const middleOffset = Math.round((minimumOffset + maximumOffset) / 8) * 4
    return [...new Set([minimumOffset, middleOffset, maximumOffset])]
      .filter((offset) => (
        offset >= minimumOffsetAtY && offset <= maximumHorizontalCenterOffset
      ))
      .map((offset) => ({ x: -offset, y }))
  })

  const partialPlacementScore = (placement: PartialSafeBandPlacement): readonly number[] => {
    const minimumGap = Math.min(...placement.roundedBoundaryGaps)
    const maximumGap = Math.max(...placement.roundedBoundaryGaps)
    const averageGap = placement.roundedBoundaryGaps.reduce((sum, gap) => sum + gap, 0)
      / placement.roundedBoundaryGaps.length
    const deviation = placement.roundedBoundaryGaps.reduce((sum, gap) => (
      sum + Math.abs(gap - averageGap)
    ), 0)
    return [maximumGap - minimumGap, deviation]
  }

  let placements: readonly PartialSafeBandPlacement[] = [{
    leftPoints: [],
    roundedBoundaryGaps: [],
  }]
  let bestCandidate: SafeBandGeometryCandidate | null = null
  for (let seatIndex = 0; seatIndex < leftSeatCount; seatIndex += 1) {
    const expandedPlacements: PartialSafeBandPlacement[] = []
    for (const placement of placements) {
      const previousPoint = placement.leftPoints.at(-1) ?? bottomPoint
      const previousBounds = measurePlayerSeatBounds(previousPoint, tier)
      for (const point of safePoints) {
        if (point.y >= previousPoint.y) continue
        const leftPoints = [...placement.leftPoints, point]
        const partialPoints = buildPoints(leftPoints)
        if (!seatPointsFit(partialPoints, tier, centerPanelDiameter)) continue
        if (seatIndex === leftSeatCount - 1) {
          const candidate = evaluateLeftPoints(leftPoints)
          if (
            candidate !== null
            && (bestCandidate === null
              || compareSafeBandGeometryCandidates(candidate, bestCandidate) < 0)
          ) bestCandidate = candidate
          continue
        }
        expandedPlacements.push({
          leftPoints,
          roundedBoundaryGaps: [
            ...placement.roundedBoundaryGaps,
            Math.round(adjacentBoundaryGap(
              previousBounds,
              measurePlayerSeatBounds(point, tier),
            )),
          ],
        })
      }
    }

    if (seatIndex === leftSeatCount - 1) break

    const bestByGapRange = new Map<string, PartialSafeBandPlacement[]>()
    for (const placement of expandedPlacements) {
      const scoreKey = [
        Math.min(...placement.roundedBoundaryGaps),
        Math.max(...placement.roundedBoundaryGaps),
      ].join('-')
      const bucket = bestByGapRange.get(scoreKey) ?? []
      bucket.push(placement)
      bucket.sort((first, second) => compareNumberArrays(
        first.leftPoints.flatMap((point) => [point.y, point.x]),
        second.leftPoints.flatMap((point) => [point.y, point.x]),
      ))
      bestByGapRange.set(scoreKey, bucket.slice(0, 4))
    }
    placements = [...bestByGapRange.values()].flat()
      .sort((first, second) => (
        compareNumberArrays(partialPlacementScore(first), partialPlacementScore(second))
        || compareNumberArrays(
          first.leftPoints.flatMap((point) => [point.y, point.x]),
          second.leftPoints.flatMap((point) => [point.y, point.x]),
        )
      ))
      .slice(0, 128)
    if (placements.length === 0) return null
  }

  if (bestCandidate === null) return null

  for (let pass = 0; pass < 2; pass += 1) {
    for (let seatIndex = 0; seatIndex < leftSeatCount; seatIndex += 1) {
      const localCandidates: SafeBandGeometryCandidate[] = [bestCandidate]
      const originalPoint = bestCandidate.leftPoints[seatIndex]
      for (let horizontalDelta = -4; horizontalDelta <= 4; horizontalDelta += 1) {
        for (let verticalDelta = -4; verticalDelta <= 4; verticalDelta += 1) {
          const point = {
            x: originalPoint.x + horizontalDelta,
            y: originalPoint.y + verticalDelta,
          }
          if (
            -point.x < minimumHorizontalCenterOffset
            || -point.x > maximumHorizontalCenterOffset
          ) continue
          const leftPoints = bestCandidate.leftPoints.map((currentPoint, index) => (
            index === seatIndex ? point : currentPoint
          ))
          if (leftPoints.some((currentPoint, index) => (
            index > 0 && currentPoint.y >= leftPoints[index - 1].y
          ))) continue
          const candidate = evaluateLeftPoints(leftPoints)
          if (candidate !== null) localCandidates.push(candidate)
        }
      }
      localCandidates.sort(compareSafeBandGeometryCandidates)
      bestCandidate = localCandidates[0]
    }
  }

  return bestCandidate.geometry
}

function buildStadiumGeometry(
  playerCount: number,
  playerOrbitWidth: number,
  stadiumStraightLength: number,
  tier: ResolvedSeatTier,
  roundTableFrameWidth: number,
  centerPanelDiameter: number,
  maxStageWidth: number,
): StadiumGeometry | null {
  const halfOrbitLength = Math.PI * playerOrbitWidth / 2 + stadiumStraightLength
  const sideSeatCount = Math.floor((playerCount - 1) / 2)
  const hasTopSeat = playerCount % 2 === 0
  const candidates: StadiumGeometry[] = []

  if (sideSeatCount >= 2) {
    const safeBandGeometry = buildSafeBandStadiumGeometry(
      playerCount,
      playerOrbitWidth,
      stadiumStraightLength,
      tier,
      roundTableFrameWidth,
      centerPanelDiameter,
      maxStageWidth,
    )
    if (safeBandGeometry !== null) return safeBandGeometry
  }

  if (sideSeatCount % 2 === 1) {
    return buildCenteredSideSeatStadiumGeometry(
      playerCount,
      sideSeatCount,
      hasTopSeat,
      halfOrbitLength,
      playerOrbitWidth,
      stadiumStraightLength,
      tier,
      centerPanelDiameter,
    )
  }

  const findOddTopDistance = (): number | null => {
    const gapAtTravel = (travel: number): number => {
      const point = verticalStadiumHalfPoint(
        halfOrbitLength - travel,
        playerOrbitWidth,
        stadiumStraightLength,
      )
      const mirroredPoint = { x: -point.x, y: point.y }
      return adjacentBoundaryGap(
        measurePlayerSeatBounds(point, tier),
        measurePlayerSeatBounds(mirroredPoint, tier),
      )
    }
    let previousTravel = 0
    for (let travel = 1; travel < halfOrbitLength; travel += 1) {
      if (gapAtTravel(travel) < tier.seatGap) {
        previousTravel = travel
        continue
      }
      let lowerTravel = previousTravel
      let upperTravel = travel
      for (let iteration = 0; iteration < 16; iteration += 1) {
        const middleTravel = (lowerTravel + upperTravel) / 2
        if (gapAtTravel(middleTravel) >= tier.seatGap) upperTravel = middleTravel
        else lowerTravel = middleTravel
      }
      return halfOrbitLength - upperTravel
    }
    return null
  }

  for (let lowerSeatCount = 0; lowerSeatCount <= sideSeatCount; lowerSeatCount += 1) {
    const upperSeatCount = sideSeatCount - lowerSeatCount
    const lowerDistances: number[] = []
    let lowerAnchorDistance = 0
    let isComplete = true
    for (let seatIndex = 0; seatIndex < lowerSeatCount; seatIndex += 1) {
      const distance = packedOrbitDistance({
        anchorDistance: lowerAnchorDistance,
        direction: 1,
        limitDistance: halfOrbitLength,
        playerOrbitWidth,
        stadiumStraightLength,
        tier,
      })
      if (distance === null) {
        isComplete = false
        break
      }
      lowerDistances.push(distance)
      lowerAnchorDistance = distance
    }
    if (!isComplete) continue

    const upperDistancesDescending: number[] = []
    let upperAnchorDistance = hasTopSeat ? halfOrbitLength : findOddTopDistance()
    if (upperAnchorDistance === null) continue
    if (!hasTopSeat && upperSeatCount > 0) upperDistancesDescending.push(upperAnchorDistance)
    const remainingUpperSeatCount = upperSeatCount - upperDistancesDescending.length
    for (let seatIndex = 0; seatIndex < remainingUpperSeatCount; seatIndex += 1) {
      const distance = packedOrbitDistance({
        anchorDistance: upperAnchorDistance,
        direction: -1,
        limitDistance: 0,
        playerOrbitWidth,
        stadiumStraightLength,
        tier,
      })
      if (distance === null) {
        isComplete = false
        break
      }
      upperDistancesDescending.push(distance)
      upperAnchorDistance = distance
    }
    if (!isComplete) continue

    const upperDistances = upperDistancesDescending.reverse()
    const leftDistances = [...lowerDistances, ...upperDistances]
    if (leftDistances.length !== sideSeatCount) continue
    if (leftDistances.some((distance, index) => (
      index > 0 && distance <= leftDistances[index - 1]
    ))) continue

    const leftPoints = leftDistances.map((distance) => verticalStadiumHalfPoint(
      distance,
      playerOrbitWidth,
      stadiumStraightLength,
    ))
    const bottomPoint = { x: 0, y: stadiumStraightLength / 2 + playerOrbitWidth / 2 }
    const topPoint = { x: 0, y: -stadiumStraightLength / 2 - playerOrbitWidth / 2 }
    const mirroredPoints = leftPoints
      .slice()
      .reverse()
      .map((point) => ({ x: -point.x, y: point.y }))
    const points = hasTopSeat
      ? [bottomPoint, ...leftPoints, topPoint, ...mirroredPoints]
      : [bottomPoint, ...leftPoints, ...mirroredPoints]
    if (points.length !== playerCount) continue

    const lowerAislePoint = lowerDistances.length === 0
      ? bottomPoint
      : leftPoints[lowerDistances.length - 1]
    const upperAislePoint = upperDistances.length === 0
      ? (hasTopSeat ? topPoint : leftPoints[leftPoints.length - 1])
      : leftPoints[lowerDistances.length]
    const lowerAisleBounds = measurePlayerSeatBounds(lowerAislePoint, tier)
    const upperAisleBounds = measurePlayerSeatBounds(upperAislePoint, tier)
    const lowerAisleTop = lowerAisleBounds.y
    const upperAisleBottom = upperAisleBounds.y + upperAisleBounds.height
    if (lowerAisleTop < upperAisleBottom) continue

    const centerAisleGap = lowerAisleTop - upperAisleBottom
    const tabletopCenterOffsetY = (lowerAisleTop + upperAisleBottom) / 2
    if (
      Math.abs(tabletopCenterOffsetY)
      > TABLETOP_CENTER_OFFSET_SCALE_CAP * roundTableFrameWidth
    ) continue
    if (!seatPointsFit(
      points,
      tier,
      centerPanelDiameter,
      { x: 0, y: tabletopCenterOffsetY },
    )) continue

    const averageInterval = 2 * halfOrbitLength / playerCount
    const equalArcDeviation = leftDistances.reduce((sum, distance, index) => (
      sum + Math.abs(distance - averageInterval * (index + 1))
    ), 0)
    const lowerAisleIndex = lowerDistances.length
    const upperAisleIndex = upperDistances.length === 0
      ? (hasTopSeat ? sideSeatCount + 1 : sideSeatCount)
      : lowerDistances.length + 1
    candidates.push({
      points,
      centerAisleGap,
      centerAislePairs: [
        [lowerAisleIndex, upperAisleIndex],
        [playerCount - upperAisleIndex, playerCount - lowerAisleIndex],
      ],
      tabletopCenterOffsetY,
      equalArcDeviation,
    })
  }

  candidates.sort((first, second) => (
    first.centerAisleGap - second.centerAisleGap
    || first.equalArcDeviation - second.equalArcDeviation
  ))
  const fallbackGeometry = candidates[0]
  if (fallbackGeometry === undefined) return null
  return {
    ...fallbackGeometry,
    centerAisleGap: 0,
    centerAislePairs: [],
  }
}

function createCandidate(
  input: RoundTableStageLayoutInput,
  tier: ResolvedSeatTier,
  shape: 'circle' | 'stadium',
  roundTableFrameWidth: number,
  stadiumStraightLength: number,
  stadiumGeometry: StadiumGeometry | null = null,
): TallStageCandidate | null {
  const playerOrbitWidth = PLAYER_ORBIT_WIDTH_SCALE * roundTableFrameWidth
  const playerOrbitHeight = playerOrbitWidth + stadiumStraightLength
  const centerPanelDiameter = clamp(
    tier.centerPanelDiameterMin,
    0.38 * roundTableFrameWidth,
    tier.centerPanelDiameterMax,
  )
  const points = stadiumGeometry?.points ?? Array.from(
    { length: input.playerCount },
    (_, relativeSeatIndex) => {
      const playerSeatAngle = Math.PI / 2
        + relativeSeatIndex * Math.PI * 2 / input.playerCount
      return {
        x: Math.cos(playerSeatAngle) * playerOrbitWidth / 2,
        y: Math.sin(playerSeatAngle) * playerOrbitHeight / 2,
      }
    },
  )
  const tabletopCenterOffsetY = stadiumGeometry?.tabletopCenterOffsetY ?? 0
  if (!seatPointsFit(
    points,
    tier,
    centerPanelDiameter,
    { x: 0, y: tabletopCenterOffsetY },
  )) return null

  return {
    tier,
    shape,
    roundTableFrameWidth,
    stadiumStraightLength,
    playerOrbitWidth,
    playerOrbitHeight,
    tabletopWidth: TABLETOP_WIDTH_SCALE * roundTableFrameWidth,
    tabletopHeight: TABLETOP_WIDTH_SCALE * roundTableFrameWidth + stadiumStraightLength,
    centerPanelDiameter,
    centerAisleGap: stadiumGeometry?.centerAisleGap ?? 0,
    centerAislePairs: stadiumGeometry?.centerAislePairs ?? [],
    tabletopCenterOffsetY,
    equalArcDeviation: stadiumGeometry?.equalArcDeviation ?? 0,
    points,
  }
}

function buildPlayerSeats(
  playerOrbitCenter: Point,
  candidate: TallStageCandidate,
): readonly PlayerSeatLayout[] {
  return candidate.points.map((point, relativeSeatIndex) => {
    const avatarCenter = quantizePoint({
      x: playerOrbitCenter.x + point.x,
      y: playerOrbitCenter.y + point.y,
    })
    const avatarRadius = candidate.tier.avatarDiameter / 2
    const avatarRect = createRect(
      avatarCenter.x - avatarRadius,
      avatarCenter.y - avatarRadius,
      candidate.tier.avatarDiameter,
      candidate.tier.avatarDiameter,
    )
    const nameRect = createRect(
      avatarCenter.x - candidate.tier.seatWidth / 2,
      avatarCenter.y + avatarRadius + NAME_GAP,
      candidate.tier.seatWidth,
      candidate.tier.nameHeight,
    )
    const playerSeatTop = quantize(avatarRect.y - candidate.tier.avatarTopClearance)
    const playerSeatBottom = quantize(nameRect.y + nameRect.height)
    return {
      relativeSeatIndex,
      playerSeatBounds: createRect(
        avatarCenter.x - candidate.tier.seatWidth / 2,
        playerSeatTop,
        candidate.tier.seatWidth,
        playerSeatBottom - playerSeatTop,
      ),
      avatarRect,
      nameRect,
      avatarTopClearance: quantize(candidate.tier.avatarTopClearance),
    }
  })
}

function buildReadyLayout(
  input: RoundTableStageLayoutInput,
  candidate: TallStageCandidate,
): DetailedRoundTableStageLayout | null {
  const footprintOffsetY = (
    seatBottomExtent(candidate.tier) - seatTopExtent(candidate.tier)
  ) / 2
  const initialPlayerOrbitCenter = {
    x: input.maxStageWidth / 2,
    y: input.maxStageHeight / 2 - footprintOffsetY,
  }
  const initialTabletopCenter = quantizePoint({
    x: initialPlayerOrbitCenter.x,
    y: initialPlayerOrbitCenter.y + candidate.tabletopCenterOffsetY,
  })
  const initialPlayerSeats = buildPlayerSeats(initialPlayerOrbitCenter, candidate)
  const initialTabletop = createRect(
    initialTabletopCenter.x - candidate.tabletopWidth / 2,
    initialTabletopCenter.y - candidate.tabletopHeight / 2,
    candidate.tabletopWidth,
    candidate.tabletopHeight,
  )
  const initialCenterPanel = createRect(
    initialTabletopCenter.x - candidate.centerPanelDiameter / 2,
    initialTabletopCenter.y - candidate.centerPanelDiameter / 2,
    candidate.centerPanelDiameter,
    candidate.centerPanelDiameter,
  )
  const initialFootprint = unionRects([
    initialTabletop,
    ...initialPlayerSeats.map((seat) => seat.playerSeatBounds),
  ])
  const translateX = input.maxStageWidth / 2
    - (initialFootprint.x + initialFootprint.width / 2)
  const translateY = input.maxStageHeight / 2
    - (initialFootprint.y + initialFootprint.height / 2)
  const translateRect = (rectangle: Rect): Rect => createRect(
    rectangle.x + translateX,
    rectangle.y + translateY,
    rectangle.width,
    rectangle.height,
  )
  const playerOrbitCenter = quantizePoint({
    x: initialPlayerOrbitCenter.x + translateX,
    y: initialPlayerOrbitCenter.y + translateY,
  })
  const playerSeats = initialPlayerSeats.map((seat) => {
    const avatarRect = translateRect(seat.avatarRect)
    const nameRect = translateRect(seat.nameRect)
    const playerSeatTop = quantize(avatarRect.y - seat.avatarTopClearance)
    const playerSeatBottom = quantize(nameRect.y + nameRect.height)
    return {
      ...seat,
      playerSeatBounds: createRect(
        nameRect.x,
        playerSeatTop,
        nameRect.width,
        playerSeatBottom - playerSeatTop,
      ),
      avatarRect,
      nameRect,
    }
  })
  const tabletop = translateRect(initialTabletop)
  const centerPanel = translateRect(initialCenterPanel)
  const roundTableFrame = createRect(
    playerOrbitCenter.x - candidate.roundTableFrameWidth / 2,
    playerOrbitCenter.y
      - (candidate.roundTableFrameWidth + candidate.stadiumStraightLength) / 2,
    candidate.roundTableFrameWidth,
    candidate.roundTableFrameWidth + candidate.stadiumStraightLength,
  )
  const placementGuide = {
    bounds: createRect(
      playerOrbitCenter.x - candidate.playerOrbitWidth / 2,
      playerOrbitCenter.y - candidate.playerOrbitHeight / 2,
      candidate.playerOrbitWidth,
      candidate.playerOrbitHeight,
    ),
    stadiumStraightLength: candidate.stadiumStraightLength,
  }
  const roundTableFootprint = unionRects([
    tabletop,
    ...playerSeats.map((seat) => seat.playerSeatBounds),
  ])
  const centerAislePairKeys = new Set(candidate.centerAislePairs.map((pair) => (
    pair.slice().sort((first, second) => first - second).join('-')
  )))
  const standardBoundaryGaps: number[] = []
  const centerAisleGaps: number[] = []
  for (let seatIndex = 0; seatIndex < playerSeats.length; seatIndex += 1) {
    const otherSeatIndex = (seatIndex + 1) % playerSeats.length
    const pairKey = [seatIndex, otherSeatIndex]
      .sort((first, second) => first - second)
      .join('-')
    const gap = adjacentBoundaryGap(
      playerSeats[seatIndex].playerSeatBounds,
      playerSeats[otherSeatIndex].playerSeatBounds,
    )
    if (centerAislePairKeys.has(pairKey)) centerAisleGaps.push(gap)
    else standardBoundaryGaps.push(gap)
  }

  const readyLayout: DetailedRoundTableStageLayout = {
    status: 'ready',
    shape: candidate.shape,
    tabletop,
    centerPanel,
    playerSeats,
    diagnostics: {
      roundTableFrame,
      roundTableFootprint,
      placementGuide,
      seatGap: candidate.tier.seatGap,
      centerAisleGap: quantize(candidate.centerAisleGap),
      standardBoundaryGaps,
      centerAisleGaps,
      centerAislePairs: candidate.centerAislePairs,
      tabletopCenterOffsetY: quantize(candidate.tabletopCenterOffsetY),
    },
  }
  return validatesRenderedLayout(input, readyLayout) ? readyLayout : null
}

function validatesRenderedLayout(
  input: RoundTableStageLayoutInput,
  layout: DetailedRoundTableStageLayout,
): boolean {
  const { diagnostics, playerSeats } = layout
  const stageBounds = createRect(0, 0, input.maxStageWidth, input.maxStageHeight)
  if (!containsRect(stageBounds, diagnostics.roundTableFootprint)) return false
  const tabletopCenter = {
    x: layout.centerPanel.x + layout.centerPanel.width / 2,
    y: layout.centerPanel.y + layout.centerPanel.height / 2,
  }

  for (let seatIndex = 0; seatIndex < playerSeats.length; seatIndex += 1) {
    const seat = playerSeats[seatIndex]
    if (!containsRect(stageBounds, seat.playerSeatBounds)) return false
    if (!containsRect(seat.playerSeatBounds, seat.avatarRect)) return false
    if (!containsRect(seat.playerSeatBounds, seat.nameRect)) return false
    if (
      pointToRectDistance(tabletopCenter, seat.playerSeatBounds)
      < layout.centerPanel.width / 2 + CENTER_PANEL_GAP - 0.011
    ) return false

    for (let otherSeatIndex = seatIndex + 1; otherSeatIndex < playerSeats.length; otherSeatIndex += 1) {
      if (
        adjacentBoundaryGap(seat.playerSeatBounds, playerSeats[otherSeatIndex].playerSeatBounds)
        < diagnostics.seatGap - 0.011
      ) return false
    }
  }

  const { centerAisleGaps, centerAislePairs } = layout.diagnostics
  if (layout.shape === 'stadium') {
    if (centerAislePairs.length !== 0 || centerAisleGaps.length !== 0) return false
    const avatarCenter = (seat: PlayerSeatLayout): Point => ({
      x: seat.avatarRect.x + seat.avatarRect.width / 2,
      y: seat.avatarRect.y + seat.avatarRect.height / 2,
    })
    const bottomCenter = avatarCenter(playerSeats[0])
    if (Math.abs(bottomCenter.x - tabletopCenter.x) > 0.02) return false
    if (bottomCenter.y < Math.max(...playerSeats.map((seat) => avatarCenter(seat).y))) {
      return false
    }

    const leftSeatCount = input.playerCount % 2 === 0
      ? (input.playerCount - 2) / 2
      : (input.playerCount - 1) / 2
    if (input.playerCount % 2 === 0) {
      const topCenter = avatarCenter(playerSeats[leftSeatCount + 1])
      if (Math.abs(topCenter.x - tabletopCenter.x) > 0.02) return false
      if (topCenter.y > Math.min(...playerSeats.map((seat) => avatarCenter(seat).y))) {
        return false
      }
    }
    for (let leftSeatIndex = 1; leftSeatIndex <= leftSeatCount; leftSeatIndex += 1) {
      const leftCenter = avatarCenter(playerSeats[leftSeatIndex])
      const rightCenter = avatarCenter(playerSeats[input.playerCount - leftSeatIndex])
      if (Math.abs(leftCenter.y - rightCenter.y) > 0.02) return false
      if (Math.abs(leftCenter.x + rightCenter.x - 2 * tabletopCenter.x) > 0.02) {
        return false
      }
    }
  }
  return true
}

function solveTier(
  input: RoundTableStageLayoutInput,
  tier: ResolvedSeatTier,
): DetailedRoundTableStageLayout | null {
  const roundTableFrameWidth = Math.floor(Math.min(
    640,
    (input.maxStageWidth - tier.seatWidth) / PLAYER_ORBIT_WIDTH_SCALE,
    (
      input.maxStageHeight
      - seatTopExtent(tier)
      - seatBottomExtent(tier)
    ) / PLAYER_ORBIT_WIDTH_SCALE,
  ))
  if (roundTableFrameWidth <= 0) return null

  const circleCandidate = createCandidate(
    input,
    tier,
    'circle',
    roundTableFrameWidth,
    0,
  )
  if (circleCandidate !== null) {
    const circleLayout = buildReadyLayout(input, circleCandidate)
    if (circleLayout !== null) return circleLayout
  }

  const playerOrbitWidth = PLAYER_ORBIT_WIDTH_SCALE * roundTableFrameWidth
  const maximumStraightLength = Math.floor(
    input.maxStageHeight
    - seatTopExtent(tier)
    - seatBottomExtent(tier)
    - playerOrbitWidth,
  )
  if (maximumStraightLength < 1) return null

  const layoutSpacingScore = (
    layout: DetailedRoundTableStageLayout,
  ): readonly number[] => {
    const roundedBoundaryGaps = [
      ...layout.diagnostics.standardBoundaryGaps,
      ...layout.diagnostics.centerAisleGaps,
    ].map(Math.round)
    const minimumBoundaryGap = Math.min(...roundedBoundaryGaps)
    const maximumBoundaryGap = Math.max(...roundedBoundaryGaps)
    const averageBoundaryGap = roundedBoundaryGaps.reduce((sum, gap) => sum + gap, 0)
      / roundedBoundaryGaps.length
    const boundaryGapDeviation = roundedBoundaryGaps.reduce((sum, gap) => (
      sum + Math.abs(gap - averageBoundaryGap)
    ), 0)
    return [
      maximumBoundaryGap - minimumBoundaryGap,
      boundaryGapDeviation,
      layout.diagnostics.roundTableFootprint.width
        * layout.diagnostics.roundTableFootprint.height,
      layout.diagnostics.placementGuide.stadiumStraightLength,
      ...layout.playerSeats.flatMap((seat) => [seat.avatarRect.y, seat.avatarRect.x]),
    ]
  }
  const layouts: DetailedRoundTableStageLayout[] = []
  const triedStraightLengths = new Set<number>()
  const centerPanelDiameter = clamp(
    tier.centerPanelDiameterMin,
    0.38 * roundTableFrameWidth,
    tier.centerPanelDiameterMax,
  )
  const tryStraightLength = (stadiumStraightLength: number): void => {
    if (
      stadiumStraightLength < 1
      || stadiumStraightLength > maximumStraightLength
      || triedStraightLengths.has(stadiumStraightLength)
    ) return
    triedStraightLengths.add(stadiumStraightLength)
    const stadiumGeometry = buildStadiumGeometry(
      input.playerCount,
      playerOrbitWidth,
      stadiumStraightLength,
      tier,
      roundTableFrameWidth,
      centerPanelDiameter,
      input.maxStageWidth,
    )
    if (stadiumGeometry === null) return
    const candidate = createCandidate(
      input,
      tier,
      'stadium',
      roundTableFrameWidth,
      stadiumStraightLength,
      stadiumGeometry,
    )
    if (candidate === null) return
    const layout = buildReadyLayout(input, candidate)
    if (layout !== null) layouts.push(layout)
  }
  for (
    let stadiumStraightLength = 1;
    stadiumStraightLength <= maximumStraightLength;
    stadiumStraightLength += 4
  ) tryStraightLength(stadiumStraightLength)
  tryStraightLength(maximumStraightLength)

  layouts.sort((first, second) => compareNumberArrays(
    layoutSpacingScore(first),
    layoutSpacingScore(second),
  ))
  const bestCoarseStraightLength = layouts[0]?.diagnostics.placementGuide.stadiumStraightLength
  if (bestCoarseStraightLength !== undefined) {
    for (
      let stadiumStraightLength = bestCoarseStraightLength - 3;
      stadiumStraightLength <= bestCoarseStraightLength + 3;
      stadiumStraightLength += 1
    ) tryStraightLength(stadiumStraightLength)
    layouts.sort((first, second) => compareNumberArrays(
      layoutSpacingScore(first),
      layoutSpacingScore(second),
    ))
  }
  return layouts[0] ?? null
}

export function solveTallRoundTableStageLayout(
  input: RoundTableStageLayoutInput,
  seatGap: number,
  maxAvatarSize: number,
  avatarSizeStep: number,
): DetailedRoundTableStageLayout | RoundTableStageLayoutUnavailable {
  for (const tier of createSeatTiers(maxAvatarSize, avatarSizeStep)) {
    const layout = solveTier(input, { ...tier, seatGap })
    if (layout !== null) return layout
  }
  return { status: 'unavailable', reason: 'no-fitting-stage-layout' }
}
