import { CircleHelp, Ellipsis, Eye, Ruler, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { QuestProgressTrack } from './QuestProgressTrack'
import { RoomBackButton } from './RoomBackButton'
import { RoomLayout } from './RoomLayout'
import './RoomLayoutPreview.css'
import { RoomNumber } from './RoomNumber'
import { RoomPhaseLabel } from './RoomPhaseLabel'
import { RoomToolbar, type RoomToolbarItem } from './RoomToolbar'
import type { QuestProgressNodeModel } from './room-screen-model'
import { useElementSize, type ElementSize } from './useElementSize'

const previewQuestNodes: readonly QuestProgressNodeModel[] = [
  { questIndex: 0, teamSize: 2, failThreshold: 1, state: 'success' },
  { questIndex: 1, teamSize: 3, failThreshold: 1, state: 'current' },
  { questIndex: 2, teamSize: 2, failThreshold: 1, state: 'upcoming' },
  { questIndex: 3, teamSize: 3, failThreshold: 2, state: 'upcoming' },
  { questIndex: 4, teamSize: 3, failThreshold: 1, state: 'upcoming' },
]

function formatSize({ height, width }: ElementSize) {
  return `${Math.round(width)} × ${Math.round(height)} px`
}

function PreviewRegion({ label, tone }: { label: string; tone: 'phase' | 'stage' }) {
  return <div className={`room-layout-preview__region room-layout-preview__region--${tone}`}>{label}</div>
}

export function RoomLayoutPreview() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lastTool, setLastTool] = useState('')
  const diagnosticsOpen = searchParams.get('layoutDebug') === 'metrics'
  const layout = useElementSize<HTMLElement>()
  const topBar = useElementSize<HTMLDivElement>()
  const stage = useElementSize<HTMLDivElement>()
  const phasePanel = useElementSize<HTMLDivElement>()

  const tools: readonly RoomToolbarItem[] = [
    { id: 'identity', icon: Eye, label: '身份信息', onActivate: () => setLastTool('身份信息') },
    { id: 'help', icon: CircleHelp, label: '帮助', onActivate: () => setLastTool('帮助') },
    { id: 'log', icon: ScrollText, label: '对局记录', onActivate: () => setLastTool('对局记录') },
    { id: 'room', icon: Ellipsis, label: '更多操作', onActivate: () => setLastTool('更多操作') },
  ]

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
        chrome={{
          back: <RoomBackButton onBack={() => navigate('/')} />,
          phase: <RoomPhaseLabel phase="组建任务队伍" />,
          questProgress: <QuestProgressTrack nodes={previewQuestNodes} />,
          roomNumber: <RoomNumber matchID="7A3C9EF" />,
          toolbar: <><RoomToolbar items={tools} /><span aria-live="polite" className="sr-only">{lastTool === '' ? '' : `已触发${lastTool}`}</span></>,
        }}
        layoutRef={layout.ref}
        phasePanel={<PreviewRegion label="阶段操作区" tone="phase" />}
        phasePanelRef={phasePanel.ref}
        stage={<><PreviewRegion label="圆桌舞台" tone="stage" />{diagnostics}</>}
        stageRef={stage.ref}
        topBarRef={topBar.ref}
      />
    </div>
  )
}
