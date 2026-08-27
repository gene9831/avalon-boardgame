import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { AvalonSocketRegistry } from '../src/dev-admin'

describe('Avalon Socket.IO error boundary', () => {
  it('handles a rejected sync request without leaking the rejection', async () => {
    const namespace = new EventEmitter()
    const socket = new EventEmitter() as EventEmitter & {
      id: string
      conn: { close: ReturnType<typeof vi.fn> }
      disconnect: ReturnType<typeof vi.fn>
    }
    socket.id = 'socket-1'
    socket.conn = { close: vi.fn() }
    socket.disconnect = vi.fn()
    const error = Object.assign(new Error('connect ETIMEDOUT'), {
      code: 'ETIMEDOUT',
    })
    namespace.on('connection', (connectedSocket: typeof socket) => {
      connectedSocket.on('sync', async () => {
        throw error
      })
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const registry = new AvalonSocketRegistry()

    try {
      registry.attach(namespace as never)
      namespace.emit('connection', socket)

      const results = socket.listeners('sync').map((listener) => (
        listener('match-1', '0', 'private-credential')
      ))
      const settled = await Promise.allSettled(
        results.map((result) => Promise.resolve(result)),
      )

      expect(settled.every(({ status }) => status === 'fulfilled')).toBe(true)
      expect(socket.conn.close).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledWith('Socket.IO request failed', {
        event: 'sync',
        code: 'ETIMEDOUT',
      })
    } finally {
      log.mockRestore()
    }
  })
})
