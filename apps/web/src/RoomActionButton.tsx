import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from 'react'

import type { RoomRequestState } from './room-screen-props'

const actionBaseClass = 'min-h-11 w-full whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-45'

const actionClassByTone = {
  primary: `${actionBaseClass} border-amber-200/70 bg-amber-300/85 text-slate-950 enabled:hover:bg-amber-200`,
  secondary: `${actionBaseClass} border-white/15 bg-slate-900/75 text-slate-100 enabled:hover:bg-white/10`,
} as const

export interface RoomActionButtonProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'className' | 'type'> {
  children: ReactNode
  requestState?: RoomRequestState
  tone?: keyof typeof actionClassByTone
}

export function RoomActionButton({
  children,
  disabled,
  requestState = 'idle',
  tone = 'primary',
  ...props
}: RoomActionButtonProps) {
  return (
    <button
      {...props}
      className={actionClassByTone[tone]}
      disabled={disabled || requestState === 'pending'}
      type="button"
    >
      {children}
    </button>
  )
}

const choiceClassByTone = {
  negative: {
    idle: `${actionBaseClass} border-white/10 bg-slate-900/70 text-slate-200 enabled:hover:border-rose-200/50`,
    selected: `${actionBaseClass} border-rose-200/70 bg-rose-500/25 text-rose-50`,
  },
  positive: {
    idle: `${actionBaseClass} border-white/10 bg-slate-900/70 text-slate-200 enabled:hover:border-emerald-200/50`,
    selected: `${actionBaseClass} border-emerald-200/70 bg-emerald-400/25 text-emerald-50`,
  },
} as const

export interface RoomChoiceButtonProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'aria-pressed' | 'children' | 'className' | 'type'> {
  children: ReactNode
  requestState?: RoomRequestState
  selected: boolean
  tone: keyof typeof choiceClassByTone
}

export function RoomChoiceButton({
  children,
  disabled,
  requestState = 'idle',
  selected,
  tone,
  ...props
}: RoomChoiceButtonProps) {
  return (
    <button
      {...props}
      aria-pressed={selected}
      className={choiceClassByTone[tone][selected ? 'selected' : 'idle']}
      disabled={disabled || requestState === 'pending'}
      type="button"
    >
      {children}
    </button>
  )
}
