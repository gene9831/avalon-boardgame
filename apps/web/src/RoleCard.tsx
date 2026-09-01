import { loyaltyForRole, type Role } from '@avalon/game'

import assassinAvatar from './assets/roles/assassin.png'
import loyalServantAvatar from './assets/roles/loyal-servant.png'
import merlinAvatar from './assets/roles/merlin.png'
import morganaAvatar from './assets/roles/morgana.png'
import minionAvatar from './assets/roles/minion-of-mordred.png'
import percivalAvatar from './assets/roles/percival.png'
import { ROLE_GUIDANCE } from './role-guidance'
import { LOYALTY_LABELS, ROLE_LABELS } from './room-game'

const ROLE_AVATARS: Record<Role, string> = {
  assassin: assassinAvatar,
  loyal_servant: loyalServantAvatar,
  merlin: merlinAvatar,
  morgana: morganaAvatar,
  minion: minionAvatar,
  percival: percivalAvatar,
}

interface RoleAvatarProps {
  className?: string
  role: Role
}

export function RoleAvatar({ className, role }: RoleAvatarProps) {
  return (
    <img
      alt=""
      className={className}
      data-role-avatar={role}
      src={ROLE_AVATARS[role]}
    />
  )
}

interface RoleCardProps {
  role: Role
}

export function RoleCard({ role }: RoleCardProps) {
  const guidance = ROLE_GUIDANCE[role]
  const loyalty = loyaltyForRole(role)

  return (
    <article
      aria-label={`我的身份：${ROLE_LABELS[role]}`}
      className="role-card role-card--recognition pointer-events-auto w-full overflow-y-auto border border-amber-200/35 bg-[linear-gradient(145deg,_rgba(38,61,48,0.98),_rgba(11,23,40,0.98)_58%,_rgba(48,33,18,0.98))] text-center shadow-[0_25px_70px_rgba(0,0,0,0.65),inset_0_0_45px_rgba(245,158,11,0.08)]"
      data-role-card={role}
    >
      <div className="role-card__identity">
        <RoleAvatar
          className="role-card__artwork mx-auto rounded-full border-2 border-amber-200/55 object-cover shadow-[0_0_28px_rgba(251,191,36,0.25)]"
          role={role}
        />
        <h3 className="role-card__name mt-3 font-serif font-semibold text-white">
          {ROLE_LABELS[role]}
        </h3>
        <p className={`role-card__loyalty mt-1 text-sm font-semibold ${loyalty === 'good' ? 'text-cyan-200' : 'text-rose-200'}`}>
          {LOYALTY_LABELS[loyalty]}
        </p>
      </div>
      <div className="role-card__guidance">
        <p className="role-card__ability mt-4 text-left text-sm leading-6 text-slate-200">
          {guidance.ability}
        </p>
        <p className="role-card__objective mt-2 text-left text-sm leading-6 text-amber-50/85">
          本局目标：{guidance.objective}
        </p>
      </div>
    </article>
  )
}
