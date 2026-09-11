import { Ruler } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { RoomLayout } from './RoomLayout'
import './RoomLayoutPreview.css'
import { useElementSize, type ElementSize } from './useElementSize'

function formatSize({ height, width }: ElementSize) {
  return `${Math.round(width)} × ${Math.round(height)} px`
}

function PreviewRegion({ label, tone }: { label: string; tone: 'phase' | 'stage' | 'topbar' }) {
  return <div className={`room-layout-preview__region room-layout-preview__region--${tone}`}>{label}</div>
}

export function RoomLayoutPreview() {
  const [searchParams, setSearchParams] = useSearchParams()
  const diagnosticsOpen = searchParams.get('layoutDebug') === 'metrics'
  const layout = useElementSize<HTMLElement>()
  const topBar = useElementSize<HTMLElement>()
  const stage = useElementSize<HTMLDivElement>()
  const phasePanel = useElementSize<HTMLElement>()

  const toggleDiagnostics = () => {
    const next = new URLSearchParams(searchParams)
    if (diagnosticsOpen) next.delete('layoutDebug')
    else next.set('layoutDebug', 'metrics')
    setSearchParams(next, { replace: true })
  }

  const diagnostics = (
    <div className="room-layout-preview__diagnostics">
      <button
        aria-label={diagnosticsOpen ? '关闭布局诊断' : '打开布局诊断'}
        aria-pressed={diagnosticsOpen}
        className="room-layout-preview__diagnostics-button"
        onClick={toggleDiagnostics}
        title={diagnosticsOpen ? '关闭布局诊断' : '打开布局诊断'}
        type="button"
      >
        <Ruler aria-hidden="true" size={20} strokeWidth={2} />
      </button>
      {diagnosticsOpen && (
        <aside aria-label="布局诊断信息" className="room-layout-preview__diagnostics-panel">
          <dl>
            <dt>形态</dt>
            <dd>
              <span className="room-layout-preview__mode room-layout-preview__mode--vertical">vertical</span>
              <span className="room-layout-preview__mode room-layout-preview__mode--compact-landscape">compact-landscape</span>
              <span className="room-layout-preview__mode room-layout-preview__mode--normal-landscape">normal-landscape</span>
            </dd>
            <dt>根内容盒</dt><dd>{formatSize(layout.size)}</dd>
            <dt>顶部栏</dt><dd>{formatSize(topBar.size)}</dd>
            <dt>舞台</dt><dd>{formatSize(stage.size)}</dd>
            <dt>操作区</dt><dd>{formatSize(phasePanel.size)}</dd>
          </dl>
        </aside>
      )}
    </div>
  )

  return (
    <div className="room-layout-preview">
      <RoomLayout
        layoutRef={layout.ref}
        phasePanel={<PreviewRegion label="阶段操作区" tone="phase" />}
        phasePanelRef={phasePanel.ref}
        stage={<PreviewRegion label="圆桌舞台" tone="stage" />}
        stageRef={stage.ref}
        topBar={<><PreviewRegion label="顶部栏" tone="topbar" />{diagnostics}</>}
        topBarRef={topBar.ref}
      />
    </div>
  )
}
