import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'
import type { Server } from 'boardgame.io'

import { AvalonSocketRegistry } from '../src/dev-admin'

describe('Avalon Socket.IO error boundary', () => {
  it('broadcasts updated match data to the room without credentials', () => {
    const namespace = new EventEmitter()
    namespace.on('connection', (connectedSocket: EventEmitter) => {
      connectedSocket.on('sync', () => undefined)
    })
    const registry = new AvalonSocketRegistry()
    registry.attach(namespace as never)
    const createSocket = (id: string) => {
      const socket = new EventEmitter() as EventEmitter & {
        id: string
        conn: { close: ReturnType<typeof vi.fn> }
        disconnect: ReturnType<typeof vi.fn>
      }
      socket.id = id
      socket.conn = { close: vi.fn() }
      socket.disconnect = vi.fn()
      return socket
    }
    const first = createSocket('socket-1')
    const second = createSocket('socket-2')
    const outside = createSocket('socket-3')
    const firstMatchData = vi.fn()
    const secondMatchData = vi.fn()
    const outsideMatchData = vi.fn()
    first.on('matchData', firstMatchData)
    second.on('matchData', secondMatchData)
    outside.on('matchData', outsideMatchData)
    namespace.emit('connection', first)
    namespace.emit('connection', second)
    namespace.emit('connection', outside)
    first.emit('sync', 'match-1', '0')
    second.emit('sync', 'match-1', '1')
    outside.emit('sync', 'match-2', '0')
    const metadata = {
      gameName: 'avalon',
      unlisted: false,
      id: 'match-1',
      players: {
        0: {
          id: 0,
          name: 'Alice',
          credentials: 'private-alice',
          isConnected: true,
          data: { avatarID: 'merlin', sessionID: 'session-alice' },
        },
        1: {
          id: 1,
          name: 'Morgan',
          credentials: 'private-morgan',
          isConnected: true,
          data: { avatarID: 'morgana', sessionID: 'session-morgan' },
        },
      },
      setupData: { numPlayers: 5 },
      createdAt: 1,
      updatedAt: 2,
    } as Server.MatchData

    registry.broadcastMatchData('match-1', metadata)

    const publicPlayers = [
      {
        id: 0,
        name: 'Alice',
        isConnected: true,
        data: { avatarID: 'merlin', sessionID: 'session-alice' },
      },
      {
        id: 1,
        name: 'Morgan',
        isConnected: true,
        data: { avatarID: 'morgana', sessionID: 'session-morgan' },
      },
    ]
    expect(firstMatchData).toHaveBeenCalledWith('match-1', publicPlayers)
    expect(secondMatchData).toHaveBeenCalledWith('match-1', publicPlayers)
    expect(outsideMatchData).not.toHaveBeenCalled()
  })

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
