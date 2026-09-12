import { useRef, type AnimationEvent } from 'react'
import { loyaltyForRole, type Role } from '@avalon/game'

import type { RoomPhasePanelSlots } from './RoomPhasePanelContent'
import { ROLE_GUIDANCE } from './role-guidance'
import { getRoleArtworkSourceSet, ROLE_ARTWORK } from './role-artwork'
import { LOYALTY_LABELS, ROLE_LABELS } from './room-game'
import './RoomIdentityConfirmation.css'

export type RoomIdentityConfirmationState =
  | 'concealed'
  | 'revealing'
  | 'revealed'
  | 'confirming'
  | 'hiding'
  | 'waiting'
  | 'reviewing'

export interface RoomIdentityConfirmationPresentation {
  confirmedCount: number
  onCloseReview(): void
  onConfirm(): void
  onHide(): void
  onHideComplete(): void
  onReveal(): void
  onRevealComplete(): void
  onReview(): void
  participantCount: number
  role: Role
  state: RoomIdentityConfirmationState
}

const primaryClass = 'min-h-11 w-full whitespace-nowrap rounded-xl border border-amber-200/70 bg-amber-300/85 px-3 py-2 text-sm font-semibold text-slate-950 transition enabled:hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45'
const secondaryClass = 'min-h-11 w-full whitespace-nowrap rounded-xl border border-white/15 bg-slate-900/75 px-3 py-2 text-sm font-semibold text-slate-100 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45'
const phaseTitle = (title: string) => <h2 className="truncate text-base font-semibold text-amber-100">{title}</h2>

export function RoomIdentityConfirmationCenter({
  presentation,
}: {
  presentation: RoomIdentityConfirmationPresentation
}) {
  return (
    <div
      className="font-avalon-serif room-center-summary w-[152px] shrink-0 text-center"
      data-identity-confirmation-center="true"
      role="status"
    >
      <strong className="block text-2xl font-semibold text-amber-100">
        {presentation.confirmedCount} / {presentation.participantCount}
      </strong>
      <span className="mt-1 block text-sm text-slate-200">玩家已确认身份</span>
      <span className="mt-1 block text-xs text-slate-400">等待其他玩家确认</span>
    </div>
  )
}

export function RoomIdentityConfirmationStage({
  presentation,
}: {
  presentation: RoomIdentityConfirmationPresentation
}) {
  const initialState = useRef(presentation.state)

  if (presentation.state === 'waiting') {
    return null
  }

  const artwork = ROLE_ARTWORK[presentation.role]
  const guidance = ROLE_GUIDANCE[presentation.role]
  const loyalty = loyaltyForRole(presentation.role)
  const showPrivateDetails = presentation.state !== 'concealed'
  const motion = presentation.state === 'revealing' || presentation.state === 'hiding'
    ? presentation.state
    : presentation.state === 'concealed'
      ? 'concealed'
      : presentation.state === 'reviewing' || initialState.current === presentation.state
        ? 'soft'
        : 'settled'
  const handleCardMotionEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (presentation.state === 'revealing') presentation.onRevealComplete()
    if (presentation.state === 'hiding') presentation.onHideComplete()
  }

  return (
    <section
      aria-label="首次身份确认"
      className="identity-confirmation-layer absolute inset-0 z-[30] min-h-0 overflow-hidden p-3"
      data-identity-confirmation-stage={presentation.state}
    >
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
                  data-identity-role-artwork={presentation.role}
                  decoding="async"
                  height={artwork.height}
                  sizes="(orientation: portrait) min(62vw, 220px), 260px"
                  src={`/images/roles/${artwork.slug}-${artwork.width}.webp`}
                  srcSet={getRoleArtworkSourceSet(artwork)}
                  width={artwork.width}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-3 pb-3 pt-10 text-center">
                  <h2 className="font-avalon-serif text-2xl font-semibold text-amber-50">{ROLE_LABELS[presentation.role]}</h2>
                  <p className={loyalty === 'good' ? 'text-sm font-semibold text-cyan-200' : 'text-sm font-semibold text-rose-200'}>
                    {LOYALTY_LABELS[loyalty]}
                  </p>
                </div>
              </div>
            )}
          </div>
          {presentation.state === 'concealed' && (
            <button
              aria-label="揭示身份"
              className="identity-confirmation-card-trigger absolute inset-0 z-10 rounded-2xl"
              onClick={presentation.onReveal}
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
    </section>
  )
}

export function RoomIdentityConfirmationPhaseContent({
  presentation,
}: {
  presentation: RoomIdentityConfirmationPresentation
}): RoomPhasePanelSlots {
  if (presentation.state === 'concealed' || presentation.state === 'revealing') {
    const revealing = presentation.state === 'revealing'
    return {
      title: phaseTitle('确认你的身份'),
      middle: <p className="text-sm text-slate-300">请确保其他玩家无法看到你的屏幕</p>,
      action: (
        <button aria-label="揭示身份" className={primaryClass} disabled={revealing} onClick={presentation.onReveal} type="button">
          揭示身份
        </button>
      ),
    }
  }

  if (presentation.state === 'revealed' || presentation.state === 'confirming' || presentation.state === 'hiding') {
    const confirming = presentation.state === 'confirming'
    const hiding = presentation.state === 'hiding'
    return {
      title: phaseTitle('记住你的身份'),
      middle: <p className="text-sm text-slate-300">确认后将进入等待</p>,
      action: (
        <div className="grid grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] gap-2">
          <button className={secondaryClass} disabled={confirming || hiding} onClick={presentation.onHide} type="button">暂时隐藏</button>
          <button className={primaryClass} disabled={confirming || hiding} onClick={presentation.onConfirm} type="button">
            {confirming ? '正在确认…' : '我已记住身份'}
          </button>
        </div>
      ),
    }
  }

  if (presentation.state === 'waiting') {
    return {
      title: phaseTitle('等待其他玩家'),
      middle: (
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span aria-hidden="true" className="grid aspect-[5/7] h-10 place-items-center rounded-md border border-amber-200/40 bg-slate-950 text-amber-200">✦</span>
          <span>你的身份已确认</span>
        </div>
      ),
      action: <button className={primaryClass} onClick={presentation.onReview} type="button">再次查看身份</button>,
    }
  }

  if (presentation.state === 'reviewing') {
    return {
      title: phaseTitle('查看已确认身份'),
      middle: <p className="text-sm text-slate-300">你的身份已确认</p>,
      action: <button className={secondaryClass} onClick={presentation.onCloseReview} type="button">收起身份</button>,
    }
  }

  return { title: null, middle: null, action: null }
}
