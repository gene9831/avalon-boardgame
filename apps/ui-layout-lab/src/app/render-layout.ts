import type { Rect } from '../layout'
import type { DetailedRoundTableStageLayoutResult } from '../layout/types'
import { closestRectangleBoundarySegment } from '../stadium-model/geometry'

const PLAYER_NAMES = ['你', '青岚', '松石', '山雀', '长夜', '银杏', '渡鸦', '晨星', '白榆', '雾岛']

export type RoomShellElements = Readonly<{
  stage: HTMLElement
  stageInfoButton: HTMLButtonElement
  stageInfoReadout: HTMLOutputElement
}>

function rectStyles(rectangle: Rect): string {
  return `left:${rectangle.x}px;top:${rectangle.y}px;width:${rectangle.width}px;height:${rectangle.height}px`
}

function renderBoundaryGapLine(firstBounds: Rect, secondBounds: Rect, gap: number): string {
  const segment = closestRectangleBoundarySegment(firstBounds, secondBounds)
  const angle = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x) * 180 / Math.PI
  return `<span class="gap-line" style="left:${segment.start.x}px;top:${segment.start.y}px;width:${segment.distance}px;height:1px;transform:rotate(${angle}deg);transform-origin:left center" title="座位间距 ${gap}px"></span>`
}

export function renderRoomShell(canvas: HTMLElement): RoomShellElements {
  const taskTrack = [1, 2, 3, 4, 5].map((taskNumber) => `
    <span class="task-node${taskNumber === 3 ? ' is-current' : ''}">
      <b>${taskNumber}</b><small>${taskNumber === 4 ? '3·2' : taskNumber + 1}</small>
    </span>`).join('')
  canvas.innerHTML = `
    <header class="room-topbar">
      <button class="back-button" aria-label="返回">‹</button>
      <button class="room-code" aria-label="复制房间号"><span>房间</span><b>7A3C9EF</b><i></i></button>
      <div class="task-track" aria-label="任务进度">${taskTrack}</div>
    </header>
    <main class="round-table-stage-region">
      <div class="stage-info">
        <button
          class="stage-info-trigger"
          type="button"
          aria-label="显示布局信息"
          aria-controls="layout-readout"
          aria-expanded="false"
        >
          <svg
            class="lucide lucide-info"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
        </button>
        <output id="layout-readout" class="layout-readout" aria-live="polite" hidden></output>
      </div>
      <div class="round-table-stage"></div>
    </main>
    <footer class="phase-panel">
      <div class="phase-content">
        <div class="phase-header"><div class="phase-title"><small>领袖行动</small><strong>选择任务队员</strong></div>
          <nav aria-label="房间工具"><button>身份</button><button>记录</button><button>帮助</button></nav>
        </div>
        <div class="phase-middle"><button class="selected">青岚</button><button>松石</button></div>
        <div class="phase-action"><button>确认队伍 · 2/4</button></div>
      </div>
      <div class="phase-bottom-clearance" aria-hidden="true"></div>
    </footer>`
  const stage = canvas.querySelector<HTMLElement>('.round-table-stage')
  if (stage === null) throw new Error('Round-table stage was not rendered')
  const stageInfoButton = canvas.querySelector<HTMLButtonElement>('.stage-info-trigger')
  if (stageInfoButton === null) throw new Error('Stage info button was not rendered')
  const stageInfoReadout = canvas.querySelector<HTMLOutputElement>('.layout-readout')
  if (stageInfoReadout === null) throw new Error('Stage info readout was not rendered')
  return { stage, stageInfoButton, stageInfoReadout }
}

export function renderRoundTableStage(
  canvas: HTMLElement,
  stage: HTMLElement,
  result: DetailedRoundTableStageLayoutResult,
  showGeometry: boolean,
): void {
  canvas.dataset.layoutStatus = result.status
  canvas.toggleAttribute('data-show-geometry', showGeometry)

  if (result.status === 'unavailable') {
    delete canvas.dataset.tableShape
    delete canvas.dataset.avatarSize
    delete canvas.dataset.stadiumStraightLength
    stage.innerHTML = `
      <section class="layout-unavailable" aria-live="polite">
        <p class="text-xs uppercase tracking-[0.28em] text-amber-300/70">Layout unavailable</p>
        <strong>${result.reason}</strong>
        <span>当前舞台空间暂时无法生成圆桌布局，房间工具仍可继续使用。</span>
      </section>`
    return
  }

  canvas.dataset.tableShape = result.shape
  canvas.dataset.avatarSize = String(result.playerSeats[0]?.avatarRect.width ?? 0)
  canvas.dataset.stadiumStraightLength = String(
    result.diagnostics.placementGuide.stadiumStraightLength,
  )
  const seats = result.playerSeats.map((seat, seatIndex) => {
    const crownFontSize = Math.max(13, Math.round(seat.avatarRect.width * 0.3))
    const statusSize = Math.max(10, Math.round(seat.avatarRect.width * 0.24))
    return `
      <div class="player-seat" data-seat-index="${seat.relativeSeatIndex}"
        style="${rectStyles(seat.playerSeatBounds)}">
        <span class="seat-index">${seat.relativeSeatIndex.toString().padStart(2, '0')}</span>
      </div>
      <div class="avatar-wrap${seatIndex === 0 ? ' is-current' : ''}" style="${rectStyles(seat.avatarRect)}">
        ${seatIndex === 5 ? `<span class="crown" aria-hidden="true" style="font-size:${crownFontSize}px">♛</span>` : ''}
        <span class="avatar">${seatIndex === 0 ? '我' : PLAYER_NAMES[seatIndex].slice(0, 1)}</span>
        <span class="status-marker" aria-label="已在线" style="width:${statusSize}px;height:${statusSize}px"></span>
      </div>
      <span class="player-name" style="${rectStyles(seat.nameRect)}">${PLAYER_NAMES[seatIndex]}</span>`
  }).join('')
  const gapLines = result.playerSeats.map((seat, seatIndex) => {
    const otherSeatIndex = (seatIndex + 1) % result.playerSeats.length
    return renderBoundaryGapLine(
      seat.playerSeatBounds,
      result.playerSeats[otherSeatIndex].playerSeatBounds,
      result.diagnostics.adjacentBoundaryGaps[seatIndex],
    )
  }).join('')

  stage.innerHTML = `
    <div class="round-table-frame" style="${rectStyles(result.diagnostics.roundTableFrame)}"></div>
    <div class="round-table-footprint" style="${rectStyles(result.diagnostics.roundTableFootprint)}"></div>
    <div class="placement-guide ${result.shape}" style="${rectStyles(result.diagnostics.placementGuide.bounds)}"></div>
    <div class="tabletop ${result.shape}" style="${rectStyles(result.tabletop)}"></div>
    <div class="center-panel-protection" style="left:${result.centerPanel.x - 12}px;top:${result.centerPanel.y - 12}px;width:${result.centerPanel.width + 24}px;height:${result.centerPanel.height + 24}px"></div>
    <div class="center-panel" style="${rectStyles(result.centerPanel)}">
      <small>第 3 轮</small><strong>等待领袖组队</strong><span>需要 4 名队员</span>
    </div>
    ${gapLines}
    ${seats}`
}
