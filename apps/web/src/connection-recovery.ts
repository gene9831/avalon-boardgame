export const MANUAL_RECONNECT_DELAY_MS = 8_000

export class ConnectionRecoveryTimer {
  private active = false
  private connected = true
  private readonly onAvailabilityChange: (available: boolean) => void
  private timeout: ReturnType<typeof globalThis.setTimeout> | null = null

  constructor(onAvailabilityChange: (available: boolean) => void) {
    this.onAvailabilityChange = onAvailabilityChange
  }

  setConnection(active: boolean, connected: boolean) {
    this.active = active
    this.connected = connected
    this.restart()
  }

  retry() {
    this.restart()
  }

  suspend() {
    if (this.timeout !== null) {
      globalThis.clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  private restart() {
    this.suspend()
    this.onAvailabilityChange(false)

    if (!this.active || this.connected) return

    this.timeout = globalThis.setTimeout(() => {
      this.timeout = null
      this.onAvailabilityChange(true)
    }, MANUAL_RECONNECT_DELAY_MS)
  }
}
