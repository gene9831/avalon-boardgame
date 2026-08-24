import { ScrollText, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type Ref } from 'react'

import type { RoomLogEntry } from './room-log'
import { useModalLayer } from './use-modal-layer'

export function RoomLogControl({ entries }: { entries: readonly RoomLogEntry[] }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useModalLayer({ onClose: close, open, panelRef, triggerRef })

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="查看操作日志"
        className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-300/60 hover:text-white"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        title="操作日志"
        type="button"
      >
        <ScrollText aria-hidden="true" size={20} strokeWidth={1.8} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[150]" data-room-log-overlay>
          <button
            aria-label="关闭操作日志"
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
            onClick={close}
            type="button"
          />
          <RoomLogPanel entries={entries} onClose={close} panelRef={panelRef} />
        </div>
      )}
    </>
  )
}

export function RoomLogPanel({
  entries,
  onClose,
  panelRef,
}: {
  entries: readonly RoomLogEntry[]
  onClose: () => void
  panelRef?: Ref<HTMLElement>
}) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [entries.length])

  return (
    <aside
      aria-label="操作日志"
      aria-modal="true"
      className="absolute inset-x-0 bottom-0 flex max-h-[78dvh] min-h-[20rem] flex-col rounded-t-3xl border border-b-0 border-white/15 bg-slate-950/98 shadow-2xl shadow-black/50 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:min-h-0 sm:w-[min(26rem,90vw)] sm:rounded-none sm:rounded-l-3xl sm:border-y-0 sm:border-r-0"
      ref={panelRef}
      role="dialog"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Room history</p>
          <h2 className="mt-1 text-xl font-semibold text-white">操作日志</h2>
        </div>
        <button
          aria-label="关闭操作日志"
          className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/15 text-slate-300 transition hover:border-white/35 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400">
            还没有公开操作。
          </p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => (
              <li className="relative border-l border-white/15 pl-4" key={entry.id}>
                <span className={`absolute -left-1 top-2 size-2 rounded-full ${entry.tone === 'danger' ? 'bg-rose-300' : entry.tone === 'good' ? 'bg-emerald-300' : 'bg-cyan-300'}`} />
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{entry.group}</p>
                <p className="mt-1 text-sm font-medium leading-5 text-slate-100">{entry.title}</p>
                {entry.detail !== undefined && <p className="mt-1 text-xs leading-5 text-slate-400">{entry.detail}</p>}
              </li>
            ))}
          </ol>
        )}
        <div aria-hidden="true" ref={endRef} />
      </div>
    </aside>
  )
}
