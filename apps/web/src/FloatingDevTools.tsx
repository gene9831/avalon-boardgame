import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Bug } from 'lucide-react'

const focusableSelector = 'input, button, select, textarea, [href], [tabindex]:not([tabindex="-1"])'

export interface FloatingDevToolsProps {
  children?: ReactNode
  enabled: boolean
  error: string | null
  onTokenChange: (value: string) => void
  token: string
}

export function FloatingDevTools({
  children,
  enabled,
  error,
  onTokenChange,
  token,
}: FloatingDevToolsProps) {
  const [open, setOpen] = useState(false)
  const panelID = useId()
  const titleID = useId()
  const tokenID = useId()
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus()
      wasOpenRef.current = false
      return
    }

    wasOpenRef.current = true
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || panelRef.current === null) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable.at(-1)!
      const activeElement = document.activeElement
      if (!panelRef.current.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!enabled) setOpen(false)
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      <button
        aria-controls={panelID}
        aria-expanded={open}
        aria-label={open ? '关闭开发控制' : '打开开发控制'}
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[70] grid size-12 place-items-center rounded-full border text-violet-100 shadow-2xl shadow-black/40 backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${open ? 'border-violet-200/70 bg-violet-500/90' : 'border-violet-300/30 bg-slate-900/95 hover:border-violet-300/70 hover:text-white'}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title="开发控制"
        type="button"
      >
        <Bug aria-hidden="true" className="size-5" />
        {error !== null && (
          <span
            aria-label="开发控制有错误"
            className="absolute right-0 top-0 size-3 rounded-full border-2 border-slate-900 bg-rose-400"
            role="status"
          />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section
            aria-labelledby={titleID}
            aria-modal="true"
            className="absolute inset-x-0 bottom-0 max-h-[min(70dvh,32rem)] overflow-y-auto overscroll-contain rounded-t-3xl border border-violet-300/20 bg-slate-900/98 px-5 pb-[max(5rem,calc(env(safe-area-inset-bottom)+4rem))] pt-5 text-sm text-slate-200 shadow-2xl shadow-black/60 sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)] sm:left-auto sm:right-[max(1rem,env(safe-area-inset-right))] sm:w-96 sm:rounded-3xl sm:p-6"
            id={panelID}
            ref={panelRef}
            role="dialog"
          >
            <div className="flex items-center gap-3">
              <Bug aria-hidden="true" className="size-5 text-violet-300" />
              <h2 className="font-semibold text-violet-100" id={titleID}>开发控制</h2>
            </div>

            <label className="mt-5 block text-slate-300" htmlFor={tokenID}>
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-violet-300">
                开发管理员 Token
              </span>
              <input
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 font-mono text-white outline-none focus:border-violet-300/60"
                id={tokenID}
                onChange={(event) => onTokenChange(event.target.value)}
                placeholder="仅保存在当前页面内"
                type="password"
                value={token}
              />
            </label>

            {children !== undefined && <div className="mt-5 space-y-4">{children}</div>}
            {error !== null && (
              <p className="mt-5 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2.5 text-rose-100">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  )
}
