import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface RoomToolbarItem {
  disabled?: boolean
  icon: LucideIcon
  id: string
  label: string
  onActivate: () => void
  pressed?: boolean
}

export interface RoomToolbarProps {
  children?: ReactNode
  items: readonly RoomToolbarItem[]
}

export function RoomToolbar({ children, items }: RoomToolbarProps) {
  return (
    <nav aria-label="房间工具" className="room-toolbar flex items-center justify-end gap-1 font-sans">
      {items.map(({ disabled = false, icon: Icon, id, label, onActivate, pressed }) => (
        <button
          aria-label={label}
          aria-pressed={pressed}
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border-0 bg-transparent p-0 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
          data-room-toolbar-item={id}
          disabled={disabled}
          key={id}
          onClick={onActivate}
          title={label}
          type="button"
        >
          <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
        </button>
      ))}
      {children}
    </nav>
  )
}
