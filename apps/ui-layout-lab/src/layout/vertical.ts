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
  LayoutInput,
  LayoutUnavailable,
  PlayerSeatLayout,
  Point,
  Rect,
  VerticalRoomLayout,
} from './types'

type SeatTier = Readonly<{
  name: '56px' | '48px' | '40px' | '36px'
  seatWidth: number
  avatarDiameter: number
  nameHeight: number
  avatarTopClearance: number
  seatGap: number
  centerPanelDiameterMin: number
  centerPanelDiameterMax: number
}>

type VerticalStage = Readonly<{
  variant: 'compact' | 'normal'
  topBarHeight: number
  phasePanelHeight: number
  stageMargin: number
  stageWidth: number
  stageHeight: number
  safeStageWidth: number
  safeStageHeight: number
}>

type StadiumGeometry = Readonly<{
  points: readonly Point[]
  centerAisleGap: number
  centerAislePairs: readonly (readonly [number, number])[]
  tabletopCenterOffsetY: number
  equalArcDeviation: number
}>

type VerticalCandidate = Readonly<{
  tier: SeatTier
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

const VERTICAL_MINIMUM_WIDTH = 375
const VERTICAL_MINIMUM_HEIGHT = 667
const PLAYER_ORBIT_WIDTH_SCALE = 0.86
const TABLETOP_WIDTH_SCALE = 0.74
const TABLETOP_CENTER_OFFSET_SCALE_CAP = 0.06
const CENTER_PANEL_GAP = 12
const NAME_GAP = 4

const SEAT_TIERS: readonly SeatTier[] = [
  {
    name: '56px', seatWidth: 112, avatarDiameter: 56, nameHeight: 26,
    avatarTopClearance: 64 / 3, seatGap: 8,
    centerPanelDiameterMin: 152, centerPanelDiameterMax: 256,
  },
  {
    name: '48px', seatWidth: 96, avatarDiameter: 48, nameHeight: 24,
    avatarTopClearance: 56 / 3, seatGap: 8,
    centerPanelDiameterMin: 152, centerPanelDiameterMax: 256,
  },
  {
    name: '40px', seatWidth: 80, avatarDiameter: 40, nameHeight: 22,
    avatarTopClearance: 16, seatGap: 8,
    centerPanelDiameterMin: 152, centerPanelDiameterMax: 256,
  },
  {
    name: '36px', seatWidth: 72, avatarDiameter: 36, nameHeight: 20,
    avatarTopClearance: 12, seatGap: 6,
    centerPanelDiameterMin: 136, centerPanelDiameterMax: 152,
  },
]

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
  tier: SeatTier,
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
  tier: SeatTier
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

function buildStadiumGeometry(
  playerCount: number,
  playerOrbitWidth: number,
  stadiumStraightLength: number,
  tier: SeatTier,
  roundTableFrameWidth: number,
  centerPanelDiameter: number,
): StadiumGeometry | null {
  const halfOrbitLength = Math.PI * playerOrbitWidth / 2 + stadiumStraightLength
  const sideSeatCount = Math.floor((playerCount - 1) / 2)
  const hasTopSeat = playerCount % 2 === 0
  const candidates: StadiumGeometry[] = []

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
  return candidates[0] ?? null
}

function createCandidate(
  input: LayoutInput,
  tier: SeatTier,
  shape: 'circle' | 'stadium',
  roundTableFrameWidth: number,
  stadiumStraightLength: number,
  stadiumGeometry: StadiumGeometry | null = null,
): VerticalCandidate | null {
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

function createVerticalStage(input: LayoutInput): VerticalStage {
  const isCompact = input.height < 800
  const topBarHeight = isCompact ? 48 : 56
  const phasePanelHeight = isCompact ? 152 : 168
  const stageMargin = isCompact ? 8 : 12
  const stageHeight = input.height - topBarHeight - phasePanelHeight
  return {
    variant: isCompact ? 'compact' : 'normal',
    topBarHeight,
    phasePanelHeight,
    stageMargin,
    stageWidth: input.width,
    stageHeight,
    safeStageWidth: input.width - 2 * stageMargin,
    safeStageHeight: stageHeight - 2 * stageMargin,
  }
}

function buildPlayerSeats(
  stage: VerticalStage,
  candidate: VerticalCandidate,
): readonly PlayerSeatLayout[] {
  const footprintOffsetY = (
    seatBottomExtent(candidate.tier) - seatTopExtent(candidate.tier)
  ) / 2
  const playerOrbitCenter = {
    x: stage.stageWidth / 2,
    y: stage.topBarHeight + stage.stageHeight / 2 - footprintOffsetY,
  }
  return candidate.points.map((point, relativeSeatIndex) => {
    const avatarCenter = quantizePoint({
      x: playerOrbitCenter.x + point.x,
      y: playerOrbitCenter.y + point.y,
    })
    const avatarRadius = candidate.tier.avatarDiameter / 2
    return {
      relativeSeatIndex,
      playerSeatBounds: createRect(
        avatarCenter.x - candidate.tier.seatWidth / 2,
        avatarCenter.y - seatTopExtent(candidate.tier),
        candidate.tier.seatWidth,
        seatTopExtent(candidate.tier) + seatBottomExtent(candidate.tier),
      ),
      avatarRect: createRect(
        avatarCenter.x - avatarRadius,
        avatarCenter.y - avatarRadius,
        candidate.tier.avatarDiameter,
        candidate.tier.avatarDiameter,
      ),
      nameRect: createRect(
        avatarCenter.x - candidate.tier.seatWidth / 2,
        avatarCenter.y + avatarRadius + NAME_GAP,
        candidate.tier.seatWidth,
        candidate.tier.nameHeight,
      ),
      avatarTopClearance: quantize(candidate.tier.avatarTopClearance),
    }
  })
}

function buildReadyLayout(
  input: LayoutInput,
  stage: VerticalStage,
  candidate: VerticalCandidate,
): VerticalRoomLayout | null {
  const regions = {
    topBar: createRect(0, 0, input.width, stage.topBarHeight),
    stage: createRect(0, stage.topBarHeight, stage.stageWidth, stage.stageHeight),
    safeStage: createRect(
      stage.stageMargin,
      stage.topBarHeight + stage.stageMargin,
      stage.safeStageWidth,
      stage.safeStageHeight,
    ),
    phasePanel: createRect(
      0,
      input.height - stage.phasePanelHeight,
      input.width,
      stage.phasePanelHeight,
    ),
  }
  const footprintOffsetY = (
    seatBottomExtent(candidate.tier) - seatTopExtent(candidate.tier)
  ) / 2
  const playerOrbitCenter = {
    x: stage.stageWidth / 2,
    y: stage.topBarHeight + stage.stageHeight / 2 - footprintOffsetY,
  }
  const tabletopCenter = quantizePoint({
    x: playerOrbitCenter.x,
    y: playerOrbitCenter.y + candidate.tabletopCenterOffsetY,
  })
  const playerSeats = buildPlayerSeats(stage, candidate)
  const tabletop = createRect(
    tabletopCenter.x - candidate.tabletopWidth / 2,
    tabletopCenter.y - candidate.tabletopHeight / 2,
    candidate.tabletopWidth,
    candidate.tabletopHeight,
  )
  const centerPanel = createRect(
    tabletopCenter.x - candidate.centerPanelDiameter / 2,
    tabletopCenter.y - candidate.centerPanelDiameter / 2,
    candidate.centerPanelDiameter,
    candidate.centerPanelDiameter,
  )
  const footprint = unionRects([
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

  const readyLayout: VerticalRoomLayout = {
    status: 'ready',
    mode: 'vertical',
    variant: stage.variant,
    width: quantize(input.width),
    height: quantize(input.height),
    regions,
    roundTable: {
      shape: candidate.shape,
      seatTier: candidate.tier.name,
      avatarDiameter: candidate.tier.avatarDiameter,
      seatGap: candidate.tier.seatGap,
      frame: createRect(
        playerOrbitCenter.x - candidate.roundTableFrameWidth / 2,
        playerOrbitCenter.y
          - (candidate.roundTableFrameWidth + candidate.stadiumStraightLength) / 2,
        candidate.roundTableFrameWidth,
        candidate.roundTableFrameWidth + candidate.stadiumStraightLength,
      ),
      tabletop,
      centerPanel,
      playerOrbit: {
        shape: candidate.shape,
        bounds: createRect(
          playerOrbitCenter.x - candidate.playerOrbitWidth / 2,
          playerOrbitCenter.y - candidate.playerOrbitHeight / 2,
          candidate.playerOrbitWidth,
          candidate.playerOrbitHeight,
        ),
        stadiumStraightLength: candidate.stadiumStraightLength,
      },
      footprint,
      centerAisleGap: quantize(candidate.centerAisleGap),
    },
    playerSeats,
    diagnostics: {
      standardBoundaryGaps,
      centerAisleGaps,
      centerAislePairs: candidate.centerAislePairs,
      tabletopCenterOffsetY: quantize(candidate.tabletopCenterOffsetY),
    },
  }
  return validatesRenderedLayout(readyLayout) ? readyLayout : null
}

function validatesRenderedLayout(layout: VerticalRoomLayout): boolean {
  const { playerSeats, roundTable } = layout
  if (!containsRect(layout.regions.safeStage, roundTable.footprint)) return false
  const tabletopCenter = {
    x: roundTable.centerPanel.x + roundTable.centerPanel.width / 2,
    y: roundTable.centerPanel.y + roundTable.centerPanel.height / 2,
  }

  for (let seatIndex = 0; seatIndex < playerSeats.length; seatIndex += 1) {
    const seat = playerSeats[seatIndex]
    if (!containsRect(layout.regions.safeStage, seat.playerSeatBounds)) return false
    if (!containsRect(seat.playerSeatBounds, seat.avatarRect)) return false
    if (!containsRect(seat.playerSeatBounds, seat.nameRect)) return false
    if (
      pointToRectDistance(tabletopCenter, seat.playerSeatBounds)
      < roundTable.centerPanel.width / 2 + CENTER_PANEL_GAP - 0.011
    ) return false

    for (let otherSeatIndex = seatIndex + 1; otherSeatIndex < playerSeats.length; otherSeatIndex += 1) {
      if (
        adjacentBoundaryGap(seat.playerSeatBounds, playerSeats[otherSeatIndex].playerSeatBounds)
        < roundTable.seatGap - 0.011
      ) return false
    }
  }

  const { centerAisleGaps, centerAislePairs } = layout.diagnostics
  if (roundTable.shape === 'stadium') {
    if (centerAislePairs.length !== 2 || centerAisleGaps.length !== 2) return false
    if (Math.abs(centerAisleGaps[0] - centerAisleGaps[1]) > 0.02) return false
    const tabletopCenterY = roundTable.tabletop.y + roundTable.tabletop.height / 2
    for (const [firstSeatIndex, secondSeatIndex] of centerAislePairs) {
      const firstBounds = playerSeats[firstSeatIndex].playerSeatBounds
      const secondBounds = playerSeats[secondSeatIndex].playerSeatBounds
      const lowerBounds = firstBounds.y > secondBounds.y ? firstBounds : secondBounds
      const upperBounds = firstBounds.y > secondBounds.y ? secondBounds : firstBounds
      const aisleMidpoint = (lowerBounds.y + upperBounds.y + upperBounds.height) / 2
      if (Math.abs(aisleMidpoint - tabletopCenterY) > 0.02) return false
    }
  }
  return true
}

function solveTier(
  input: LayoutInput,
  stage: VerticalStage,
  tier: SeatTier,
): VerticalRoomLayout | null {
  const roundTableFrameWidth = Math.floor(Math.min(
    640,
    (stage.safeStageWidth - tier.seatWidth) / PLAYER_ORBIT_WIDTH_SCALE,
    (
      stage.safeStageHeight
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
    const circleLayout = buildReadyLayout(input, stage, circleCandidate)
    if (circleLayout !== null) return circleLayout
  }

  const playerOrbitWidth = PLAYER_ORBIT_WIDTH_SCALE * roundTableFrameWidth
  const maximumStraightLength = Math.floor(
    stage.safeStageHeight
    - seatTopExtent(tier)
    - seatBottomExtent(tier)
    - playerOrbitWidth,
  )
  if (maximumStraightLength < 1) return null

  const layouts: VerticalRoomLayout[] = []
  for (
    let stadiumStraightLength = 1;
    stadiumStraightLength <= maximumStraightLength;
    stadiumStraightLength += 1
  ) {
    const centerPanelDiameter = clamp(
      tier.centerPanelDiameterMin,
      0.38 * roundTableFrameWidth,
      tier.centerPanelDiameterMax,
    )
    const stadiumGeometry = buildStadiumGeometry(
      input.playerCount,
      playerOrbitWidth,
      stadiumStraightLength,
      tier,
      roundTableFrameWidth,
      centerPanelDiameter,
    )
    if (stadiumGeometry === null) continue
    const candidate = createCandidate(
      input,
      tier,
      'stadium',
      roundTableFrameWidth,
      stadiumStraightLength,
      stadiumGeometry,
    )
    if (candidate === null) continue
    const layout = buildReadyLayout(input, stage, candidate)
    if (layout !== null) layouts.push(layout)
  }
  layouts.sort((first, second) => (
    first.roundTable.centerAisleGap - second.roundTable.centerAisleGap
    || first.roundTable.playerOrbit.stadiumStraightLength
      - second.roundTable.playerOrbit.stadiumStraightLength
  ))
  return layouts[0] ?? null
}

export function solveVerticalRoomLayout(
  input: LayoutInput,
): VerticalRoomLayout | LayoutUnavailable {
  if (input.width < VERTICAL_MINIMUM_WIDTH || input.height < VERTICAL_MINIMUM_HEIGHT) {
    return { status: 'unavailable', reason: 'insufficient-viewport' }
  }

  const stage = createVerticalStage(input)
  for (const tier of SEAT_TIERS) {
    const layout = solveTier(input, stage, tier)
    if (layout !== null) return layout
  }
  return { status: 'unavailable', reason: 'no-fitting-vertical-tier' }
}
