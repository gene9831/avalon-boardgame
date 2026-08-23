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
        className="min-h-11 rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/80 hover:bg-rose-300/20"
        onClick={onReconnect}
        type="button"
      >
        重连
      </button>
    )
  }

  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100" role="status">
      <span className="size-2 animate-pulse rounded-full bg-amber-300" />
      正在重连
    </span>
  )
}
