import type { AnimationEvent } from 'react'
import type { PlayerID } from '@avalon/game'

import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import type { RoomPhasePanelSlots } from './RoomPhasePanelContent'
import type {
  RoomActionsByKind,
  RoomIdentityClue,
  RoomIdentityRecognitionScene as RoomIdentityRecognitionSceneData,
} from './room-screen-props'
import './RoomIdentityRecognition.css'

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

export function RoomIdentityRecognitionCenterSurface({
  scene,
}: Pick<RoomIdentityRecognitionSurfaceProps, 'scene'>) {
  if (scene.view === 'concealed' || scene.view === 'revealing') {
    return <CenterMessage description="准备查看你的线索" title="夜幕降临" kind="concealed" />
  }

  if (scene.view === 'waiting') {
    return (
      <RoomCenter data-identity-recognition-center="waiting" density="compact" role="status">
        <strong className="block text-2xl font-semibold text-amber-100">
          {scene.confirmedCount} / {scene.participantCount}
        </strong>
        <span className="mt-1 block text-sm text-slate-200">玩家已完成辨认</span>
        <span className="mt-1 block text-xs text-slate-400">等待其他玩家</span>
      </RoomCenter>
    )
  }

  const copy = CLUE_COPY[scene.clue.kind]
  return <CenterMessage description={copy.description} title={copy.title} kind={scene.clue.kind} />
}

export function RoomIdentityRecognitionPhaseContentSurface({
  actions,
  scene,
}: RoomIdentityRecognitionSurfaceProps): RoomPhasePanelSlots {
  if (scene.view === 'waiting') {
    return {
      title: '等待其他玩家',
      middle: <p className="text-sm text-slate-300">你的线索已确认</p>,
      action: null,
    }
  }

  if (scene.view === 'revealed') {
    return {
      title: '辨认你的线索',
      middle: <p className="text-sm text-slate-300">{clueSummary(scene.clue)}</p>,
      action: (
        <RoomActionButton onClick={actions.onConfirm} requestState={scene.confirmRequestState}>
          {confirmationLabel(scene.clue)}
        </RoomActionButton>
      ),
    }
  }

  return {
    title: '辨认你的线索',
    middle: <p className="text-sm text-slate-300">请确保其他玩家无法看到你的屏幕</p>,
    action: (
      <RoomActionButton disabled={scene.view === 'revealing'} onClick={actions.onReveal}>
        查看线索
      </RoomActionButton>
    ),
  }
}

export function RoomIdentityRecognitionStageSurface({
  actions,
  scene,
}: RoomIdentityRecognitionSurfaceProps) {
  if (scene.view === 'waiting') return null

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (scene.view === 'revealing') actions.onRevealComplete()
  }

  return (
    <div
      aria-hidden="true"
      className="identity-recognition-atmosphere pointer-events-none absolute inset-0 z-[30] overflow-hidden"
      data-identity-recognition-atmosphere={scene.view}
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="identity-recognition-wave absolute left-1/2 top-1/2 rounded-full" />
    </div>
  )
}

// Compatibility for the pre-migration RoomScreen and identity previews.
export type RoomIdentityRecognitionScene =
  | Readonly<{ type: 'evil-allies'; targetPlayerIDs: readonly PlayerID[] }>
  | Readonly<{ type: 'merlin-evil'; targetPlayerIDs: readonly PlayerID[] }>
  | Readonly<{ type: 'percival-candidates'; targetPlayerIDs: readonly [PlayerID, PlayerID] }>
  | Readonly<{ type: 'none'; targetPlayerIDs: readonly [] }>

export type RoomIdentityRecognitionState = RoomIdentityRecognitionSceneData['view'] | 'confirming'

export interface RoomIdentityRecognitionPresentation {
  confirmedCount: number
  onConfirm(): void
  onReveal(): void
  onRevealComplete(): void
  participantCount: number
  scene: RoomIdentityRecognitionScene
  state: RoomIdentityRecognitionState
}

function legacyClue(clue: RoomIdentityRecognitionScene): RoomIdentityClue {
  switch (clue.type) {
    case 'evil-allies': return { kind: 'evilAllies', targetPlayerIDs: clue.targetPlayerIDs }
    case 'merlin-evil': return { kind: 'merlinEvil', targetPlayerIDs: clue.targetPlayerIDs }
    case 'percival-candidates': return { kind: 'percivalCandidates', targetPlayerIDs: clue.targetPlayerIDs }
    case 'none': return { kind: 'none', targetPlayerIDs: clue.targetPlayerIDs }
  }
}

function legacyBinding(presentation: RoomIdentityRecognitionPresentation): RoomIdentityRecognitionSurfaceProps {
  return {
    actions: {
      onConfirm: presentation.onConfirm,
      onReveal: presentation.onReveal,
      onRevealComplete: presentation.onRevealComplete,
    },
    scene: {
      kind: 'identityRecognition', matchID: '', playerCount: null, players: [], questProgress: [],
      clue: legacyClue(presentation.scene),
      view: presentation.state === 'confirming' ? 'revealed' : presentation.state,
      confirmedCount: presentation.confirmedCount,
      participantCount: presentation.participantCount,
      confirmRequestState: presentation.state === 'confirming' ? 'pending' : 'idle',
    },
  }
}

export function RoomIdentityRecognitionCenter({ presentation }: { presentation: RoomIdentityRecognitionPresentation }) {
  return <RoomIdentityRecognitionCenterSurface scene={legacyBinding(presentation).scene} />
}

export function RoomIdentityRecognitionPhaseContent({ presentation }: { presentation: RoomIdentityRecognitionPresentation }) {
  const phase = RoomIdentityRecognitionPhaseContentSurface(legacyBinding(presentation))
  return {
    ...phase,
    title: <h2 className="truncate text-base font-semibold text-amber-100">{phase.title}</h2>,
  }
}

export function RoomIdentityRecognitionStage({ presentation }: { presentation: RoomIdentityRecognitionPresentation }) {
  return <RoomIdentityRecognitionStageSurface {...legacyBinding(presentation)} />
}
