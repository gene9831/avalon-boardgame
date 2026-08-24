import { RefreshCw } from 'lucide-react'

interface ConnectionRecoveryControlProps {
  connected: boolean
  manualReconnectAvailable: boolean
  onReconnect: () => void
}

export function ConnectionRecoveryControl({
  connected,
  manualReconnectAvailable,
  onReconnect,
}: ConnectionRecoveryControlProps) {
  if (connected) return null

  if (manualReconnectAvailable) {
    return (
      <button
        aria-label="重连"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-rose-300/40 bg-rose-300/10 px-2 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/80 hover:bg-rose-300/20 sm:px-3"
        onClick={onReconnect}
        title="重连"
        type="button"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">重连</span>
      </button>
    )
  }

  return (
    <span
      aria-label="正在重连"
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-amber-300/10 px-2 py-2 text-xs font-semibold text-amber-100 sm:px-3"
      role="status"
      title="正在重连"
    >
      <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
      <span className="hidden sm:inline">正在重连</span>
    </span>
  )
}
