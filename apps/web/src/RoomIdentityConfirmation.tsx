import type { AnimationEvent, ReactNode } from 'react'
import { loyaltyForRole } from '@avalon/game'

import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { ROLE_GUIDANCE } from './role-guidance'
import { getRoleArtworkSourceSet, ROLE_ARTWORK } from './role-artwork'
import { LOYALTY_LABELS, ROLE_LABELS } from './room-game'
import type {
  RoomActionsByKind,
  RoomIdentityConfirmationScene,
} from './room-screen-props'
import './RoomIdentityConfirmation.css'

type RoomPhaseContent = Readonly<{
  title: string
  middle: ReactNode
  action: ReactNode
}>

export interface RoomIdentityConfirmationSurfaceProps {
  actions: RoomActionsByKind['identityConfirmation']
  scene: RoomIdentityConfirmationScene
}

export interface RoomIdentityCardReadingProps {
  onHideComplete?: () => void
  onReveal?: () => void
  onRevealComplete?: () => void
  role: RoomIdentityConfirmationScene['role']
  view: RoomIdentityConfirmationScene['view']
}

export function RoomIdentityConfirmationCenterSurface({
  scene,
}: Pick<RoomIdentityConfirmationSurfaceProps, 'scene'>) {
  return (
    <RoomCenter data-identity-confirmation-center="true" density="compact" role="status">
      <strong className="block text-lg font-semibold text-amber-100">
        {scene.completedCount} / {scene.participantCount}
      </strong>
      <span className="mt-1 block text-sm text-slate-200">玩家已完成身份辨认</span>
      <span className="mt-1 block text-sm text-slate-400">完成身份确认后继续</span>
    </RoomCenter>
  )
}

export function RoomIdentityCardReading({
  onHideComplete,
  onReveal,
  onRevealComplete,
  role,
  view,
}: RoomIdentityCardReadingProps) {
  const artwork = ROLE_ARTWORK[role]
  const guidance = ROLE_GUIDANCE[role]
  const loyalty = loyaltyForRole(role)
  const showPrivateDetails = view !== 'concealed'
  const motion = view === 'revealing' || view === 'hiding'
    ? view
      : view === 'concealed'
        ? 'concealed'
        : 'settled'
  const handleCardMotionEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (view === 'revealing') onRevealComplete?.()
    if (view === 'hiding') onHideComplete?.()
  }

  return (
    <article
      className="identity-confirmation-reading relative z-10 mx-auto size-full min-h-0 max-w-[760px]"
      data-role-loyalty={loyalty}
    >
      <div
        className="identity-confirmation-card-motion"
        data-identity-card-motion={motion}
        onAnimationEnd={handleCardMotionEnd}
      >
        <div className="identity-confirmation-card-flip">
          <div aria-hidden="true" className="identity-confirmation-card-face identity-confirmation-card-back">
            <span className="identity-confirmation-card-back__seal">✦</span>
          </div>
          {showPrivateDetails && (
            <div className="identity-confirmation-card-face identity-confirmation-role-card">
              <img
                alt=""
                className="size-full object-cover"
                data-identity-role-artwork={role}
                decoding="async"
                height={artwork.height}
                sizes="(orientation: portrait) min(62vw, 220px), 260px"
                src={`/images/roles/${artwork.slug}-${artwork.width}.webp`}
                srcSet={getRoleArtworkSourceSet(artwork)}
                width={artwork.width}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-3 pb-3 pt-10 text-center">
                <h2 className="font-avalon-serif text-2xl font-semibold text-amber-50">{ROLE_LABELS[role]}</h2>
                <p className={loyalty === 'good' ? 'text-sm font-semibold text-cyan-200' : 'text-sm font-semibold text-rose-200'}>
                  {LOYALTY_LABELS[loyalty]}
                </p>
              </div>
            </div>
          )}
        </div>
        {view === 'concealed' && (
          <button
            aria-label="揭示身份"
            className="identity-confirmation-card-trigger absolute inset-0 z-10 rounded-2xl"
            onClick={onReveal}
            type="button"
          />
        )}
      </div>
      {showPrivateDetails && (
        <div className="identity-confirmation-details-slot">
          <div className="identity-confirmation-details grid content-start gap-3 rounded-2xl border border-white/10 bg-slate-950/78 p-4 text-left shadow-xl">
            <section>
              <h3 className="font-avalon-serif text-sm font-semibold tracking-wide text-amber-200">你的目标</h3>
              <p className="mt-1 text-sm leading-6 text-slate-100">{guidance.objective}</p>
            </section>
            <section>
              <h3 className="font-avalon-serif text-sm font-semibold tracking-wide text-slate-200">角色能力</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">{guidance.ability}</p>
            </section>
            <section>
              <h3 className="font-avalon-serif text-sm font-semibold tracking-wide text-slate-200">行动提示</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">{guidance.beginnerTip}</p>
            </section>
          </div>
        </div>
      )}
    </article>
  )
}

export function RoomIdentityConfirmationStageSurface({
  actions,
  scene,
}: RoomIdentityConfirmationSurfaceProps) {
  return (
    <section
      aria-label="首次身份确认"
      className="identity-confirmation-layer absolute inset-0 z-[30] min-h-0 overflow-hidden p-3"
      data-identity-confirmation-stage={scene.view}
    >
      <RoomIdentityCardReading
        onHideComplete={actions.onHideComplete}
        onReveal={actions.onReveal}
        onRevealComplete={actions.onRevealComplete}
        role={scene.role}
        view={scene.view}
      />
    </section>
  )
}

export function RoomIdentityConfirmationPhaseContentSurface({
  actions,
  scene,
}: RoomIdentityConfirmationSurfaceProps): RoomPhaseContent {
  if (scene.view === 'concealed' || scene.view === 'revealing') {
    return {
      title: '确认你的身份',
      middle: <p className="text-sm text-slate-300">请确保其他玩家无法看到你的屏幕</p>,
      action: (
        <RoomActionButton disabled={scene.view === 'revealing'} onClick={actions.onReveal}>
          揭示身份
        </RoomActionButton>
      ),
    }
  }

  if (scene.view === 'revealed' || scene.view === 'hiding') {
    const hiding = scene.view === 'hiding'
    return {
      title: '记住你的身份',
      middle: (
        <p className="text-sm text-slate-300">
          确认后将等待其他玩家
        </p>
      ),
      action: (
        <div className="grid grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] gap-2">
          <RoomActionButton disabled={hiding} onClick={actions.onHide} tone="secondary">暂时隐藏</RoomActionButton>
          <RoomActionButton
            disabled={hiding}
            onClick={actions.onConfirm}
            requestState={scene.confirmRequestState}
          >
            我已记住身份
          </RoomActionButton>
        </div>
      ),
    }
  }

  throw new Error(`Unhandled identity confirmation view: ${String(scene.view)}`)
}
