import type { AnimationEvent, ReactNode } from 'react'
import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { RoleCard } from './RoleCard'
import type {
  RoomActionsByKind,
  RoomIdentityClue,
  RoomIdentityRecognitionScene as RoomIdentityRecognitionSceneData,
} from './room-screen-props'
import './RoomIdentityRecognition.css'

type RoomPhaseContent = Readonly<{
  title: string
  middle: ReactNode
  action: ReactNode
}>

export interface RoomIdentityRecognitionSurfaceProps {
  actions: RoomActionsByKind['identityRecognition']
  scene: RoomIdentityRecognitionSceneData
}

const CLUE_COPY = {
  evilAllies: {
    title: '暗影中的同伴',
    description: '这些玩家与你同属邪恶阵营。',
  },
  merlinEvil: {
    title: '奥术视野',
    description: '这些玩家显露出了邪恶气息。',
  },
  percivalCandidates: {
    title: '双重幻象',
    description: '其中一位是梅林，另一位是莫甘娜。',
  },
  none: {
    title: '没有额外线索',
    description: '通过其他玩家的发言和投票判断阵营。',
  },
} as const

function clueSummary(clue: RoomIdentityClue) {
  const count = clue.targetPlayerIDs.length
  if (clue.kind === 'evilAllies') return `你辨认出了 ${count} 名同伴`
  if (clue.kind === 'merlinEvil') return `你辨认出了 ${count} 名邪恶玩家`
  if (clue.kind === 'percivalCandidates') return `你辨认出了 ${count} 名候选人`
  return '你没有需要辨认的玩家'
}

function confirmationLabel(clue: RoomIdentityClue) {
  return clue.kind === 'none' ? '我已了解' : '我已辨认'
}

function CenterMessage({ description, title, kind }: { description: string; title: string; kind: string }) {
  return (
    <RoomCenter data-identity-recognition-center={kind} density="compact" role="status">
      <strong className="block text-base font-semibold text-amber-100">{title}</strong>
      <span className="mt-1 block text-xs leading-5 text-slate-300">{description}</span>
    </RoomCenter>
  )
}

function WaitingProgress({ scene, label }: {
  scene: RoomIdentityRecognitionSceneData
  label: string
}) {
  return (
    <RoomCenter data-identity-recognition-center="waiting" density="compact" role="status">
      <strong className="block text-2xl font-semibold text-amber-100">
        {scene.confirmedCount} / {scene.participantCount}
      </strong>
      <span className="mt-1 block text-sm text-slate-200">{label}</span>
      <span className="mt-1 block text-xs text-slate-400">等待其他玩家</span>
    </RoomCenter>
  )
}

function assertNeverPresentation(value: never): never {
  throw new Error(`Unhandled identity-recognition presentation: ${String(value)}`)
}

export function RoomIdentityRecognitionCenterSurface({
  scene,
}: Pick<RoomIdentityRecognitionSurfaceProps, 'scene'>) {
  const presentation = scene.presentation
  switch (presentation.kind) {
    case 'observer':
      return <WaitingProgress label="玩家正在完成辨认" scene={scene} />
    case 'roleReveal':
      return <WaitingProgress label="玩家已确认身份" scene={scene} />
    case 'clue': {
      if (presentation.view === 'concealed' || presentation.view === 'revealing') {
        return <CenterMessage description="准备查看你的线索" title="夜幕降临" kind="concealed" />
      }
      if (presentation.view === 'waiting') {
        return <WaitingProgress label="玩家已完成辨认" scene={scene} />
      }
      const copy = CLUE_COPY[presentation.clue.kind]
      return <CenterMessage description={copy.description} title={copy.title} kind={presentation.clue.kind} />
    }
    default:
      return assertNeverPresentation(presentation)
  }
}

export function RoomIdentityRecognitionPhaseContentSurface({
  actions,
  scene,
}: RoomIdentityRecognitionSurfaceProps): RoomPhaseContent {
  const presentation = scene.presentation
  switch (presentation.kind) {
    case 'observer':
      return {
        title: '等待其他玩家',
        middle: <p className="text-sm text-slate-300">等待参与玩家完成辨认</p>,
        action: null,
      }
    case 'roleReveal':
      if (presentation.view === 'waiting') {
        return {
          title: '等待其他玩家',
          middle: <p className="text-sm text-slate-300">你的身份已确认，等待其他玩家</p>,
          action: null,
        }
      }
      return {
        title: '确认你的身份',
        middle: <p className="text-sm text-slate-300">记住角色能力与本局目标</p>,
        action: (
          <RoomActionButton onClick={actions.onConfirm} requestState={presentation.confirmRequestState}>
            我已确认身份
          </RoomActionButton>
        ),
      }
    case 'clue':
      if (presentation.view === 'waiting') {
        return {
          title: '等待其他玩家',
          middle: <p className="text-sm text-slate-300">你的线索已确认</p>,
          action: null,
        }
      }
      if (presentation.view === 'revealed') {
        return {
          title: '辨认你的线索',
          middle: <p className="text-sm text-slate-300">{clueSummary(presentation.clue)}</p>,
          action: (
            <RoomActionButton onClick={actions.onConfirm} requestState={presentation.confirmRequestState}>
              {confirmationLabel(presentation.clue)}
            </RoomActionButton>
          ),
        }
      }
      return {
        title: '辨认你的线索',
        middle: <p className="text-sm text-slate-300">请确保其他玩家无法看到你的屏幕</p>,
        action: (
          <RoomActionButton disabled={presentation.view === 'revealing'} onClick={actions.onReveal}>
            查看线索
          </RoomActionButton>
        ),
      }
    default:
      return assertNeverPresentation(presentation)
  }
}

function CurtainDecoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(56,45,24,0.3),_transparent_34%),linear-gradient(180deg,_#0b1728,_#030812)]">
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-black/55 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-[18%] bg-gradient-to-l from-black/55 to-transparent" />
    </div>
  )
}

export function RoomIdentityRecognitionStageSurface({
  actions,
  scene,
}: RoomIdentityRecognitionSurfaceProps) {
  const presentation = scene.presentation
  if (presentation.kind === 'observer') {
    return (
      <section
        aria-label="身份辨认幕布"
        className="identity-curtain identity-curtain--closed absolute inset-0 z-[30] grid place-items-center overflow-hidden px-5 text-center"
        data-curtain-state="closed"
        data-identity-step="waiting"
      >
        <CurtainDecoration />
        <h2 className="relative z-10 font-serif text-2xl font-semibold text-amber-50">等待身份辨认</h2>
      </section>
    )
  }
  if (presentation.kind === 'roleReveal') {
    return (
      <section
        aria-label="身份辨认"
        className="pointer-events-none absolute inset-0 z-[30] overflow-hidden"
        data-curtain-state="lowered"
        data-identity-step="roleReveal"
        data-table-visibility="hidden"
      >
        <div aria-hidden="true" className="identity-curtain identity-curtain--lowering absolute inset-0">
          <CurtainDecoration />
        </div>
        <div className="identity-role-reveal-content relative z-10 flex h-full flex-col items-center justify-center gap-4 p-3">
          <h2 className="font-serif text-xl font-semibold text-amber-50">查看你的身份</h2>
          <RoleCard role={presentation.role} />
        </div>
      </section>
    )
  }
  if (presentation.view === 'waiting') return null

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (presentation.view === 'revealing') actions.onRevealComplete()
  }

  return (
    <div
      aria-hidden="true"
      className="identity-recognition-atmosphere pointer-events-none absolute inset-0 z-[30] overflow-hidden"
      data-identity-recognition-atmosphere={presentation.view}
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="identity-recognition-wave absolute left-1/2 top-1/2 rounded-full" />
    </div>
  )
}
