import {
  containsRect,
  pointOnLeftHalfStadium,
  PUBLIC_UNIT,
  quantize,
  rectangleBoundaryGap,
  rectFromCenter,
  VALIDATION_TOLERANCE,
} from './geometry'
import type {
  Point,
  Rect,
  StadiumPlayerLayoutReady,
  StadiumPlayerLayoutResult,
  StadiumRectangleLayoutInput,
} from './types'
import { hasSupportedStageDimensions } from '../stage-dimensions'

const SCAN_STEP = 0.25
// Both searches stay two orders of magnitude inside the 0.001px public validation tolerance.
const PATH_ROOT_ERROR = 0.000_01
const TARGET_CLOSURE_ERROR = 0.000_01

type FixedTrackPlacement = Readonly<{
  pathPositions: readonly number[]
  centers: readonly Point[]
  rectangles: readonly Rect[]
  adjacentGaps: readonly number[]
  closureGap: number
}>

type ReadyCandidate = Readonly<{
  straightLength: number
  targetGap: number
  pathPositions: readonly number[]
  ready: StadiumPlayerLayoutReady
}>

function unavailable(reason: 'invalid-input' | 'no-fitting-layout'): StadiumPlayerLayoutResult {
  return { status: 'unavailable', reason }
}

function hasValidInput(input: StadiumRectangleLayoutInput): boolean {
  return hasSupportedStageDimensions(input.maxStageWidth, input.maxStageHeight)
    && Number.isInteger(input.playerCount)
    && input.playerCount >= 5
    && input.playerCount <= 10
    && Number.isFinite(input.playerRectangleSize)
    && input.playerRectangleSize > 0
    && Number.isFinite(input.minimumGap)
    && input.minimumGap >= 0
}

function placeNextPathPosition(
  previous: Readonly<{ pathPosition: number, center: Point }>,
  targetGap: number,
  halfPathLength: number,
  rectangleSize: number,
  pointAt: (pathPosition: number) => Point,
): Readonly<{ pathPosition: number, center: Point }> | null {
  const reachesTarget = (pathPosition: number) => {
    const center = pointAt(pathPosition)
    const reaches = targetGap === 0
      ? !centeredRectanglesOverlapInTheirInteriors(previous.center, center, rectangleSize)
      : centeredRectangleBoundaryGap(previous.center, center, rectangleSize) >= targetGap
    return { center, reaches }
  }
  let low = previous.pathPosition
  let lowReachesTarget = false

  while (low < halfPathLength) {
    const high = Math.min(low + SCAN_STEP, halfPathLength)
    const highResult = reachesTarget(high)
    if (!lowReachesTarget && highResult.reaches) {
      let left = low
      let right = high
      let rightCenter = highResult.center
      while (right - left > PATH_ROOT_ERROR) {
        const middle = (left + right) / 2
        const middleResult = reachesTarget(middle)
        if (middleResult.reaches) {
          right = middle
          rightCenter = middleResult.center
        } else {
          left = middle
        }
      }
      return { pathPosition: right, center: rightCenter }
    }
    low = high
    lowReachesTarget = highResult.reaches
  }

  return null
}

function centeredRectangleBoundaryGap(first: Point, second: Point, rectangleSize: number): number {
  const horizontalClearance = Math.max(Math.abs(first.x - second.x) - rectangleSize, 0)
  const verticalClearance = Math.max(Math.abs(first.y - second.y) - rectangleSize, 0)
  return Math.hypot(horizontalClearance, verticalClearance)
}

function centeredRectanglesOverlapInTheirInteriors(
  first: Point,
  second: Point,
  rectangleSize: number,
): boolean {
  const interiorSpan = rectangleSize - VALIDATION_TOLERANCE
  return Math.abs(first.x - second.x) < interiorSpan
    && Math.abs(first.y - second.y) < interiorSpan
}

function rectanglesOverlapInTheirInteriors(first: Rect, second: Rect): boolean {
  return first.x < second.x + second.width - VALIDATION_TOLERANCE
    && second.x < first.x + first.width - VALIDATION_TOLERANCE
    && first.y < second.y + second.height - VALIDATION_TOLERANCE
    && second.y < first.y + first.height - VALIDATION_TOLERANCE
}

function hasRequiredClearance(rectangles: readonly Rect[], minimumGap: number): boolean {
  for (let first = 0; first < rectangles.length; first += 1) {
    for (let second = first + 1; second < rectangles.length; second += 1) {
      if (rectanglesOverlapInTheirInteriors(rectangles[first], rectangles[second])) return false
      if (rectangleBoundaryGap(rectangles[first], rectangles[second]) < minimumGap - VALIDATION_TOLERANCE) {
        return false
      }
    }
  }
  return true
}

function buildFixedTrackPlacement(
  input: StadiumRectangleLayoutInput,
  centerlineWidth: number,
  straightLength: number,
  targetGap: number,
): FixedTrackPlacement | null {
  const rectangleSize = input.playerRectangleSize
  const halfPathLength = Math.PI * centerlineWidth / 2 + straightLength
  const leftPlayerCount = input.playerCount % 2 === 0
    ? (input.playerCount - 2) / 2
    : (input.playerCount - 1) / 2
  const pointAt = (pathPosition: number) => pointOnLeftHalfStadium(
    pathPosition,
    centerlineWidth,
    straightLength,
  )
  const leftPositions = [0]
  const leftCenters = [pointAt(0)]

  for (let index = 0; index < leftPlayerCount; index += 1) {
    const next = placeNextPathPosition(
      {
        pathPosition: leftPositions[leftPositions.length - 1],
        center: leftCenters[leftCenters.length - 1],
      },
      targetGap,
      halfPathLength,
      rectangleSize,
      pointAt,
    )
    if (next === null || next.pathPosition <= leftPositions[leftPositions.length - 1]) return null
    leftPositions.push(next.pathPosition)
    leftCenters.push(next.center)
  }

  if (input.playerCount % 2 === 0) leftCenters.push(pointAt(halfPathLength))
  const rightCenters = leftCenters
    .slice(1, input.playerCount % 2 === 0 ? -1 : undefined)
    .reverse()
    .map(({ x, y }) => ({ x: -x, y }))
  const centers = [...leftCenters, ...rightCenters]
  const rectangles = centers.map((center) => rectFromCenter(center, rectangleSize))

  if (centers.length !== input.playerCount) return null
  if (new Set(centers.map(({ x, y }) => `${x}:${y}`)).size !== centers.length) return null
  if (!hasRequiredClearance(rectangles, input.minimumGap)) return null

  const closureGap = input.playerCount % 2 === 0
    ? rectangleBoundaryGap(rectangles[leftPositions.length - 1], rectangles[leftPositions.length])
    : rectangleBoundaryGap(
      rectangles[leftPositions.length - 1],
      rectFromCenter(
        { x: -leftCenters[leftCenters.length - 1].x, y: leftCenters[leftCenters.length - 1].y },
        rectangleSize,
      ),
    )
  const adjacentGaps = rectangles.map((rectangle, index) => rectangleBoundaryGap(
    rectangle,
    rectangles[(index + 1) % rectangles.length],
  ))

  return {
    pathPositions: leftPositions,
    centers,
    rectangles,
    adjacentGaps,
    closureGap,
  }
}

function snapCenterToPublicCenterline(
  center: Point,
  bounds: Rect,
): Point | null {
  const radius = bounds.width / 2
  const axisX = bounds.x + radius
  const topCenterY = bounds.y + radius
  const bottomCenterY = bounds.y + bounds.height - radius
  const baseXTick = Math.round(center.x * 100)
  const baseYTick = Math.round(center.y * 100)

  if (center.y > topCenterY && center.y < bottomCenterY) {
    return {
      x: center.x <= axisX ? bounds.x : bounds.x + bounds.width,
      y: quantize(center.y),
    }
  }

  const arcCenterY = center.y >= bottomCenterY ? bottomCenterY : topCenterY
  let best: Point | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (let xTick = baseXTick - 20; xTick <= baseXTick + 20; xTick += 1) {
    for (let yTick = baseYTick - 20; yTick <= baseYTick + 20; yTick += 1) {
      const candidate = { x: xTick / 100, y: yTick / 100 }
      const centerlineDistance = Math.abs(Math.hypot(
        candidate.x - axisX,
        candidate.y - arcCenterY,
      ) - radius)
      if (centerlineDistance > VALIDATION_TOLERANCE) continue
      const distance = Math.hypot(candidate.x - center.x, candidate.y - center.y)
      if (distance < bestDistance - Number.EPSILON) {
        best = candidate
        bestDistance = distance
      }
    }
  }
  return best
}

function translateAndQuantize(
  input: StadiumRectangleLayoutInput,
  centerlineWidth: number,
  straightLength: number,
  targetGap: number,
  placement: FixedTrackPlacement,
  shape: 'circle' | 'stadium',
): StadiumPlayerLayoutReady | null {
  const rectangleSize = input.playerRectangleSize
  const occupiedHeight = rectangleSize + centerlineWidth + straightLength
  const occupiedY = (input.maxStageHeight - occupiedHeight) / 2
  const centerlineBounds: Rect = {
    x: quantize((input.maxStageWidth - centerlineWidth) / 2),
    y: quantize(occupiedY + rectangleSize / 2),
    width: quantize(centerlineWidth),
    height: quantize(centerlineWidth + straightLength),
  }
  const centers = placement.centers.map(({ x, y }) => snapCenterToPublicCenterline({
    x: input.maxStageWidth / 2 + x,
    y: input.maxStageHeight / 2 + y,
  }, centerlineBounds))
  if (centers.some((center) => center === null)) return null
  const publicCenters = centers as Point[]
  const playerRects = publicCenters.map((center) => rectFromCenter(center, quantize(rectangleSize)))
  const adjacentBoundaryGaps = playerRects.map((rectangle, index) => quantize(rectangleBoundaryGap(
    rectangle,
    playerRects[(index + 1) % playerRects.length],
  )))

  return {
    status: 'ready',
    shape,
    centerlineBounds,
    stadiumStraightLength: quantize(straightLength),
    targetGap: quantize(targetGap),
    playerRects,
    playerCenters: publicCenters,
    adjacentBoundaryGaps,
    occupiedBounds: {
      x: quantize((input.maxStageWidth - (centerlineWidth + rectangleSize)) / 2),
      y: quantize(occupiedY),
      width: quantize(centerlineWidth + rectangleSize),
      height: quantize(occupiedHeight),
    },
  }
}

function validatesPublicResult(
  input: StadiumRectangleLayoutInput,
  ready: StadiumPlayerLayoutReady,
): boolean {
  const stage: Rect = { x: 0, y: 0, width: input.maxStageWidth, height: input.maxStageHeight }
  if (!containsRect(stage, ready.occupiedBounds, VALIDATION_TOLERANCE)) return false
  if (!ready.playerRects.every((rectangle) => containsRect(stage, rectangle, VALIDATION_TOLERANCE))) return false
  if (!hasRequiredClearance(ready.playerRects, input.minimumGap)) return false

  const { centerlineBounds } = ready
  const radius = centerlineBounds.width / 2
  const axisX = centerlineBounds.x + radius
  const topCenterY = centerlineBounds.y + radius
  const bottomCenterY = centerlineBounds.y + centerlineBounds.height - radius
  for (const center of ready.playerCenters) {
    const distance = center.y <= topCenterY
      ? Math.abs(Math.hypot(center.x - axisX, center.y - topCenterY) - radius)
      : center.y >= bottomCenterY
        ? Math.abs(Math.hypot(center.x - axisX, center.y - bottomCenterY) - radius)
        : Math.min(
          Math.abs(center.x - centerlineBounds.x),
          Math.abs(center.x - (centerlineBounds.x + centerlineBounds.width)),
        )
    if (distance > VALIDATION_TOLERANCE) return false
  }

  const publicAxisX = quantize(input.maxStageWidth / 2)
  const leftPlayerCount = input.playerCount % 2 === 0
    ? (input.playerCount - 2) / 2
    : (input.playerCount - 1) / 2
  if (Math.abs(ready.playerCenters[0].x - publicAxisX) > VALIDATION_TOLERANCE) return false
  if (ready.playerCenters[0].y !== Math.max(...ready.playerCenters.map(({ y }) => y))) return false
  if (input.playerCount % 2 === 0) {
    const topAnchor = ready.playerCenters[leftPlayerCount + 1]
    if (Math.abs(topAnchor.x - publicAxisX) > VALIDATION_TOLERANCE) return false
    if (topAnchor.y !== Math.min(...ready.playerCenters.map(({ y }) => y))) return false
  }
  for (let index = 1; index <= leftPlayerCount; index += 1) {
    const left = ready.playerCenters[index]
    const right = ready.playerCenters[input.playerCount - index]
    if (left.y >= ready.playerCenters[index - 1].y) return false
    if (Math.abs(left.x + right.x - 2 * publicAxisX) > VALIDATION_TOLERANCE) return false
    if (Math.abs(left.y - right.y) > VALIDATION_TOLERANCE) return false
  }
  return true
}

function readyCandidateFromPlacement(
  input: StadiumRectangleLayoutInput,
  centerlineWidth: number,
  straightLength: number,
  targetGap: number,
  shape: 'circle' | 'stadium',
  placement: FixedTrackPlacement,
): ReadyCandidate | null {
  if (placement.closureGap < targetGap - VALIDATION_TOLERANCE) return null
  const ready = translateAndQuantize(input, centerlineWidth, straightLength, targetGap, placement, shape)
  if (ready === null || !validatesPublicResult(input, ready)) return null
  return { straightLength, targetGap, pathPositions: placement.pathPositions, ready }
}

function placementClosesAtTarget(
  placement: FixedTrackPlacement | null,
  targetGap: number,
): placement is FixedTrackPlacement {
  return placement !== null
    && placement.closureGap >= targetGap - VALIDATION_TOLERANCE
}

function candidateScore(candidate: ReadyCandidate, minimumGap: number): readonly number[] {
  const excesses = candidate.ready.adjacentBoundaryGaps.map((gap) => gap - minimumGap)
  return [
    candidate.straightLength,
    Math.max(...excesses),
    excesses.reduce((sum, excess) => sum + excess, 0),
    ...candidate.pathPositions,
  ]
}

function compareCandidates(first: ReadyCandidate, second: ReadyCandidate, minimumGap: number): number {
  const firstScore = candidateScore(first, minimumGap)
  const secondScore = candidateScore(second, minimumGap)
  for (let index = 0; index < firstScore.length; index += 1) {
    if (firstScore[index] !== secondScore[index]) return firstScore[index] - secondScore[index]
  }
  return 0
}

function solveAtStraightLength(
  input: StadiumRectangleLayoutInput,
  centerlineWidth: number,
  straightLength: number,
  shape: 'circle' | 'stadium',
  knownMinimumPlacement?: FixedTrackPlacement,
): ReadyCandidate | null {
  const minimumPlacement = knownMinimumPlacement ?? buildFixedTrackPlacement(
    input,
    centerlineWidth,
    straightLength,
    input.minimumGap,
  )
  if (!placementClosesAtTarget(minimumPlacement, input.minimumGap)) {
    return null
  }

  let low = input.minimumGap
  let lowPlacement = minimumPlacement
  // A rectangle boundary gap cannot exceed its center distance, which is bounded by the stage diagonal.
  const infeasibleLimit = Math.hypot(input.maxStageWidth, input.maxStageHeight)
    + 2 * VALIDATION_TOLERANCE
  let increment = 1
  let high = Math.min(low + increment, infeasibleLimit)
  let highPlacement = buildFixedTrackPlacement(input, centerlineWidth, straightLength, high)
  while (placementClosesAtTarget(highPlacement, high) && high < infeasibleLimit) {
    low = high
    lowPlacement = highPlacement
    increment *= 2
    high = Math.min(low + increment, infeasibleLimit)
    highPlacement = buildFixedTrackPlacement(input, centerlineWidth, straightLength, high)
  }
  while (high - low > TARGET_CLOSURE_ERROR) {
    const target = (low + high) / 2
    const placement = buildFixedTrackPlacement(input, centerlineWidth, straightLength, target)
    if (placementClosesAtTarget(placement, target)) {
      low = target
      lowPlacement = placement
    } else {
      high = target
    }
  }

  const placementsByTarget = new Map<number, FixedTrackPlacement>([
    [input.minimumGap, minimumPlacement],
    [low, lowPlacement],
  ])
  const compensatedTarget = Math.max(input.minimumGap, low - PUBLIC_UNIT)
  if (!placementsByTarget.has(compensatedTarget)) {
    const compensatedPlacement = buildFixedTrackPlacement(
      input,
      centerlineWidth,
      straightLength,
      compensatedTarget,
    )
    if (compensatedPlacement !== null) {
      placementsByTarget.set(compensatedTarget, compensatedPlacement)
    }
  }
  const candidates = [...placementsByTarget]
    .map(([target, placement]) => readyCandidateFromPlacement(
      input,
      centerlineWidth,
      straightLength,
      target,
      shape,
      placement,
    ))
    .filter((candidate): candidate is ReadyCandidate => candidate !== null)
  if (candidates.length === 0) return null
  return candidates.reduce((bestCandidate, candidate) => (
    compareCandidates(candidate, bestCandidate, input.minimumGap) < 0 ? candidate : bestCandidate
  ))
}

function internallyFeasiblePlacementAtMinimumGap(
  input: StadiumRectangleLayoutInput,
  centerlineWidth: number,
  straightLength: number,
): FixedTrackPlacement | null {
  const placement = buildFixedTrackPlacement(
    input,
    centerlineWidth,
    straightLength,
    input.minimumGap,
  )
  return placementClosesAtTarget(placement, input.minimumGap) ? placement : null
}

function firstInternallyFeasibleTick(
  input: StadiumRectangleLayoutInput,
  centerlineWidth: number,
  maximumTick: number,
): Readonly<{ tick: number, placement: FixedTrackPlacement }> | null {
  if (maximumTick < 1) return null
  let highPlacement = internallyFeasiblePlacementAtMinimumGap(
    input,
    centerlineWidth,
    maximumTick * PUBLIC_UNIT,
  )
  if (highPlacement === null) {
    return null
  }
  let lowTick = 1
  let highTick = maximumTick
  while (lowTick < highTick) {
    const tick = Math.floor((lowTick + highTick) / 2)
    const placement = internallyFeasiblePlacementAtMinimumGap(input, centerlineWidth, tick * PUBLIC_UNIT)
    if (placement === null) {
      lowTick = tick + 1
    } else {
      highTick = tick
      highPlacement = placement
    }
  }
  return { tick: lowTick, placement: highPlacement }
}

export function solveStadiumRectangleLayout(
  input: StadiumRectangleLayoutInput,
): StadiumPlayerLayoutResult {
  if (!hasValidInput(input)) return unavailable('invalid-input')

  const centerlineWidth = input.maxStageWidth - input.playerRectangleSize
  const maximumStraightLength = input.maxStageHeight - input.playerRectangleSize - centerlineWidth
  if (centerlineWidth < 0 || maximumStraightLength < 0) return unavailable('no-fitting-layout')

  const circle = solveAtStraightLength(input, centerlineWidth, 0, 'circle')
  if (circle !== null) return circle.ready

  const maximumTick = Math.floor((maximumStraightLength + VALIDATION_TOLERANCE) / PUBLIC_UNIT)
  const lowerBound = firstInternallyFeasibleTick(input, centerlineWidth, maximumTick)
  if (lowerBound === null) return unavailable('no-fitting-layout')

  for (let tick = lowerBound.tick; tick <= maximumTick; tick += 1) {
    const candidate = solveAtStraightLength(
      input,
      centerlineWidth,
      tick * PUBLIC_UNIT,
      'stadium',
      tick === lowerBound.tick ? lowerBound.placement : undefined,
    )
    if (candidate !== null) return candidate.ready
  }
  return unavailable('no-fitting-layout')
}
