import './stadium-model.css'

import {
  closestCircleBoundarySegment,
  solveStadiumPlayerLayout,
  type StadiumPlayerLayoutInput,
  type StadiumPlayerLayoutResult,
  type StadiumRect as Rect,
} from '@avalon/ui-layout/diagnostics'

import { lucideIcon } from './app/lucide-icons'
import { MAX_STAGE_HEIGHT, MAX_STAGE_WIDTH } from './stage-dimensions'

type ValidState = StadiumPlayerLayoutInput & Readonly<{ showDiagnostics: boolean }>
type DraftState = Readonly<{
  maxStageWidth: string
  maxStageHeight: string
  playerCount: string
  avatarSize: string
  minimumGap: string
  centerProtectionRadius: string
  showDiagnostics: boolean
}>

const DEFAULT_STATE: ValidState = {
  maxStageWidth: 386,
  maxStageHeight: 482,
  playerCount: 5,
  avatarSize: 56,
  minimumGap: 4,
  centerProtectionRadius: 0,
  showDiagnostics: true,
}

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <main class="stadium-lab-shell">
    <div class="stadium-workbench">
      <div class="stadium-stage" aria-label="跑道玩家圆形布局画布"></div>
    </div>
    <button class="stadium-settings-trigger" type="button" aria-label="打开跑道布局设置" aria-expanded="false">设置</button>
  </main>`

const stage = app.querySelector<HTMLElement>('.stadium-stage')!
const trigger = app.querySelector<HTMLButtonElement>('.stadium-settings-trigger')!
const panel = document.createElement('section')
panel.className = 'stadium-settings-panel'
panel.setAttribute('role', 'dialog')
panel.setAttribute('aria-modal', 'false')
panel.setAttribute('aria-labelledby', 'stadium-settings-title')
panel.hidden = true
panel.innerHTML = `
  <form class="stadium-settings-form">
    <header><div><p>布局参数</p><h2 id="stadium-settings-title">跑道布局设置</h2></div>
      <button type="button" aria-label="关闭跑道布局设置">${lucideIcon('x')}</button></header>
    <p class="stadium-input-error" role="status" aria-live="polite"></p>
    <label>舞台宽度 <input name="maxStageWidth" type="number" min="0.01" max="${MAX_STAGE_WIDTH}" inputmode="decimal" /></label>
    <label>舞台高度 <input name="maxStageHeight" type="number" min="0.01" max="${MAX_STAGE_HEIGHT}" inputmode="decimal" /></label>
    <fieldset><legend>玩家人数</legend><div class="stadium-player-buttons"></div></fieldset>
    <label>头像大小 <input name="avatarSize" type="number" inputmode="decimal" /></label>
    <label>最小 gap <input name="minimumGap" type="number" inputmode="decimal" /></label>
    <label>桌心保护半径 <input name="centerProtectionRadius" type="number" min="0" inputmode="decimal" /></label>
    <label class="stadium-switch-row">显示诊断
      <input name="showDiagnostics" type="checkbox" role="switch" aria-label="显示诊断" />
    </label>
    <button class="stadium-reset" type="button">恢复默认值</button>
  </form>`
document.body.append(panel)

const error = panel.querySelector<HTMLElement>('.stadium-input-error')!
const closeButton = panel.querySelector<HTMLButtonElement>('[aria-label="关闭跑道布局设置"]')!
const diagnosticsInput = panel.querySelector<HTMLInputElement>('[name="showDiagnostics"]')!
const inputs = {
  maxStageWidth: panel.querySelector<HTMLInputElement>('[name="maxStageWidth"]')!,
  maxStageHeight: panel.querySelector<HTMLInputElement>('[name="maxStageHeight"]')!,
  playerCount: panel.querySelector<HTMLInputElement>('[name="playerCount"]'),
  avatarSize: panel.querySelector<HTMLInputElement>('[name="avatarSize"]')!,
  minimumGap: panel.querySelector<HTMLInputElement>('[name="minimumGap"]')!,
  centerProtectionRadius: panel.querySelector<HTMLInputElement>('[name="centerProtectionRadius"]')!,
}
const playerButtons = [5, 6, 7, 8, 9, 10].map((count) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = `${count} 人`
  button.dataset.playerCount = String(count)
  panel.querySelector<HTMLElement>('.stadium-player-buttons')!.append(button)
  return button
})

function validNumber(
  value: string,
  label: string,
  minimum: number,
  integer = false,
  maximum = Number.POSITIVE_INFINITY,
): number | string {
  const parsed = Number(value)
  if (
    value.trim() === ''
    || !Number.isFinite(parsed)
    || parsed < minimum
    || parsed > maximum
    || (integer && !Number.isInteger(parsed))
  ) {
    return `${label}必须是${integer
      ? '5 到 10 的整数'
      : minimum === 0
        ? '有限且不小于 0 的数'
        : `有限正数${Number.isFinite(maximum) ? `且不超过 ${maximum}` : ''}`}`
  }
  return parsed
}

function stateFromUrl(search: string): ValidState {
  const params = new URLSearchParams(search)
  const number = (
    key: string,
    fallback: number,
    min: number,
    integer = false,
    max = Number.POSITIVE_INFINITY,
  ) => {
    const value = params.get(key)
    if (value === null) return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed)
      && parsed >= min
      && parsed <= max
      && (!integer || Number.isInteger(parsed))
      ? parsed
      : fallback
  }
  const players = number('players', DEFAULT_STATE.playerCount, 5, true)
  return {
    maxStageWidth: number(
      'maxStageWidth',
      DEFAULT_STATE.maxStageWidth,
      Number.MIN_VALUE,
      false,
      MAX_STAGE_WIDTH,
    ),
    maxStageHeight: number(
      'maxStageHeight',
      DEFAULT_STATE.maxStageHeight,
      Number.MIN_VALUE,
      false,
      MAX_STAGE_HEIGHT,
    ),
    playerCount: players >= 5 && players <= 10 ? players : DEFAULT_STATE.playerCount,
    avatarSize: number('avatarSize', DEFAULT_STATE.avatarSize, Number.MIN_VALUE),
    minimumGap: number('minimumGap', DEFAULT_STATE.minimumGap, 0),
    centerProtectionRadius: number(
      'centerProtectionRadius',
      DEFAULT_STATE.centerProtectionRadius ?? 0,
      0,
    ),
    showDiagnostics: params.get('diagnostics') === '0' ? false : DEFAULT_STATE.showDiagnostics,
  }
}

function draftFromState(state: ValidState): DraftState {
  return {
    maxStageWidth: String(state.maxStageWidth), maxStageHeight: String(state.maxStageHeight),
    playerCount: String(state.playerCount), avatarSize: String(state.avatarSize),
    minimumGap: String(state.minimumGap),
    centerProtectionRadius: String(state.centerProtectionRadius ?? 0),
    showDiagnostics: state.showDiagnostics,
  }
}

function parseDraft(draft: DraftState): { status: 'valid'; state: ValidState } | { status: 'invalid'; message: string } {
  const width = validNumber(
    draft.maxStageWidth,
    '舞台宽度',
    Number.MIN_VALUE,
    false,
    MAX_STAGE_WIDTH,
  )
  if (typeof width === 'string') return { status: 'invalid', message: width }
  const height = validNumber(
    draft.maxStageHeight,
    '舞台高度',
    Number.MIN_VALUE,
    false,
    MAX_STAGE_HEIGHT,
  )
  if (typeof height === 'string') return { status: 'invalid', message: height }
  const players = validNumber(draft.playerCount, '玩家人数', 5, true)
  if (typeof players === 'string' || players > 10) return { status: 'invalid', message: '玩家人数必须是5 到 10 的整数' }
  const avatar = validNumber(draft.avatarSize, '头像大小', Number.MIN_VALUE)
  if (typeof avatar === 'string') return { status: 'invalid', message: avatar }
  const gap = validNumber(draft.minimumGap, '最小 gap', 0)
  if (typeof gap === 'string') return { status: 'invalid', message: gap }
  const protectionRadius = validNumber(draft.centerProtectionRadius, '桌心保护半径', 0)
  if (typeof protectionRadius === 'string') return { status: 'invalid', message: protectionRadius }
  return { status: 'valid', state: { maxStageWidth: width, maxStageHeight: height, playerCount: players, avatarSize: avatar, minimumGap: gap, centerProtectionRadius: protectionRadius, showDiagnostics: draft.showDiagnostics } }
}

function serialize(state: ValidState): string {
  const params = new URLSearchParams()
  params.set('maxStageWidth', String(state.maxStageWidth)); params.set('maxStageHeight', String(state.maxStageHeight))
  params.set('players', String(state.playerCount)); params.set('avatarSize', String(state.avatarSize))
  params.set('minimumGap', String(state.minimumGap)); params.set('centerProtectionRadius', String(state.centerProtectionRadius ?? 0))
  params.set('diagnostics', state.showDiagnostics ? '1' : '0')
  return `?${params.toString()}`
}

function rectAttributes(rect: Rect): string {
  return `x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"`
}

function centerlineMarkup(bounds: Rect): string {
  const radius = bounds.width / 2
  if (Math.abs(bounds.height - bounds.width) < 0.001) return `<circle class="centerline" cx="${bounds.x + radius}" cy="${bounds.y + radius}" r="${radius}" />`
  return `<rect class="centerline" ${rectAttributes(bounds)} rx="${radius}" ry="${radius}" />`
}

let observedSvg: SVGSVGElement | null = null
const textScaleObserver = new ResizeObserver(() => {
  if (!observedSvg) return
  const viewBox = observedSvg.viewBox.baseVal
  const bounds = observedSvg.getBoundingClientRect()
  const renderedScale = Math.min(bounds.width / viewBox.width, bounds.height / viewBox.height)
  const inverseScale = renderedScale > 0 ? Math.max(1, 1 / renderedScale) : 1
  stage.style.setProperty('--seat-font-size', `${16 * inverseScale}px`)
  stage.style.setProperty('--diagnostic-font-size', `${13 * inverseScale}px`)
  stage.style.setProperty('--svg-text-stroke-width', `${3 * inverseScale}px`)
})

function observeTextScale(): void {
  observedSvg = stage.querySelector<SVGSVGElement>('svg')
  textScaleObserver.disconnect()
  if (!observedSvg) return
  textScaleObserver.observe(observedSvg)
  const viewBox = observedSvg.viewBox.baseVal
  const bounds = observedSvg.getBoundingClientRect()
  const renderedScale = Math.min(bounds.width / viewBox.width, bounds.height / viewBox.height)
  const inverseScale = renderedScale > 0 ? Math.max(1, 1 / renderedScale) : 1
  stage.style.setProperty('--seat-font-size', `${16 * inverseScale}px`)
  stage.style.setProperty('--diagnostic-font-size', `${13 * inverseScale}px`)
  stage.style.setProperty('--svg-text-stroke-width', `${3 * inverseScale}px`)
}

function render(result: StadiumPlayerLayoutResult, state: ValidState): void {
  stage.dataset.layoutStatus = result.status
  stage.dataset.stageWidth = String(state.maxStageWidth)
  stage.dataset.stageHeight = String(state.maxStageHeight)
  stage.style.setProperty('--stage-aspect', `${state.maxStageWidth} / ${state.maxStageHeight}`)
  if (result.status !== 'ready') {
    stage.removeAttribute('data-shape'); stage.removeAttribute('data-straight-length')
    stage.innerHTML = `<div class="stadium-unavailable" role="status"><strong>no-fitting-layout</strong><span>该合法参数无法在舞台内放置所有玩家。</span></div>`
    textScaleObserver.disconnect()
    observedSvg = null
    return
  }
  stage.dataset.shape = result.shape
  stage.dataset.straightLength = String(result.stadiumStraightLength)
  const diagnostics = state.showDiagnostics ? result.playerCircles.map((circle, index) => {
    const segment = closestCircleBoundarySegment(circle, result.playerCircles[(index + 1) % result.playerCircles.length])
    return `<g class="gap-diagnostic"><line x1="${segment.start.x}" y1="${segment.start.y}" x2="${segment.end.x}" y2="${segment.end.y}" /><text x="${(segment.start.x + segment.end.x) / 2}" y="${(segment.start.y + segment.end.y) / 2}">${segment.distance.toFixed(2)}px</text></g>`
  }).join('') : ''
  const occupied = state.showDiagnostics ? `<rect class="occupied-bounds" ${rectAttributes(result.occupiedBounds)} />` : ''
  const protectionRadius = state.centerProtectionRadius ?? 0
  const protectionCenter = {
    x: result.centerlineBounds.x + result.centerlineBounds.width / 2,
    y: result.centerlineBounds.y + result.centerlineBounds.height / 2,
  }
  const protectionCircle = protectionRadius > 0
    ? `<circle class="center-protection-circle" cx="${protectionCenter.x}" cy="${protectionCenter.y}" r="${protectionRadius}" />`
    : ''
  const maximumProtectionCircle = state.showDiagnostics
    ? `<g class="maximum-center-protection-diagnostic"><circle class="maximum-center-protection-circle" cx="${protectionCenter.x}" cy="${protectionCenter.y}" r="${result.maximumCenterProtectionRadius}" /><line x1="${protectionCenter.x}" y1="${protectionCenter.y}" x2="${protectionCenter.x + result.maximumCenterProtectionRadius}" y2="${protectionCenter.y}" /><text x="${protectionCenter.x + result.maximumCenterProtectionRadius / 2}" y="${protectionCenter.y - 9}">r=${result.maximumCenterProtectionRadius.toFixed(2)}px</text></g>`
    : ''
  const protectionDiagnostics = state.showDiagnostics && protectionRadius > 0
    ? result.playerCircles.map((circle) => {
        const segment = closestCircleBoundarySegment(
          { center: protectionCenter, radius: protectionRadius },
          circle,
        )
        return `<g class="protection-diagnostic"><line x1="${segment.start.x}" y1="${segment.start.y}" x2="${segment.end.x}" y2="${segment.end.y}" /><text x="${(segment.start.x + segment.end.x) / 2}" y="${(segment.start.y + segment.end.y) / 2}">${segment.distance.toFixed(2)}px</text></g>`
      }).join('')
    : ''
  const players = result.playerCircles.map((circle, index) => {
    const { center } = circle
    return `<g class="player"><circle class="player-boundary-circle" cx="${center.x}" cy="${center.y}" r="${circle.radius}" /><circle class="avatar-circle" cx="${center.x}" cy="${center.y}" r="${state.avatarSize / 2}" /><text class="seat-index" x="${center.x}" y="${center.y}">${index}</text></g>`
  }).join('')
  stage.innerHTML = `<svg width="${state.maxStageWidth}" height="${state.maxStageHeight}" viewBox="0 0 ${state.maxStageWidth} ${state.maxStageHeight}" role="img" aria-label="跑道玩家圆形布局">
    <rect class="stage-boundary" x="0" y="0" width="${state.maxStageWidth}" height="${state.maxStageHeight}" />
    ${centerlineMarkup(result.centerlineBounds)}${occupied}${maximumProtectionCircle}${protectionCircle}${diagnostics}${protectionDiagnostics}${players}</svg>`
  observeTextScale()
}

function updateControls(): void {
  inputs.maxStageWidth.value = draftState.maxStageWidth; inputs.maxStageHeight.value = draftState.maxStageHeight
  inputs.avatarSize.value = draftState.avatarSize; inputs.minimumGap.value = draftState.minimumGap
  inputs.centerProtectionRadius.value = draftState.centerProtectionRadius
  diagnosticsInput.checked = draftState.showDiagnostics
  for (const button of playerButtons) button.setAttribute('aria-pressed', String(button.dataset.playerCount === draftState.playerCount))
}

function setError(message: string): void { error.textContent = message }
function applyDraft(next: DraftState): void {
  draftState = next; updateControls()
  const parsed = parseDraft(next)
  if (parsed.status === 'invalid') { setError(parsed.message); return }
  validState = parsed.state
  lastResult = solveStadiumPlayerLayout(validState)
  history.replaceState(null, '', serialize(validState))
  render(lastResult, validState); setError('')
}

function setPanel(open: boolean, restoreTriggerFocus = true): void {
  panel.hidden = !open; trigger.setAttribute('aria-expanded', String(open))
  trigger.setAttribute('aria-label', open ? '收起跑道布局设置' : '打开跑道布局设置')
  if (open) closeButton.focus()
  else if (restoreTriggerFocus) trigger.focus()
}

let validState = stateFromUrl(window.location.search)
let draftState = draftFromState(validState)
let lastResult = solveStadiumPlayerLayout(validState)
if (window.location.search !== serialize(validState)) history.replaceState(null, '', serialize(validState))
render(lastResult, validState); updateControls()

for (const [key, input] of Object.entries(inputs)) {
  if (!input || key === 'playerCount') continue
  input.addEventListener('input', () => applyDraft({ ...draftState, [key]: input.value }))
}
for (const button of playerButtons) button.addEventListener('click', () => applyDraft({ ...draftState, playerCount: button.dataset.playerCount! }))
diagnosticsInput.addEventListener('change', () => applyDraft({ ...draftState, showDiagnostics: diagnosticsInput.checked }))
panel.querySelector<HTMLButtonElement>('.stadium-reset')!.addEventListener('click', () => applyDraft(draftFromState(DEFAULT_STATE)))
trigger.addEventListener('click', () => setPanel(Boolean(panel.hidden)))
closeButton.addEventListener('click', () => setPanel(false))
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) setPanel(false) })
document.addEventListener('click', (event) => {
  if (panel.hidden || !(event.target instanceof Node)) return
  if (panel.contains(event.target) || trigger.contains(event.target)) return
  setPanel(false, false)
})
