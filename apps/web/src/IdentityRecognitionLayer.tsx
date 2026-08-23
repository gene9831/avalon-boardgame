import type {
  AvalonPlayerView,
  IdentityRecognitionStep,
  Role,
} from '@avalon/game'

import assassinAvatar from './assets/roles/assassin.png'
import loyalServantAvatar from './assets/roles/loyal-servant.png'
import merlinAvatar from './assets/roles/merlin.png'
import minionAvatar from './assets/roles/minion-of-mordred.png'
import { LOYALTY_LABELS, ROLE_LABELS } from './room-game'

const ROLE_AVATARS: Record<Role, string> = {
  assassin: assassinAvatar,
  loyal_servant: loyalServantAvatar,
  merlin: merlinAvatar,
  minion: minionAvatar,
}

const ROLE_GUIDANCE: Record<Role, { ability: string; objective: string }> = {
  assassin: {
    ability: '你属于邪恶阵营，可在任务中选择 Success 或 Fail。正义完成三次任务后，由你刺杀梅林。',
    objective: '破坏三次任务，或在最后准确找出梅林。',
  },
  loyal_servant: {
    ability: '你没有额外身份视野。参加任务时只能提交 Success。',
    objective: '帮助正义阵营完成三次任务，并保护梅林不被刺客识破。',
  },
  merlin: {
    ability: '你会在辨认阶段看到全部邪恶阵营座位，但不会知道谁是刺客或爪牙。',
    objective: '引导正义完成三次任务，同时隐藏自己，避免被刺客识破。',
  },
  minion: {
    ability: '你属于邪恶阵营，可辨认同伴，并可在任务中选择 Success 或 Fail。',
    objective: '协助邪恶阵营破坏三次任务，并帮助刺客找出梅林。',
  },
}

const STEP_COPY: Record<
  IdentityRecognitionStep,
  { title: string; confirmation: string; waiting: string }
> = {
  roleReveal: {
    title: '查看你的身份',
    confirmation: '我已确认身份',
    waiting: '等待其他玩家确认身份',
  },
  evilRecognition: {
    title: '邪恶阵营，请睁眼并辨认同伴',
    confirmation: '我已辨认同伴',
    waiting: '等待其他邪恶阵营玩家',
  },
  merlinRecognition: {
    title: '梅林，请睁眼并辨认邪恶阵营',
    confirmation: '我已辨认邪恶阵营',
    waiting: '等待梅林确认',
  },
}

interface IdentityRecognitionLayerProps {
  game: AvalonPlayerView
  onConfirm: () => void
}

export function IdentityRecognitionLayer({
  game,
  onConfirm,
}: IdentityRecognitionLayerProps) {
  const recognition = game.identityRecognition
  const viewerRecognition = game.viewer.identityRecognition

  if (recognition === null || viewerRecognition === undefined) return null

  const copy = STEP_COPY[recognition.step]
  const progress = `${recognition.confirmedCount}/${recognition.participantCount} 已确认`

  if (!viewerRecognition.isParticipant) {
    return (
      <section
        aria-label="身份辨认幕布"
        className="identity-curtain identity-curtain--closed absolute inset-0 z-[60] grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(56,45,24,0.3),_transparent_34%),linear-gradient(180deg,_#0b1728,_#030812)] px-5 text-center"
        data-curtain-state="closed"
        data-identity-step={recognition.step}
      >
        <CurtainDecoration />
        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300/80">
            Identity recognition
          </p>
          <h2 className="mt-4 font-serif text-2xl font-semibold text-amber-50 sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-5 text-sm text-slate-300">{progress}</p>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="身份辨认"
      className="pointer-events-none absolute inset-0 z-[55] flex flex-col items-center justify-between p-3 sm:p-5"
      data-curtain-state="raised"
      data-identity-step={recognition.step}
    >
      <div
        aria-hidden="true"
        className="identity-curtain identity-curtain--raising pointer-events-none absolute inset-0 z-[70] overflow-hidden bg-[linear-gradient(180deg,_#0b1728,_#030812)]"
      >
        <CurtainDecoration />
      </div>
      <div className="pointer-events-auto rounded-2xl border border-amber-200/30 bg-slate-950/90 px-4 py-2 text-center shadow-xl shadow-black/40 backdrop-blur">
        <h2 className="font-serif text-base font-semibold text-amber-50 sm:text-xl">
          {copy.title}
        </h2>
        <p className="mt-1 text-xs text-slate-300">{progress}</p>
      </div>

      {recognition.step === 'roleReveal' && game.viewer.role !== null && (
        <RoleRevealCard role={game.viewer.role} />
      )}

      <div className="pointer-events-auto rounded-2xl border border-white/15 bg-slate-950/90 p-2 shadow-xl shadow-black/40 backdrop-blur">
        <button
          className="min-h-11 min-w-44 rounded-xl bg-amber-300 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:bg-slate-700 disabled:text-slate-200"
          disabled={viewerRecognition.confirmed}
          onClick={onConfirm}
          type="button"
        >
          {viewerRecognition.confirmed ? '等待中' : copy.confirmation}
        </button>
        {viewerRecognition.confirmed && (
          <p className="mt-1 text-center text-[0.65rem] text-slate-400">
            {copy.waiting}
          </p>
        )}
      </div>
    </section>
  )
}

function RoleRevealCard({ role }: { role: Role }) {
  const guidance = ROLE_GUIDANCE[role]
  const loyalty = role === 'merlin' || role === 'loyal_servant'
    ? 'good'
    : 'evil'

  return (
    <article className="pointer-events-auto mx-3 max-h-[calc(100dvh-11rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-200/35 bg-[linear-gradient(145deg,_rgba(38,61,48,0.98),_rgba(11,23,40,0.98)_58%,_rgba(48,33,18,0.98))] p-4 text-center shadow-[0_25px_70px_rgba(0,0,0,0.65),inset_0_0_45px_rgba(245,158,11,0.08)] sm:p-6">
      <img
        alt=""
        className="mx-auto size-24 rounded-full border-2 border-amber-200/55 object-cover shadow-[0_0_28px_rgba(251,191,36,0.25)] sm:size-32"
        data-role-avatar={role}
        src={ROLE_AVATARS[role]}
      />
      <h3 className="mt-3 font-serif text-2xl font-semibold text-white sm:text-3xl">
        {ROLE_LABELS[role]}
      </h3>
      <p className={`mt-1 text-sm font-semibold ${loyalty === 'good' ? 'text-cyan-200' : 'text-rose-200'}`}>
        {LOYALTY_LABELS[loyalty]}
      </p>
      <p className="mt-4 text-left text-sm leading-6 text-slate-200">
        {guidance.ability}
      </p>
      <p className="mt-2 text-left text-sm leading-6 text-amber-50/85">
        本局目标：{guidance.objective}
      </p>
    </article>
  )
}

function CurtainDecoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
      <div className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/10 shadow-[0_0_80px_rgba(245,158,11,0.12),inset_0_0_70px_rgba(245,158,11,0.04)]" />
      <div className="absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-black/55 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-[18%] bg-gradient-to-l from-black/55 to-transparent" />
    </div>
  )
}
