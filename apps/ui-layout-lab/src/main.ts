import './styles.css'

import { createSettingsDialog } from './app/settings-dialog'
import { renderRoomLayout } from './app/render-layout'
import {
  parseLabState,
  replaceLabStateInUrl,
  type LabState,
} from './app/url-state'
import { createViewportAdapter, type ViewportSize } from './app/viewport-adapter'
import { solveRoomLayout } from './layout'

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <div class="lab-shell" data-viewport-mode="simulated">
    <div class="preview-workbench">
      <div class="preview-frame">
        <div class="room-canvas" aria-label="Avalon 房间布局预览"></div>
      </div>
    </div>
    <output class="layout-readout" aria-live="polite"></output>
  </div>`

const shell = app.querySelector<HTMLElement>('.lab-shell')!
const workbench = app.querySelector<HTMLElement>('.preview-workbench')!
const previewFrame = app.querySelector<HTMLElement>('.preview-frame')!
const canvas = app.querySelector<HTMLElement>('.room-canvas')!
const readout = app.querySelector<HTMLOutputElement>('.layout-readout')!
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

  const result = solveRoomLayout({
    width: size.width,
    height: size.height,
    playerCount: state.playerCount,
  })
  renderRoomLayout(canvas, result, state.showGeometry)
  readout.value = result.status === 'ready'
    ? `${size.width} × ${size.height} · ${state.playerCount} 人 · ${result.roundTable.avatarDiameter}px ${result.roundTable.shape === 'stadium' ? `跑道 · 直线 ${result.roundTable.playerOrbit.stadiumStraightLength}px` : '圆形'}`
    : `${size.width} × ${size.height} · ${result.reason}`
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

const viewportAdapter = createViewportAdapter(canvas, (size) => {
  if (state.viewportMode !== 'device') return
  if (size.width === measuredDeviceSize.width && size.height === measuredDeviceSize.height) return
  measuredDeviceSize = size
  render()
})

window.addEventListener('resize', render)
window.addEventListener('pagehide', viewportAdapter.dispose, { once: true })
render()
