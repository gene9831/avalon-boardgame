import type { AnimationEvent, ReactNode } from 'react'

import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
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
} as const

function clueSummary(clue: RoomIdentityClue) {
  const count = clue.targetPlayerIDs.length
  if (clue.kind === 'evilAllies') return `你辨认出了 ${count} 名同伴`
  if (clue.kind === 'merlinEvil') return `你辨认出了 ${count} 名邪恶玩家`
  return `你辨认出了 ${count} 名候选人`
}

function CenterMessage({ description, title, kind }: {
  description: string
  title: string
  kind: string
}) {
  return (
    <RoomCenter data-identity-recognition-center={kind} density="compact" role="status">
      <strong className="block text-lg font-semibold text-amber-100">{title}</strong>
      <span className="mt-1 block text-sm leading-5 text-slate-300">
        {description.replace(/。+$/, '')}
      </span>
    </RoomCenter>
  )
}

export function RoomIdentityRecognitionCenterSurface({
  scene,
}: Pick<RoomIdentityRecognitionSurfaceProps, 'scene'>) {
  const presentation = scene.presentation
  if (presentation.kind === 'waiting') {
    const awaitingIdentityConfirmation = scene.stage === 'identityConfirmation'
    return (
      <RoomCenter data-identity-recognition-center="waiting" density="compact" role="status">
        <strong className="block text-lg font-semibold text-amber-100">
          {scene.completedCount} / {scene.participantCount}
        </strong>
        <span className="mt-1 block text-sm text-slate-200">
          {awaitingIdentityConfirmation ? '玩家已确认身份' : '玩家已完成线索辨认'}
        </span>
        <span className="mt-1 block text-sm text-slate-400">等待其他玩家</span>
      </RoomCenter>
    )
  }
  if (presentation.view === 'concealed' || presentation.view === 'revealing') {
    return (
      <CenterMessage
        description="准备查看你的线索"
        kind="concealed"
        title="夜幕降临"
      />
    )
  }
  const copy = CLUE_COPY[presentation.clue.kind]
  return (
    <CenterMessage
      description={copy.description}
      kind={presentation.clue.kind}
      title={copy.title}
    />
  )
}

export function RoomIdentityRecognitionPhaseContentSurface({
  actions,
  scene,
}: RoomIdentityRecognitionSurfaceProps): RoomPhaseContent {
  const presentation = scene.presentation
  if (presentation.kind === 'waiting') {
    const awaitingIdentityConfirmation = scene.stage === 'identityConfirmation'
    return {
      title: awaitingIdentityConfirmation
        ? '等待其他玩家确认身份'
        : '等待其他玩家完成线索辨认',
      middle: (
        <p className="text-sm text-slate-300">
          {awaitingIdentityConfirmation
            ? '你已确认，可以再次查看自己的身份'
            : '你已完成，可以查看身份与已知信息'}
        </p>
      ),
      action: null,
    }
  }
  if (presentation.view === 'revealed') {
    return {
      title: '辨认你的线索',
      middle: <p className="text-sm text-slate-300">{clueSummary(presentation.clue)}</p>,
      action: (
        <div className="grid grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] gap-2">
          <RoomActionButton onClick={actions.onHide} tone="secondary">
            暂时隐藏
          </RoomActionButton>
          <RoomActionButton
            onClick={actions.onConfirm}
            requestState={presentation.confirmRequestState}
          >
            我已辨认
          </RoomActionButton>
        </div>
      ),
    }
  }
  return {
    title: '辨认你的线索',
    middle: <p className="text-sm text-slate-300">请确保其他玩家无法看到你的屏幕</p>,
    action: (
      <RoomActionButton
        disabled={presentation.view === 'revealing'}
        onClick={actions.onReveal}
      >
        查看线索
      </RoomActionButton>
    ),
  }
}

export function RoomIdentityRecognitionStageSurface({
  actions,
  scene,
}: RoomIdentityRecognitionSurfaceProps) {
  const presentation = scene.presentation
  if (presentation.kind === 'waiting') return null

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
