import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  appendToast,
  ToastContext,
  type ToastInput,
  type ToastMessage,
} from './toast-context'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextID = useRef(0)
  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])
  const pushToast = useCallback((input: ToastInput) => {
    nextID.current += 1
    const id = `toast-${nextID.current}`
    setToasts((current) => appendToast(current, {
      id,
      message: input.message,
      tone: input.tone ?? 'info',
    }))
    return id
  }, [])

  return (
    <ToastContext.Provider value={{ dismissToast, pushToast }}>
      {children}
      <ToastViewport onDismiss={dismissToast} toasts={toasts} />
    </ToastContext.Provider>
  )
}

export function ToastViewport({
  onDismiss,
  toasts,
}: {
  onDismiss: (id: string) => void
  toasts: readonly ToastMessage[]
}) {
  return (
    <section
      aria-label="系统通知"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[200] flex flex-col items-center gap-2 px-3 sm:left-auto sm:right-4 sm:top-4 sm:w-[min(24rem,calc(100vw-2rem))] sm:items-stretch sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} onDismiss={onDismiss} toast={toast} />
      ))}
    </section>
  )
}

function ToastItem({
  onDismiss,
  toast,
}: {
  onDismiss: (id: string) => void
  toast: ToastMessage
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      toast.tone === 'error' ? 8_000 : 4_000,
    )
    return () => window.clearTimeout(timer)
  }, [onDismiss, toast.id, toast.tone])

  const classes = toast.tone === 'error'
    ? 'border-rose-300/35 bg-rose-950/95 text-rose-50'
    : toast.tone === 'success'
      ? 'border-emerald-300/35 bg-emerald-950/95 text-emerald-50'
      : 'border-cyan-300/35 bg-slate-950/95 text-cyan-50'

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl shadow-black/35 backdrop-blur ${classes}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="mt-0.5 min-w-0 flex-1 leading-5">{toast.message}</span>
      <button
        aria-label="关闭通知"
        className="grid size-12 shrink-0 place-items-center rounded-lg text-lg leading-none text-current/70 transition hover:bg-white/10 hover:text-current"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        ×
      </button>
    </div>
  )
}
