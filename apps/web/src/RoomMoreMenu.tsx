import { Ellipsis } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { RoomLogDialog } from './RoomLogControl'
import type { RoomLogEntry } from './room-log'

export interface RoomMoreMenuPanelProps {
  isOwner: boolean
  onOpenLog: () => void
  onRequestRoomExit: () => void
  roomActionDisabled: boolean
  roomExitBusy: boolean
}

export function RoomMoreMenuPanel({ isOwner, onOpenLog, onRequestRoomExit, roomActionDisabled, roomExitBusy }: RoomMoreMenuPanelProps) {
  return (
    <div className="min-w-44 rounded-xl border border-white/10 bg-slate-950 p-1.5 shadow-2xl" role="menu">
      <button className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-slate-100 transition hover:bg-white/10" onClick={onOpenLog} role="menuitem" type="button">对局记录</button>
      <div aria-hidden="true" className="my-1 border-t border-white/10" />
      <button className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={roomActionDisabled} onClick={onRequestRoomExit} role="menuitem" type="button">
        {roomExitBusy ? (isOwner ? '正在解散…' : '正在退出…') : isOwner ? '解散房间' : '退出房间'}
      </button>
    </div>
  )
}

export function RoomMoreMenu({ connected, entries, isOwner, onRequestRoomExit, roomExitBlocked, roomExitBusy, seatChangePending }: {
  connected: boolean
  entries: readonly RoomLogEntry[]
  isOwner: boolean
  onRequestRoomExit: () => void
  roomExitBlocked: boolean
  roomExitBusy: boolean
  seatChangePending: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const menuID = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const roomActionDisabled = !connected || roomExitBusy || seatChangePending || roomExitBlocked

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      triggerRef.current?.focus()
    }
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
      // `click` follows the target's native mousedown focus behavior. Do not
      // prevent the outside target's action; only restore this menu's focus.
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('click', closeOnOutsideClick)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('click', closeOnOutsideClick)
    }
  }, [menuOpen])

  const openLog = () => {
    setMenuOpen(false)
    setLogOpen(true)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button aria-controls={menuOpen ? menuID : undefined} aria-expanded={menuOpen} aria-haspopup="menu" aria-label="房间操作" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border-0 bg-transparent p-0 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200" data-room-toolbar-item="room" onClick={() => setMenuOpen((open) => !open)} ref={triggerRef} title="更多房间操作" type="button">
        <Ellipsis aria-hidden="true" className="size-5" />
      </button>
      {menuOpen && <div className="absolute right-0 top-full z-50 mt-1" id={menuID}><RoomMoreMenuPanel isOwner={isOwner} onOpenLog={openLog} onRequestRoomExit={onRequestRoomExit} roomActionDisabled={roomActionDisabled} roomExitBusy={roomExitBusy} /></div>}
      <RoomLogDialog entries={entries} onClose={() => setLogOpen(false)} open={logOpen} triggerRef={triggerRef} />
    </div>
  )
}
