import './styles.css'

import { createSettingsDialog } from './app/settings-dialog'
import {
  renderRoomShell,
  renderRoundTableStage,
} from './app/render-layout'
import {
  applyPreviewRoomShell,
  resolvePreviewRoomShell,
} from './app/preview-room-shell'
import {
  parseLabState,
  replaceLabStateInUrl,
  type LabState,
} from './app/url-state'
import { createViewportAdapter, type ViewportSize } from './app/viewport-adapter'
import { solveRoundTableStageLayoutWithDiagnostics } from './layout/solve-round-table-stage-layout'

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <div class="lab-shell" data-viewport-mode="simulated">
    <div class="preview-workbench">
      <div class="preview-frame">
        <div class="room-canvas" aria-label="Avalon 房间布局预览"></div>
      </div>
    </div>
  </div>`

const shell = app.querySelector<HTMLElement>('.lab-shell')!
const workbench = app.querySelector<HTMLElement>('.preview-workbench')!
const previewFrame = app.querySelector<HTMLElement>('.preview-frame')!
const canvas = app.querySelector<HTMLElement>('.room-canvas')!
const roomShell = renderRoomShell(canvas)
const readout = roomShell.stageInfoReadout
let state: LabState = parseLabState(window.location.search)
let measuredDeviceSize: ViewportSize = {
  width: Math.round(window.innerWidth),
  height: Math.round(window.innerHeight),
}

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
  applyPreviewRoomShell(canvas, resolvePreviewRoomShell(size))
  renderStage()
}

function renderStage(): void {
  const stageSize = {
    width: roomShell.stage.clientWidth,
    height: roomShell.stage.clientHeight,
  }
  if (stageSize.width <= 0 || stageSize.height <= 0) return
  canvas.dataset.stageWidth = String(stageSize.width)
  canvas.dataset.stageHeight = String(stageSize.height)
  const result = solveRoundTableStageLayoutWithDiagnostics({
    maxStageWidth: stageSize.width,
    maxStageHeight: stageSize.height,
    playerCount: state.playerCount,
    gap: state.gap,
    maxAvatarSize: state.maxAvatarSize,
    avatarSizeStep: state.avatarSizeStep,
  })
  renderRoundTableStage(canvas, roomShell.stage, result, state.showGeometry)
  const size = effectiveSize()
  const sizeSummary = `${size.width} × ${size.height} · 舞台 ${stageSize.width} × ${stageSize.height}`
  readout.value = result.status === 'ready'
    ? `${sizeSummary} · ${state.playerCount} 人 · 头像 ${result.playerSeats[0]?.avatarRect.width ?? 0}px · ${result.shape === 'stadium' ? `跑道 · 直线 ${result.diagnostics.placementGuide.stadiumStraightLength}px` : '圆形'}`
    : `${sizeSummary} · ${result.reason}`
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
let measuredStageSize = { width: 0, height: 0 }
const stageObserver = new ResizeObserver(() => {
  cancelAnimationFrame(stageAnimationFrame)
  stageAnimationFrame = requestAnimationFrame(() => {
    const nextStageSize = {
      width: roomShell.stage.clientWidth,
      height: roomShell.stage.clientHeight,
    }
    if (
      nextStageSize.width === measuredStageSize.width
      && nextStageSize.height === measuredStageSize.height
    ) return
    measuredStageSize = nextStageSize
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
