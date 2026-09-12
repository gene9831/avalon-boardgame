import type { AnimationEvent } from 'react'
import type { PlayerID } from '@avalon/game'

import type { RoomPhasePanelSlots } from './RoomPhasePanelContent'
import './RoomIdentityRecognition.css'

export type RoomIdentityRecognitionScene =
  | Readonly<{ type: 'evil-allies'; targetPlayerIDs: readonly PlayerID[] }>
  | Readonly<{ type: 'merlin-evil'; targetPlayerIDs: readonly PlayerID[] }>
  | Readonly<{ type: 'percival-candidates'; targetPlayerIDs: readonly [PlayerID, PlayerID] }>
  | Readonly<{ type: 'none'; targetPlayerIDs: readonly [] }>

export type RoomIdentityRecognitionState =
  | 'concealed'
  | 'revealing'
  | 'revealed'
  | 'confirming'
  | 'waiting'

export interface RoomIdentityRecognitionPresentation {
  confirmedCount: number
  onConfirm(): void
  onReveal(): void
  onRevealComplete(): void
  participantCount: number
  scene: RoomIdentityRecognitionScene
  state: RoomIdentityRecognitionState
}

const SCENE_COPY = {
  'evil-allies': {
    title: '暗影中的同伴',
    description: '这些玩家与你同属邪恶阵营。',
  },
  'merlin-evil': {
    title: '奥术视野',
    description: '这些玩家显露出了邪恶气息。',
  },
  'percival-candidates': {
    title: '双重幻象',
    description: '其中一位是梅林，另一位是莫甘娜。',
  },
  none: {
    title: '没有额外线索',
    description: '通过其他玩家的发言和投票判断阵营。',
  },
} as const

const primaryClass = 'min-h-11 w-full whitespace-nowrap rounded-xl border border-amber-200/70 bg-amber-300/85 px-3 py-2 text-sm font-semibold text-slate-950 transition enabled:hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45'
const phaseTitle = (title: string) => <h2 className="truncate text-base font-semibold text-amber-100">{title}</h2>

function sceneSummary(scene: RoomIdentityRecognitionScene) {
  const count = scene.targetPlayerIDs.length
  if (scene.type === 'evil-allies') return `你辨认出了 ${count} 名同伴`
  if (scene.type === 'merlin-evil') return `你辨认出了 ${count} 名邪恶玩家`
  if (scene.type === 'percival-candidates') return `你辨认出了 ${count} 名候选人`
  return '你没有需要辨认的玩家'
}

function confirmationLabel(scene: RoomIdentityRecognitionScene) {
  return scene.type === 'none' ? '我已了解' : '我已辨认'
}

function CenterMessage({ description, title, type }: { description: string; title: string; type: string }) {
  return (
    <div
      className="font-avalon-serif room-center-summary w-[152px] shrink-0 text-center"
      data-identity-recognition-center={type}
      role="status"
    >
      <strong className="block text-base font-semibold text-amber-100">{title}</strong>
      <span className="mt-1 block text-xs leading-5 text-slate-300">{description}</span>
    </div>
  )
}

export function RoomIdentityRecognitionCenter({
  presentation,
}: {
  presentation: RoomIdentityRecognitionPresentation
}) {
  if (presentation.state === 'concealed' || presentation.state === 'revealing') {
    return <CenterMessage description="准备查看你的线索" title="夜幕降临" type="concealed" />
  }

  if (presentation.state === 'waiting') {
    return (
      <div
        className="font-avalon-serif room-center-summary w-[152px] shrink-0 text-center"
        data-identity-recognition-center="waiting"
        role="status"
      >
        <strong className="block text-2xl font-semibold text-amber-100">
          {presentation.confirmedCount} / {presentation.participantCount}
        </strong>
        <span className="mt-1 block text-sm text-slate-200">玩家已完成辨认</span>
        <span className="mt-1 block text-xs text-slate-400">等待其他玩家</span>
      </div>
    )
  }

  const copy = SCENE_COPY[presentation.scene.type]
  return <CenterMessage description={copy.description} title={copy.title} type={presentation.scene.type} />
}

export function RoomIdentityRecognitionPhaseContent({
  presentation,
}: {
  presentation: RoomIdentityRecognitionPresentation
}): RoomPhasePanelSlots {
  if (presentation.state === 'waiting') {
    return {
      title: phaseTitle('等待其他玩家'),
      middle: <p className="text-sm text-slate-300">你的线索已确认</p>,
      action: null,
    }
  }

  if (presentation.state === 'revealed' || presentation.state === 'confirming') {
    const pending = presentation.state === 'confirming'
    return {
      title: phaseTitle('辨认你的线索'),
      middle: <p className="text-sm text-slate-300">{sceneSummary(presentation.scene)}</p>,
      action: (
        <button className={primaryClass} disabled={pending} onClick={presentation.onConfirm} type="button">
          {pending ? '正在确认…' : confirmationLabel(presentation.scene)}
        </button>
      ),
    }
  }

  return {
    title: phaseTitle('辨认你的线索'),
    middle: <p className="text-sm text-slate-300">请确保其他玩家无法看到你的屏幕</p>,
    action: (
      <button className={primaryClass} disabled={presentation.state === 'revealing'} onClick={presentation.onReveal} type="button">
        查看线索
      </button>
    ),
  }
}

export function RoomIdentityRecognitionStage({ presentation }: {
  presentation: RoomIdentityRecognitionPresentation
}) {
  if (presentation.state === 'waiting') return null

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (presentation.state === 'revealing') presentation.onRevealComplete()
  }

  return (
    <div
      aria-hidden="true"
      className="identity-recognition-atmosphere pointer-events-none absolute inset-0 z-[30] overflow-hidden"
      data-identity-recognition-atmosphere={presentation.state}
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="identity-recognition-wave absolute left-1/2 top-1/2 rounded-full" />
    </div>
  )
}
