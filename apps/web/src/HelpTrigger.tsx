import { CircleHelp } from 'lucide-react'
import { useId } from 'react'

export type HelpTriggerVariant = 'icon' | 'labeled' | 'role-pair'

export function HelpTrigger({
  onOpen,
  variant,
}: {
  onOpen: () => void
  variant: HelpTriggerVariant
}) {
  const tooltipID = useId()
  const rolePair = variant === 'role-pair'
  const label = rolePair
    ? '查看帕西维尔与莫甘娜的角色说明'
    : '打开帮助说明'
  const buttonClass = variant === 'labeled'
    ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-900/40 text-sm font-semibold text-slate-200 transition hover:border-amber-300/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:gap-2 sm:px-3 sm:py-2'
    : variant === 'icon'
      ? 'grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-300/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300'
      : 'grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300'

  const button = (
    <button
      aria-describedby={rolePair ? tooltipID : undefined}
      aria-label={variant === 'labeled' ? '帮助说明' : label}
      className={buttonClass}
      onClick={onOpen}
      title={variant === 'icon' ? '帮助说明' : undefined}
      type="button"
    >
      <CircleHelp aria-hidden="true" className="size-5" strokeWidth={1.8} />
      {variant === 'labeled' && <span className="hidden sm:inline">帮助说明</span>}
    </button>
  )

  if (!rolePair) return button

  return (
    <span className="group relative inline-flex shrink-0">
      {button}
      <span
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] right-0 z-50 w-max max-w-56 translate-y-1 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-xs leading-5 text-slate-200 opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
        id={tooltipID}
        role="tooltip"
      >
        查看帕西维尔与莫甘娜的角色说明
      </span>
    </span>
  )
}
