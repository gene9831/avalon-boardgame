import { CircleHelp, Eye, Ruler } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { QuestProgressTrack } from './QuestProgressTrack'
import { RoomBackButton } from './RoomBackButton'
import { RoomLayout } from './RoomLayout'
import './RoomLayoutPreview.css'
import { RoomNumber } from './RoomNumber'
import { RoomMoreMenu } from './RoomMoreMenu'
import { RoomPhaseLabel } from './RoomPhaseLabel'
import { RoomToolbar, type RoomToolbarItem } from './RoomToolbar'
import type { QuestProgressNode } from './room-presentation'
import { useElementSize, type ElementSize } from './useElementSize'

const previewQuestNodes: readonly QuestProgressNode[] = [
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

const PREVIEW_GROUPS = [
  {
    title: '进入房间',
    links: [
      { label: '加载房间', to: '/dev/room-layout/loading' },
    ],
  },
  {
    title: '基础布局',
    links: [
      { label: '布局骨架与响应式区域', to: '/dev/room-layout/base' },
    ],
  },
  {
    title: '等待大厅',
    links: [
      { label: '玩家 · 未满员', to: '/dev/room-layout/lobby/member-incomplete' },
      { label: '房主 · 未满员', to: '/dev/room-layout/lobby/owner-incomplete' },
      { label: '玩家 · 已满员', to: '/dev/room-layout/lobby/member-full' },
      { label: '房主 · 已满员', to: '/dev/room-layout/lobby/owner-full' },
      { label: '当前玩家掉线', to: '/dev/room-layout/lobby/current-player-disconnected' },
    ],
  },
  {
    title: '首次身份确认',
    links: [
      { label: '角色牌未揭示', to: '/dev/room-layout/identity-confirmation/concealed' },
      { label: '身份已揭示', to: '/dev/room-layout/identity-confirmation/revealed' },
      { label: '正在确认', to: '/dev/room-layout/identity-confirmation/confirming' },
      { label: '等待其他玩家', to: '/dev/room-layout/identity-confirmation/waiting' },
    ],
  },
  {
    title: '身份辨认',
    links: [
      { label: '邪恶阵营视角', to: '/dev/room-layout/identity-recognition/evil-allies' },
      { label: '梅林视角', to: '/dev/room-layout/identity-recognition/merlin-evil' },
      { label: '帕西维尔视角', to: '/dev/room-layout/identity-recognition/percival-candidates' },
      { label: '无额外线索视角', to: '/dev/room-layout/identity-recognition/none' },
    ],
  },
  {
    title: '组建任务队伍',
    links: [
      { label: '队长组队', to: '/dev/room-layout/team-proposal/leader' },
      { label: '其他玩家等待', to: '/dev/room-layout/team-proposal/member' },
    ],
  },
  {
    title: '表决任务队伍',
    links: [
      { label: '全员投票', to: '/dev/room-layout/team-vote/voter' },
    ],
  },
  {
    title: '执行任务',
    links: [
      { label: '正义任务队员', to: '/dev/room-layout/quest/member-good' },
      { label: '邪恶任务队员', to: '/dev/room-layout/quest/member-evil' },
      { label: '非任务队员', to: '/dev/room-layout/quest/observer' },
    ],
  },
  {
    title: '刺杀梅林',
    links: [
      { label: '刺客选择目标', to: '/dev/room-layout/assassination/assassin' },
      { label: '邪恶同伴协助', to: '/dev/room-layout/assassination/evil' },
      { label: '正义玩家等待', to: '/dev/room-layout/assassination/good' },
    ],
  },
  {
    title: '对局结果',
    links: [
      { label: '正义 · 刺杀未命中', to: '/dev/room-layout/result/good-assassination' },
      { label: '邪恶 · 刺杀命中', to: '/dev/room-layout/result/evil-assassination' },
      { label: '邪恶 · 三次任务失败', to: '/dev/room-layout/result/evil-quests' },
      { label: '邪恶 · 连续否决五支队伍', to: '/dev/room-layout/result/evil-rejections' },
    ],
  },
] as const

export function RoomLayoutPreview() {
  return (
    <main className="room-lobby-preview-index">
      <h1>房间布局预览</h1>
      <p>集中检查基础布局和各业务阶段场景，不连接服务端。</p>
      {PREVIEW_GROUPS.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <ul>
            {group.links.map((link) => (
              <li key={link.to}><Link to={link.to}>{link.label}</Link></li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

export function RoomLayoutBasePreview() {
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
          back: <RoomBackButton onBack={() => navigate('/dev/room-layout')} />,
          phase: <RoomPhaseLabel phase="组建任务队伍" />,
          questProgress: <QuestProgressTrack nodes={previewQuestNodes} />,
          roomNumber: <RoomNumber matchID="7A3C9EF" />,
          toolbar: <><RoomToolbar items={tools}>
            <RoomMoreMenu
              connected
              entries={[]}
              isOwner={false}
              onRequestRoomExit={() => undefined}
              roomExitBlocked
              roomExitBusy={false}
              seatChangePending={false}
              showRoomExit={false}
            />
          </RoomToolbar><span aria-live="polite" className="sr-only">{lastTool === '' ? '' : `已触发${lastTool}`}</span></>,
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
