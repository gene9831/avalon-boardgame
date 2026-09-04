import {
  useCallback,
  useRef,
  type KeyboardEvent,
} from 'react'
import { ChevronDown } from 'lucide-react'

import { loyaltyForRole, type Role } from '@avalon/game'

import {
  getHelpPlayerRows,
  getHelpRoleOrder,
  HELP_FLOW_STEPS,
  HELP_KEY_RULES,
} from './help-content'
import type { HelpTab } from './help-context'
import { ModalDialog } from './ModalDialog'
import { ROLE_GUIDANCE } from './role-guidance'
import { LOYALTY_LABELS, ROLE_LABELS } from './room-game'

const tabs: readonly { id: HelpTab; label: string }[] = [
  { id: 'rules', label: '游戏基础规则' },
  { id: 'roles', label: '角色说明' },
]

interface HelpRoleArtworkSource {
  height: number
  slug: string
  width: number
}

const HELP_ROLE_ARTWORK: Partial<Record<Role, HelpRoleArtworkSource>> = {
  assassin: { height: 1051, slug: 'assassin', width: 674 },
  loyal_servant: { height: 1010, slug: 'loyal-servant', width: 674 },
  merlin: { height: 1127, slug: 'merlin', width: 752 },
  minion: { height: 1010, slug: 'minion', width: 674 },
  morgana: { height: 1127, slug: 'morgana', width: 752 },
  percival: { height: 1127, slug: 'percival', width: 752 },
}

const HELP_ROLE_ARTWORK_SIZES = '(min-width: 1024px) 18rem, (min-width: 640px) 42vw, 5.5rem'

export interface HelpDialogProps {
  activeTab: HelpTab
  focusRoles: boolean
  onActiveTabChange: (tab: HelpTab) => void
  onRequestClose: () => void
  open: boolean
  playerCount?: number
  requestID: number
}

export function HelpDialog({
  activeTab,
  focusRoles,
  onActiveTabChange,
  onRequestClose,
  open,
  playerCount,
  requestID,
}: HelpDialogProps) {
  const rulesTabRef = useRef<HTMLButtonElement | null>(null)
  const rolesTabRef = useRef<HTMLButtonElement | null>(null)
  const getTabRef = useCallback(
    (tab: HelpTab) => tab === 'rules' ? rulesTabRef : rolesTabRef,
    [],
  )
  const focusActiveTab = useCallback(() => {
    getTabRef(activeTab).current?.focus()
  }, [activeTab, getTabRef])

  const activateTabFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: HelpTab,
  ) => {
    const currentIndex = tabs.findIndex(({ id }) => id === tab)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const nextTab = tabs[nextIndex]!.id
    onActiveTabChange(nextTab)
    getTabRef(nextTab).current?.focus()
  }

  return (
    <ModalDialog
      ariaLabelledBy="help-dialog-title"
      closeDisabled={false}
      onAfterOpen={focusActiveTab}
      onRequestClose={onRequestClose}
      open={open}
      size="wide"
    >
      <div className="help-dialog min-h-0">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 px-4 pt-4 backdrop-blur sm:px-6 sm:pt-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white sm:text-2xl" id="help-dialog-title">
              帮助说明
            </h2>
            <button
              aria-label="关闭帮助说明"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              onClick={onRequestClose}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div aria-label="帮助说明分类" className="mt-2 grid grid-cols-2" role="tablist">
            {tabs.map(({ id, label }) => (
              <button
                aria-controls={`help-panel-${id}`}
                aria-selected={activeTab === id}
                className={`min-h-11 border-b-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300 ${activeTab === id ? 'border-amber-300 text-amber-200' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                id={`help-tab-${id}`}
                key={id}
                onClick={() => onActiveTabChange(id)}
                onKeyDown={(event) => activateTabFromKeyboard(event, id)}
                ref={getTabRef(id)}
                role="tab"
                tabIndex={activeTab === id ? 0 : -1}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {activeTab === 'rules' ? (
            <RulesHelpPanel playerCount={playerCount} />
          ) : (
            <RolesHelpPanel focusRoles={focusRoles} requestID={requestID} />
          )}
        </div>
      </div>
    </ModalDialog>
  )
}

function RulesHelpPanel({ playerCount }: { playerCount?: number }) {
  return (
    <section
      aria-labelledby="help-tab-rules"
      id="help-panel-rules"
      role="tabpanel"
    >
      <p className="max-w-3xl text-sm leading-6 text-slate-300">
        阿瓦隆是一场 5–10 人的阵营推理游戏。正义阵营尝试完成任务，邪恶阵营则隐藏身份并破坏任务。
      </p>

      <section className="mt-5" aria-labelledby="help-objective-title">
        <h3 className="text-base font-semibold text-amber-200" id="help-objective-title">游戏目标</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
            <p className="font-semibold text-cyan-200">正义阵营</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">完成三次任务，并避免梅林被刺客准确指认。</p>
          </article>
          <article className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4">
            <p className="font-semibold text-rose-200">邪恶阵营</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">让三次任务失败，连续否决五支队伍，或最终找出梅林。</p>
          </article>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="help-flow-title">
        <h3 className="text-base font-semibold text-amber-200" id="help-flow-title">回合流程</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HELP_FLOW_STEPS.map(({ detail, title }, index) => (
            <li className="rounded-2xl border border-white/10 bg-slate-950/35 p-4" key={title}>
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-amber-300 text-xs font-bold text-slate-950">{index + 1}</span>
                <h4 className="font-semibold text-white">{title}</h4>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 space-y-3">
        <details className="group rounded-2xl border border-white/10 bg-slate-950/35">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300">
            关键规则
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 self-center text-slate-400 transition-transform group-open:rotate-180" strokeWidth={2} />
          </summary>
          <ul className="space-y-2 border-t border-white/10 px-4 py-4 text-sm leading-6 text-slate-300">
            {HELP_KEY_RULES.map((rule) => <li key={rule}>• {rule}</li>)}
          </ul>
        </details>

        <details className="group rounded-2xl border border-white/10 bg-slate-950/35">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300">
            人数配置
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 self-center text-slate-400 transition-transform group-open:rotate-180" strokeWidth={2} />
          </summary>
          <div className="overflow-x-auto border-t border-white/10 p-3 sm:p-4">
            <table className="w-full min-w-[38rem] text-left text-xs sm:text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">人数</th>
                  <th className="px-3 py-2 font-medium">正义</th>
                  <th className="px-3 py-2 font-medium">邪恶</th>
                  <th className="px-3 py-2 font-medium">五次任务人数</th>
                </tr>
              </thead>
              <tbody>
                {getHelpPlayerRows().map((row) => {
                  const current = row.playerCount === playerCount
                  return (
                    <tr
                      aria-current={current ? 'true' : undefined}
                      className={current ? 'bg-amber-300/10 text-amber-100' : 'border-t border-white/5 text-slate-300'}
                      key={row.playerCount}
                    >
                      <th className="px-3 py-2 font-semibold">{row.playerCount}</th>
                      <td className="px-3 py-2">{row.good}</td>
                      <td className="px-3 py-2">{row.evil}</td>
                      <td className="px-3 py-2 tracking-[0.08em]">{row.questTeamSizes.join(' · ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  )
}

function RolesHelpPanel({
  focusRoles,
  requestID,
}: {
  focusRoles: boolean
  requestID: number
}) {
  return (
    <section
      aria-labelledby="help-tab-roles"
      id="help-panel-roles"
      role="tabpanel"
    >
      {focusRoles && (
        <p className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-50">
          帕西维尔看到梅林与莫甘娜，但无法分辨两人；莫甘娜会伪装成梅林候选人。
        </p>
      )}
      <div className={`${focusRoles ? 'mt-4' : ''} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
        {getHelpRoleOrder(focusRoles).map((role) => (
          <HelpRoleCard
            focusRoles={focusRoles}
            key={`${requestID}-${role}`}
            role={role}
          />
        ))}
      </div>
    </section>
  )
}

function HelpRoleCard({
  focusRoles,
  role,
}: {
  focusRoles: boolean
  role: Role
}) {
  const guidance = ROLE_GUIDANCE[role]
  const loyalty = loyaltyForRole(role)
  const focused = focusRoles && (role === 'percival' || role === 'morgana')
  const optional = role === 'percival' || role === 'morgana'

  return (
    <article
      className={`help-role-card grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:block sm:p-4 ${focused ? 'help-role-card--pulse' : ''}`}
      data-help-role={role}
    >
      <HelpRoleArtwork role={role} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2 sm:mt-4">
          <div>
            <h3 className="font-semibold text-white">{ROLE_LABELS[role]}</h3>
            <p className={`mt-1 text-xs font-semibold ${loyalty === 'good' ? 'text-cyan-200' : 'text-rose-200'}`}>
              {LOYALTY_LABELS[loyalty]}
            </p>
          </div>
          {optional && (
            <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] font-semibold text-slate-400">可选角色</span>
          )}
        </div>
        <dl className="mt-3 space-y-2 text-xs leading-5 sm:mt-4 sm:space-y-3 sm:text-sm sm:leading-6">
          <div>
            <dt className="font-semibold text-slate-200">能力</dt>
            <dd className="mt-1 text-slate-400">{guidance.ability}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-200">目标</dt>
            <dd className="mt-1 text-slate-400">{guidance.objective}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-200">提示</dt>
            <dd className="mt-1 text-slate-400">{guidance.beginnerTip}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}

function HelpRoleArtwork({ role }: { role: Role }) {
  const artwork = HELP_ROLE_ARTWORK[role]
  const className = 'relative isolate w-[5.5rem] overflow-hidden rounded-xl border border-white/15 bg-slate-950/35 sm:aspect-[4/3] sm:w-auto'

  if (artwork === undefined) {
    return (
      <div
        aria-hidden="true"
        className={`${className} aspect-[11/14] border-dashed`}
        data-role-artwork-placeholder={role}
      />
    )
  }

  const src = `/images/roles/${artwork.slug}-${artwork.width}.webp`
  const srcSet = [320, 480, artwork.width]
    .map((width) => `/images/roles/${artwork.slug}-${width}.webp ${width}w`)
    .join(', ')

  return (
    <div aria-hidden="true" className={className}>
      <img
        alt=""
        aria-hidden="true"
        className="absolute inset-0 hidden size-full scale-[1.08] object-cover blur-[18px] brightness-[.55] saturate-[.8] sm:block"
        data-help-role-artwork-backdrop={role}
        decoding="async"
        height={artwork.height}
        loading="lazy"
        sizes={HELP_ROLE_ARTWORK_SIZES}
        src={src}
        srcSet={srcSet}
        width={artwork.width}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden sm:block"
        style={{
          backgroundImage: 'radial-gradient(ellipse at center, transparent 35%, rgb(2 6 23 / 0.18) 72%, rgb(2 6 23 / 0.42) 100%), linear-gradient(to bottom, rgb(15 23 42 / 0.02) 0%, rgb(15 23 42 / 0.08) 55%, rgb(2 6 23 / 0.30) 100%)',
        }}
      />
      <img
        alt=""
        className="relative z-10 block h-auto w-full sm:size-full sm:object-contain"
        data-help-role-artwork={role}
        decoding="async"
        height={artwork.height}
        loading="lazy"
        sizes={HELP_ROLE_ARTWORK_SIZES}
        src={src}
        srcSet={srcSet}
        width={artwork.width}
      />
    </div>
  )
}
