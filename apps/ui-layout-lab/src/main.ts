import '@avalon/ui-layout/room-shell.css'
import './styles.css'

import {
  ROOM_SHELL_CLASSES,
  resolveRoomShellMetrics,
  type RoomShellMode,
} from '@avalon/ui-layout'
import {
  solveRoundTableStageLayoutWithDiagnostics,
  type DetailedRoundTableStageLayoutResult,
} from '@avalon/ui-layout/diagnostics'

import { createSettingsDialog } from './app/settings-dialog'
import {
  renderRoomShell,
  renderRoundTableStage,
} from './app/render-layout'
import {
  applyPreviewRoomShell,
} from './app/preview-room-shell'
import {
  parseLabState,
  replaceLabStateInUrl,
  type LabState,
} from './app/url-state'
import { createViewportAdapter, type ViewportSize } from './app/viewport-adapter'

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <div class="lab-shell" data-viewport-mode="simulated">
    <div class="preview-workbench">
      <div class="preview-frame">
        <div class="${ROOM_SHELL_CLASSES.root}" aria-label="Avalon 房间布局预览"></div>
      </div>
    </div>
  </div>`

const shell = app.querySelector<HTMLElement>('.lab-shell')!
const workbench = app.querySelector<HTMLElement>('.preview-workbench')!
const previewFrame = app.querySelector<HTMLElement>('.preview-frame')!
const canvas = app.querySelector<HTMLElement>(`.${ROOM_SHELL_CLASSES.root}`)!
const roomShell = renderRoomShell(canvas)
const readout = roomShell.stageInfoReadout
const roomShellModeLabel: Record<RoomShellMode, string> = {
  vertical: '竖版',
  'compact-landscape': '紧凑横版',
  'normal-landscape': '普通横版',
}
let state: LabState = parseLabState(window.location.search)
let measuredDeviceSize: ViewportSize = {
  width: Math.round(window.innerWidth),
  height: Math.round(window.innerHeight),
}
let measuredStageSize = { width: 0, height: 0 }
let cachedStageLayout: Readonly<{
  key: string
  result: DetailedRoundTableStageLayoutResult
}> | null = null

function effectiveSize(): ViewportSize {
  return state.viewportMode === 'device'
    ? measuredDeviceSize
    : { width: state.simulatedWidth, height: state.simulatedHeight }
}

function updatePreviewScale(size: ViewportSize): void {
  if (state.viewportMode === 'device') {
    previewFrame.style.removeProperty('width')
    previewFrame.style.removeProperty('height')
    canvas.style.removeProperty('width')
    canvas.style.removeProperty('height')
    canvas.style.removeProperty('--preview-scale')
    return
  }
  const scale = Math.min(
    1,
    Math.max(0.2, (workbench.clientWidth - 32) / size.width),
    Math.max(0.2, (workbench.clientHeight - 32) / size.height),
  )
  canvas.style.width = `${size.width}px`
  canvas.style.height = `${size.height}px`
  canvas.style.setProperty('--preview-scale', String(scale))
  previewFrame.style.width = `${Math.round(size.width * scale)}px`
  previewFrame.style.height = `${Math.round(size.height * scale)}px`
}

function render(): void {
  const size = effectiveSize()
  shell.dataset.viewportMode = state.viewportMode
  canvas.dataset.viewportMode = state.viewportMode
  canvas.dataset.canvasWidth = String(size.width)
  canvas.dataset.canvasHeight = String(size.height)
  updatePreviewScale(size)
  const previewRoomShell = resolveRoomShellMetrics(size)
  applyPreviewRoomShell(canvas, previewRoomShell)
  renderStage(previewRoomShell.mode)
}

function renderStage(mode: RoomShellMode = canvas.dataset.roomLayoutMode as RoomShellMode): void {
  const stageSize = {
    width: roomShell.stage.clientWidth,
    height: roomShell.stage.clientHeight,
  }
  if (stageSize.width <= 0 || stageSize.height <= 0) return
  const stageSizeChanged = stageSize.width !== measuredStageSize.width
    || stageSize.height !== measuredStageSize.height
  measuredStageSize = stageSize
  canvas.dataset.stageWidth = String(stageSize.width)
  canvas.dataset.stageHeight = String(stageSize.height)
  const solverInput = {
    maxStageWidth: stageSize.width,
    maxStageHeight: stageSize.height,
    playerCount: state.playerCount,
    gap: state.gap,
    maxAvatarSize: state.maxAvatarSize,
    avatarSizeStep: state.avatarSizeStep,
  }
  const solverInputKey = [
    solverInput.maxStageWidth,
    solverInput.maxStageHeight,
    solverInput.playerCount,
    solverInput.gap,
    solverInput.maxAvatarSize,
    solverInput.avatarSizeStep,
  ].join(':')
  const result = !stageSizeChanged && cachedStageLayout?.key === solverInputKey
    ? cachedStageLayout.result
    : solveRoundTableStageLayoutWithDiagnostics(solverInput)
  cachedStageLayout = { key: solverInputKey, result }
  renderRoundTableStage(canvas, roomShell.stage, result, state.showGeometry)
  const size = effectiveSize()
  const contextSummary = `${size.width} × ${size.height} · 业务：${roomShellModeLabel[mode]} · 舞台：${stageSize.width} × ${stageSize.height}`
  readout.value = result.status === 'ready'
    ? `${contextSummary} · 数学：${state.playerCount} 人 · 头像 ${result.playerSeats[0]?.avatarRect.width ?? 0}px · ${result.shape === 'stadium' ? `跑道 · 直线 ${result.diagnostics.placementGuide.stadiumStraightLength}px` : '圆形'}`
    : `${contextSummary} · 数学：${result.reason}`
}

const settings = createSettingsDialog(app, state, {
  onChange: (patch) => {
    state = { ...state, ...patch }
    replaceLabStateInUrl(state)
    settings.update(state)
    render()
  },
  onRotate: () => {
    state = {
      ...state,
      simulatedWidth: state.simulatedHeight,
      simulatedHeight: state.simulatedWidth,
    }
    replaceLabStateInUrl(state)
    settings.update(state)
    render()
  },
})

roomShell.stageInfoButton.addEventListener('click', () => {
  const expanded = roomShell.stageInfoButton.getAttribute('aria-expanded') !== 'true'
  roomShell.stageInfoButton.setAttribute('aria-expanded', String(expanded))
  roomShell.stageInfoButton.setAttribute(
    'aria-label',
    expanded ? '隐藏布局信息' : '显示布局信息',
  )
  readout.hidden = !expanded
})

const viewportAdapter = createViewportAdapter(canvas, (size) => {
  if (state.viewportMode !== 'device') return
  if (size.width === measuredDeviceSize.width && size.height === measuredDeviceSize.height) return
  measuredDeviceSize = size
  render()
})

let stageAnimationFrame = 0
const stageObserver = new ResizeObserver(() => {
  cancelAnimationFrame(stageAnimationFrame)
  stageAnimationFrame = requestAnimationFrame(() => {
    renderStage()
  })
})
stageObserver.observe(roomShell.stage)

window.addEventListener('resize', render)
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(stageAnimationFrame)
  stageObserver.disconnect()
  viewportAdapter.dispose()
}, { once: true })
render()
