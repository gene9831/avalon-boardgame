import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ConnectionRecoveryTimer,
  MANUAL_RECONNECT_DELAY_MS,
} from '../src/connection-recovery'

afterEach(() => {
  vi.useRealTimers()
})

describe('ConnectionRecoveryTimer', () => {
  it('offers manual reconnect only after eight continuous disconnected seconds', () => {
    vi.useFakeTimers()
    const changes: boolean[] = []
    const recovery = new ConnectionRecoveryTimer((available) => changes.push(available))

    recovery.setConnection(true, false)
    vi.advanceTimersByTime(MANUAL_RECONNECT_DELAY_MS - 1)
    expect(changes.at(-1)).toBe(false)

    vi.advanceTimersByTime(1)
    expect(changes.at(-1)).toBe(true)
  })

  it('resets the delay after recovery and after a manual retry', () => {
    vi.useFakeTimers()
    const changes: boolean[] = []
    const recovery = new ConnectionRecoveryTimer((available) => changes.push(available))

    recovery.setConnection(true, false)
    vi.advanceTimersByTime(MANUAL_RECONNECT_DELAY_MS - 1)
    recovery.setConnection(true, true)
    recovery.setConnection(true, false)
    vi.advanceTimersByTime(MANUAL_RECONNECT_DELAY_MS - 1)
    expect(changes.at(-1)).toBe(false)

    vi.advanceTimersByTime(1)
    expect(changes.at(-1)).toBe(true)

    recovery.retry()
    expect(changes.at(-1)).toBe(false)
    vi.advanceTimersByTime(MANUAL_RECONNECT_DELAY_MS - 1)
    expect(changes.at(-1)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(changes.at(-1)).toBe(true)
  })
})
