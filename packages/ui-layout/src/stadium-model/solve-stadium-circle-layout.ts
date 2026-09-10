import { hasSupportedStageDimensions } from '../stage-dimensions'
import {
  circleBoundaryGap,
  containsCircle,
  containsRect,
  pointDistance,
  PUBLIC_UNIT,
  quantize,
  quantizeUp,
  VALIDATION_TOLERANCE,
} from './geometry'
import type {
  Circle,
  Point,
  Rect,
  StadiumPlayerLayoutInput,
  StadiumPlayerLayoutReady,
  StadiumPlayerLayoutResult,
} from './types'

const TARGET_CLOSURE_ERROR = 0.000_01

function quantizeDown(value: number): number {
  return Math.floor(value / PUBLIC_UNIT) * PUBLIC_UNIT
}

type NormalizedInput = Readonly<{
  maxStageWidth: number
  maxStageHeight: number
  playerCount: number
  playerRadius: number
  minimumGap: number
  centerProtectionRadius: number
}>

type TrackCandidate = Readonly<{
  center: Point
  pathPosition: number
}>

type PublicTrack = Readonly<{
  bounds: Rect
  axisX: number
  centerY: number
  halfPathLength: number
  bottomAnchor: TrackCandidate
  topAnchor: TrackCandidate
  interiorCandidates: readonly TrackCandidate[]
}>

type FixedTrackPlacement = Readonly<{
  pathPositions: readonly number[]
  circles: readonly Circle[]
  adjacentGaps: readonly number[]
}>

function unavailable(reason: 'invalid-input' | 'no-fitting-layout'): StadiumPlayerLayoutResult {
  return { status: 'unavailable', reason }
}

function hasValidInput(input: StadiumPlayerLayoutInput): boolean {
  const protectionRadius = input.centerProtectionRadius ?? 0
  return hasSupportedStageDimensions(input.maxStageWidth, input.maxStageHeight)
    && Number.isInteger(input.playerCount)
    && input.playerCount >= 5
    && input.playerCount <= 10
    && Number.isFinite(input.avatarSize)
    && input.avatarSize > 0
    && Number.isFinite(input.minimumGap)
    && input.minimumGap >= 0
    && Number.isFinite(protectionRadius)
    && protectionRadius >= 0
}

function normalizeInput(input: StadiumPlayerLayoutInput): NormalizedInput {
  const centerProtectionRadius = input.centerProtectionRadius ?? 0
  return {
    maxStageWidth: input.maxStageWidth,
    maxStageHeight: input.maxStageHeight,
    playerCount: input.playerCount,
    playerRadius: quantizeUp(input.avatarSize),
    minimumGap: input.minimumGap,
    centerProtectionRadius: centerProtectionRadius === 0 ? 0 : quantizeUp(centerProtectionRadius),
  }
}

function largestPublicGridCenterlineWidth(availableWidth: number): number {
  let centipixels = Math.floor(availableWidth / PUBLIC_UNIT + VALIDATION_TOLERANCE)
  if (centipixels % 2 !== 0) centipixels -= 1
  return centipixels * PUBLIC_UNIT
}

function centerlineDistance(point: Point, bounds: Rect): number {
  const radius = bounds.width / 2
  const axisX = bounds.x + radius
  const topCenterY = bounds.y + radius
  const bottomCenterY = bounds.y + bounds.height - radius
  if (point.y <= topCenterY) {
    return Math.abs(pointDistance(point, { x: axisX, y: topCenterY }) - radius)
  }
  if (point.y >= bottomCenterY) {
    return Math.abs(pointDistance(point, { x: axisX, y: bottomCenterY }) - radius)
  }
  return Math.min(
    Math.abs(point.x - bounds.x),
    Math.abs(point.x - (bounds.x + bounds.width)),
  )
}

function pathPositionForPoint(point: Point, bounds: Rect): number {
  const radius = bounds.width / 2
  const axisX = bounds.x + radius
  const topCenterY = bounds.y + radius
  const bottomCenterY = bounds.y + bounds.height - radius
  const straightLength = bounds.height - bounds.width
  if (radius === 0) return bottomCenterY - point.y
  const quarterArcLength = Math.PI * radius / 2
  if (point.y >= bottomCenterY - VALIDATION_TOLERANCE) {
    const angle = Math.atan2(point.y - bottomCenterY, point.x - axisX)
    return radius * (angle - Math.PI / 2)
  }
  if (point.y <= topCenterY + VALIDATION_TOLERANCE) {
    let angle = Math.atan2(point.y - topCenterY, point.x - axisX)
    if (angle < 0) angle += 2 * Math.PI
    return quarterArcLength + straightLength + radius * (angle - Math.PI)
  }
  return quarterArcLength + bottomCenterY - point.y
}

function publicTrack(
  input: NormalizedInput,
  centerlineWidth: number,
  straightLength: number,
): PublicTrack {
  const occupiedHeight = 2 * input.playerRadius + centerlineWidth + straightLength
  const occupiedY = quantize((input.maxStageHeight - occupiedHeight) / 2)
  const axisX = quantize(input.maxStageWidth / 2)
  const bounds: Rect = {
    x: quantize(axisX - centerlineWidth / 2),
    y: quantize(occupiedY + input.playerRadius),
    width: quantize(centerlineWidth),
    height: quantize(centerlineWidth + straightLength),
  }
  const radius = bounds.width / 2
  const topCenterY = bounds.y + radius
  const bottomCenterY = bounds.y + bounds.height - radius
  const bottomAnchor = {
    center: { x: axisX, y: quantize(bottomCenterY + radius) },
    pathPosition: 0,
  }
  const halfPathLength = Math.PI * radius + straightLength
  const topAnchor = {
    center: { x: axisX, y: quantize(topCenterY - radius) },
    pathPosition: halfPathLength,
  }
  const candidates = new Map<string, TrackCandidate>()

  const addCandidate = (center: Point) => {
    if (center.x >= axisX - VALIDATION_TOLERANCE) return
    if (center.y >= bottomAnchor.center.y - VALIDATION_TOLERANCE) return
    if (center.y <= topAnchor.center.y + VALIDATION_TOLERANCE) return
    if (centerlineDistance(center, bounds) > VALIDATION_TOLERANCE) return
    const pathPosition = pathPositionForPoint(center, bounds)
    const key = `${center.x}:${center.y}`
    const previous = candidates.get(key)
    if (previous === undefined || pathPosition < previous.pathPosition) {
      candidates.set(key, { center, pathPosition })
    }
  }

  if (radius === 0) {
    const topTick = Math.ceil((topAnchor.center.y + PUBLIC_UNIT) / PUBLIC_UNIT)
    const bottomTick = Math.floor((bottomAnchor.center.y - PUBLIC_UNIT) / PUBLIC_UNIT)
    for (let yTick = bottomTick; yTick >= topTick; yTick -= 1) {
      addCandidate({ x: axisX, y: yTick * PUBLIC_UNIT })
    }
  } else {
    const leftXTick = Math.ceil(bounds.x / PUBLIC_UNIT)
    const axisXTick = Math.floor((axisX - PUBLIC_UNIT) / PUBLIC_UNIT)
    for (let xTick = axisXTick; xTick >= leftXTick; xTick -= 1) {
      const x = xTick * PUBLIC_UNIT
      const horizontal = x - axisX
      const vertical = Math.sqrt(Math.max(radius * radius - horizontal * horizontal, 0))
      addCandidate({ x, y: quantize(bottomCenterY + vertical) })
      addCandidate({ x, y: quantize(topCenterY - vertical) })
    }

    const bottomCenterTick = Math.ceil(bottomCenterY / PUBLIC_UNIT)
    const bottomAnchorTick = Math.floor((bottomAnchor.center.y - PUBLIC_UNIT) / PUBLIC_UNIT)
    for (let yTick = bottomAnchorTick; yTick >= bottomCenterTick; yTick -= 1) {
      const y = yTick * PUBLIC_UNIT
      const vertical = y - bottomCenterY
      const horizontal = Math.sqrt(Math.max(radius * radius - vertical * vertical, 0))
      addCandidate({ x: quantize(axisX - horizontal), y })
    }

    const topAnchorTick = Math.ceil((topAnchor.center.y + PUBLIC_UNIT) / PUBLIC_UNIT)
    const topCenterTick = Math.floor(topCenterY / PUBLIC_UNIT)
    for (let yTick = topCenterTick; yTick >= topAnchorTick; yTick -= 1) {
      const y = yTick * PUBLIC_UNIT
      const vertical = y - topCenterY
      const horizontal = Math.sqrt(Math.max(radius * radius - vertical * vertical, 0))
      addCandidate({ x: quantize(axisX - horizontal), y })
    }

    const firstSideTick = Math.floor((bottomCenterY - PUBLIC_UNIT) / PUBLIC_UNIT)
    const lastSideTick = Math.ceil((topCenterY + PUBLIC_UNIT) / PUBLIC_UNIT)
    for (let yTick = firstSideTick; yTick >= lastSideTick; yTick -= 1) {
      addCandidate({ x: bounds.x, y: yTick * PUBLIC_UNIT })
    }
  }

  return {
    bounds,
    axisX,
    centerY: quantize((topCenterY + bottomCenterY) / 2),
    halfPathLength,
    bottomAnchor,
    topAnchor,
    interiorCandidates: [...candidates.values()].sort((first, second) => (
      first.pathPosition - second.pathPosition
      || first.center.y - second.center.y
      || first.center.x - second.center.x
    )),
  }
}

function mirrored(center: Point, axisX: number): Point {
  return { x: quantize(2 * axisX - center.x), y: center.y }
}

function hasDistance(first: Point, second: Point, requiredDistance: number): boolean {
  return pointDistance(first, second) >= requiredDistance - VALIDATION_TOLERANCE
}

function clearsProtectionAt(
  input: NormalizedInput,
  protectionCenter: Point,
  center: Point,
): boolean {
  if (input.centerProtectionRadius === 0) return true
  return pointDistance(center, protectionCenter)
    >= input.centerProtectionRadius + input.playerRadius - VALIDATION_TOLERANCE
}

function clearsProtection(input: NormalizedInput, track: PublicTrack, center: Point): boolean {
  return clearsProtectionAt(input, { x: track.axisX, y: track.centerY }, center)
}

function buildFixedTrackPlacement(
  input: NormalizedInput,
  track: PublicTrack,
  targetGap: number,
): FixedTrackPlacement | null {
  const minimumDistance = 2 * input.playerRadius + input.minimumGap
  const targetDistance = 2 * input.playerRadius + targetGap
  const leftPlayerCount = input.playerCount % 2 === 0
    ? (input.playerCount - 2) / 2
    : (input.playerCount - 1) / 2
  if (!clearsProtection(input, track, track.bottomAnchor.center)) return null
  if (input.playerCount % 2 === 0 && !clearsProtection(input, track, track.topAnchor.center)) return null

  const selected: TrackCandidate[] = [track.bottomAnchor]
  let candidateIndex = 0
  for (let playerIndex = 0; playerIndex < leftPlayerCount; playerIndex += 1) {
    const previous = selected[selected.length - 1]
    let next: TrackCandidate | null = null
    for (; candidateIndex < track.interiorCandidates.length; candidateIndex += 1) {
      const candidate = track.interiorCandidates[candidateIndex]
      if (candidate.pathPosition <= previous.pathPosition + Number.EPSILON) continue
      if (!clearsProtection(input, track, candidate.center)) continue
      if (!hasDistance(candidate.center, mirrored(candidate.center, track.axisX), minimumDistance)) continue
      if (!hasDistance(candidate.center, previous.center, targetDistance)) continue

      const isLastLeftPlayer = playerIndex === leftPlayerCount - 1
      if (input.playerCount % 2 === 0) {
        const requiredTopDistance = isLastLeftPlayer ? targetDistance : minimumDistance
        if (!hasDistance(candidate.center, track.topAnchor.center, requiredTopDistance)) continue
      } else if (isLastLeftPlayer && !hasDistance(
        candidate.center,
        mirrored(candidate.center, track.axisX),
        targetDistance,
      )) {
        continue
      }

      const existingCenters = selected.flatMap(({ center }, index) => (
        index === 0 ? [center] : [center, mirrored(center, track.axisX)]
      ))
      if (!existingCenters.every((center) => hasDistance(candidate.center, center, minimumDistance))) {
        continue
      }
      const candidateMirror = mirrored(candidate.center, track.axisX)
      if (!existingCenters.every((center) => hasDistance(candidateMirror, center, minimumDistance))) {
        continue
      }
      next = candidate
      candidateIndex += 1
      break
    }
    if (next === null) return null
    selected.push(next)
  }

  const leftCenters = selected.map(({ center }) => center)
  if (input.playerCount % 2 === 0) leftCenters.push(track.topAnchor.center)
  const rightCenters = leftCenters
    .slice(1, input.playerCount % 2 === 0 ? -1 : undefined)
    .reverse()
    .map((center) => mirrored(center, track.axisX))
  const allCenters = [...leftCenters, ...rightCenters]
  const circles = allCenters.map((center) => ({ center, radius: input.playerRadius }))
  if (circles.length !== input.playerCount) return null
  for (let first = 0; first < circles.length; first += 1) {
    for (let second = first + 1; second < circles.length; second += 1) {
      if (!hasDistance(circles[first].center, circles[second].center, minimumDistance)) return null
    }
  }
  const adjacentGaps = circles.map((circle, index) => circleBoundaryGap(
    circle,
    circles[(index + 1) % circles.length],
  ))
  if (Math.min(...adjacentGaps) < targetGap - VALIDATION_TOLERANCE) return null
  return {
    pathPositions: selected.map(({ pathPosition }) => pathPosition),
    circles,
    adjacentGaps,
  }
}

function validatesPublicResult(
  input: NormalizedInput,
  ready: StadiumPlayerLayoutReady,
): boolean {
  const stage = { x: 0, y: 0, width: input.maxStageWidth, height: input.maxStageHeight }
  if (!containsRect(stage, ready.occupiedBounds, VALIDATION_TOLERANCE)) return false
  if (!ready.playerCircles.every((circle) => containsCircle(stage, circle, VALIDATION_TOLERANCE))) {
    return false
  }
  const minimumDistance = 2 * input.playerRadius + input.minimumGap
  for (let first = 0; first < ready.playerCircles.length; first += 1) {
    const circle = ready.playerCircles[first]
    if (centerlineDistance(circle.center, ready.centerlineBounds) > VALIDATION_TOLERANCE) return false
    if (!clearsProtectionAt(input, {
      x: ready.centerlineBounds.x + ready.centerlineBounds.width / 2,
      y: ready.centerlineBounds.y + ready.centerlineBounds.height / 2,
    }, circle.center)) return false
    for (let second = first + 1; second < ready.playerCircles.length; second += 1) {
      if (!hasDistance(circle.center, ready.playerCircles[second].center, minimumDistance)) return false
    }
  }

  const axisX = ready.centerlineBounds.x + ready.centerlineBounds.width / 2
  const playerCenters = ready.playerCircles.map(({ center }) => center)
  const leftPlayerCount = input.playerCount % 2 === 0
    ? (input.playerCount - 2) / 2
    : (input.playerCount - 1) / 2
  if (Math.abs(playerCenters[0].x - axisX) > VALIDATION_TOLERANCE) return false
  if (playerCenters[0].y !== Math.max(...playerCenters.map(({ y }) => y))) return false
  if (input.playerCount % 2 === 0) {
    const topAnchor = playerCenters[leftPlayerCount + 1]
    if (Math.abs(topAnchor.x - axisX) > VALIDATION_TOLERANCE) return false
    if (topAnchor.y !== Math.min(...playerCenters.map(({ y }) => y))) return false
  }
  for (let index = 1; index <= leftPlayerCount; index += 1) {
    const left = playerCenters[index]
    const right = playerCenters[input.playerCount - index]
    if (left.x >= axisX || left.y >= playerCenters[index - 1].y) return false
    if (Math.abs(left.x + right.x - 2 * axisX) > VALIDATION_TOLERANCE) return false
    if (Math.abs(left.y - right.y) > VALIDATION_TOLERANCE) return false
  }
  return true
}

function readyFromPlacement(
  input: NormalizedInput,
  track: PublicTrack,
  straightLength: number,
  placement: FixedTrackPlacement,
): StadiumPlayerLayoutReady | null {
  const occupiedBounds: Rect = {
    x: quantize(track.bounds.x - input.playerRadius),
    y: quantize(track.bounds.y - input.playerRadius),
    width: quantize(track.bounds.width + 2 * input.playerRadius),
    height: quantize(track.bounds.height + 2 * input.playerRadius),
  }
  const maximumCenterProtectionRadius = quantizeDown(Math.max(
    0,
    Math.min(...placement.circles.map((circle) => (
      pointDistance({ x: track.axisX, y: track.centerY }, circle.center) - circle.radius
    ))),
  ))
  const ready: StadiumPlayerLayoutReady = {
    status: 'ready',
    shape: straightLength === 0 ? 'circle' : 'stadium',
    centerlineBounds: track.bounds,
    stadiumStraightLength: quantize(straightLength),
    targetGap: quantize(Math.min(...placement.adjacentGaps)),
    maximumCenterProtectionRadius,
    playerCircles: placement.circles,
    adjacentBoundaryGaps: placement.adjacentGaps.map(quantize),
    occupiedBounds,
  }
  return validatesPublicResult(input, ready) ? ready : null
}

function placementScore(
  placement: FixedTrackPlacement,
  minimumGap: number,
): readonly number[] {
  const publicExcesses = placement.adjacentGaps.map((gap) => quantize(gap) - minimumGap)
  return [
    Math.max(...publicExcesses),
    publicExcesses.reduce((sum, excess) => sum + excess, 0),
    ...placement.pathPositions,
  ]
}

function comparePlacements(
  first: FixedTrackPlacement,
  second: FixedTrackPlacement,
  minimumGap: number,
): number {
  const firstScore = placementScore(first, minimumGap)
  const secondScore = placementScore(second, minimumGap)
  for (let index = 0; index < firstScore.length; index += 1) {
    if (firstScore[index] !== secondScore[index]) return firstScore[index] - secondScore[index]
  }
  return 0
}

function solveAtStraightLength(
  input: NormalizedInput,
  centerlineWidth: number,
  straightLength: number,
): StadiumPlayerLayoutReady | null {
  const track = publicTrack(input, centerlineWidth, straightLength)
  const minimumPlacement = buildFixedTrackPlacement(input, track, input.minimumGap)
  if (minimumPlacement === null) return null

  let low = input.minimumGap
  let lowPlacement = minimumPlacement
  const infeasibleLimit = Math.hypot(input.maxStageWidth, input.maxStageHeight)
  let increment = 1
  let high = Math.min(low + increment, infeasibleLimit)
  let highPlacement = buildFixedTrackPlacement(input, track, high)
  while (highPlacement !== null && high < infeasibleLimit) {
    low = high
    lowPlacement = highPlacement
    increment *= 2
    high = Math.min(low + increment, infeasibleLimit)
    highPlacement = buildFixedTrackPlacement(input, track, high)
  }
  while (high - low > TARGET_CLOSURE_ERROR) {
    const target = (low + high) / 2
    const placement = buildFixedTrackPlacement(input, track, target)
    if (placement === null) {
      high = target
    } else {
      low = target
      lowPlacement = placement
    }
  }

  const placements = new Map<string, FixedTrackPlacement>()
  const addPlacement = (placement: FixedTrackPlacement | null) => {
    if (placement === null) return
    placements.set(placement.pathPositions.join(':'), placement)
  }
  addPlacement(minimumPlacement)
  addPlacement(lowPlacement)
  addPlacement(buildFixedTrackPlacement(
    input,
    track,
    Math.max(input.minimumGap, low - PUBLIC_UNIT),
  ))
  const ranked = [...placements.values()].sort((first, second) => (
    comparePlacements(first, second, input.minimumGap)
  ))
  for (const placement of ranked) {
    const ready = readyFromPlacement(input, track, straightLength, placement)
    if (ready !== null) return ready
  }
  return null
}

function feasibleAtStraightLength(
  input: NormalizedInput,
  centerlineWidth: number,
  straightLength: number,
): boolean {
  const track = publicTrack(input, centerlineWidth, straightLength)
  return buildFixedTrackPlacement(input, track, input.minimumGap) !== null
}

export function solveStadiumCircleLayout(
  rawInput: StadiumPlayerLayoutInput,
): StadiumPlayerLayoutResult {
  if (!hasValidInput(rawInput)) return unavailable('invalid-input')
  const input = normalizeInput(rawInput)
  const centerlineWidth = largestPublicGridCenterlineWidth(
    Math.min(input.maxStageWidth, input.maxStageHeight) - 2 * input.playerRadius,
  )
  const maximumStraightLength = input.maxStageHeight - 2 * input.playerRadius - centerlineWidth
  if (centerlineWidth < 0 || maximumStraightLength < 0) return unavailable('no-fitting-layout')

  const circle = solveAtStraightLength(input, centerlineWidth, 0)
  if (circle !== null) return circle

  const maximumTick = Math.floor((maximumStraightLength + VALIDATION_TOLERANCE) / PUBLIC_UNIT)
  if (maximumTick < 1 || !feasibleAtStraightLength(
    input,
    centerlineWidth,
    maximumTick * PUBLIC_UNIT,
  )) {
    return unavailable('no-fitting-layout')
  }

  let lowTick = 1
  let highTick = maximumTick
  while (lowTick < highTick) {
    const tick = Math.floor((lowTick + highTick) / 2)
    if (feasibleAtStraightLength(input, centerlineWidth, tick * PUBLIC_UNIT)) {
      highTick = tick
    } else {
      lowTick = tick + 1
    }
  }
  for (let tick = lowTick; tick <= maximumTick; tick += 1) {
    const ready = solveAtStraightLength(input, centerlineWidth, tick * PUBLIC_UNIT)
    if (ready !== null) return ready
  }
  return unavailable('no-fitting-layout')
}
