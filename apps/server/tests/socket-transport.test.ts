import { EventEmitter } from 'node:events'

import { io, type Socket } from 'socket.io-client'
import { describe, expect, it, vi } from 'vitest'

import {
  hardenAvalonSocketNamespace,
} from '../src/socket-transport'
import { startAvalonServer } from '../src/server'
import { MemoryStorage } from '../src/storage/memory'
import { AvalonTestLobbyClient } from './support/lobby-client'

const config = {
  gamePort: 0,
  lobbyPort: 0,
  origins: ['*'],
  devToolsEnabled: false,
}

function waitForEvent(socket: Socket, event: string, timeoutMs = 3_000) {
  return new Promise<unknown[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`Timed out waiting for Socket.IO ${event}`))
    }, timeoutMs)
    const onEvent = (...args: unknown[]) => {
      clearTimeout(timeout)
      resolve(args)
    }
    socket.once(event, onEvent)
  })
}

function connectSocket(port: number) {
  return io(`http://127.0.0.1:${port}/avalon`, {
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  })
}

describe('Avalon Socket.IO transport contract', () => {
  it('fails closed unless boardgame.io installs exactly one connection hook', () => {
    const emptyNamespace = new EventEmitter()
    expect(() => hardenAvalonSocketNamespace(emptyNamespace as never)).toThrow(
      'expected exactly one boardgame.io connection listener',
    )

    const duplicateNamespace = new EventEmitter()
    duplicateNamespace.on('connection', () => undefined)
    duplicateNamespace.on('connection', () => undefined)
    expect(() => hardenAvalonSocketNamespace(duplicateNamespace as never)).toThrow(
      'expected exactly one boardgame.io connection listener',
    )
  })

  it('preserves dependency listeners but replaces chat with a closed connection', () => {
    const namespace = new EventEmitter()
    const socket = new EventEmitter() as EventEmitter & {
      conn: { close: ReturnType<typeof vi.fn> }
      disconnect: ReturnType<typeof vi.fn>
    }
    socket.conn = { close: vi.fn() }
    socket.disconnect = vi.fn()
    const dependencyChat = vi.fn()
    namespace.on('connection', (connectedSocket: typeof socket) => {
      connectedSocket.on('sync', () => undefined)
      connectedSocket.on('chat', dependencyChat)
    })
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      hardenAvalonSocketNamespace(namespace as never)
      namespace.emit('connection', socket)

      expect(socket.listenerCount('sync')).toBe(1)
      expect(socket.listenerCount('chat')).toBe(1)
      socket.emit('chat', 'room-1', { sender: '0', payload: 'secret' }, 'credential')
      expect(dependencyChat).not.toHaveBeenCalled()
      expect(socket.conn.close).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledWith('Socket.IO protocol rejected', {
        event: 'chat',
        code: 'protocol_not_available',
      })
    } finally {
      log.mockRestore()
    }
  })

  it('disconnects a chat sender without broadcasting or mutating the room', async () => {
    const storage = new MemoryStorage()
    const running = await startAvalonServer({ config, db: storage })
    const lobby = new AvalonTestLobbyClient({
      server: `http://127.0.0.1:${running.lobbyPort}`,
    })
    let sender: Socket | undefined
    let peer: Socket | undefined

    try {
      const { matchID } = await lobby.createMatch('avalon', { numPlayers: 5 })
      const alice = await lobby.joinMatch('avalon', matchID, {
        playerID: '0',
        playerName: 'Alice',
      })
      const bob = await lobby.joinMatch('avalon', matchID, {
        playerID: '1',
        playerName: 'Bob',
      })
      sender = connectSocket(running.gamePort)
      peer = connectSocket(running.gamePort)
      await Promise.all([
        waitForEvent(sender, 'connect'),
        waitForEvent(peer, 'connect'),
      ])
      const peerSync = waitForEvent(peer, 'sync')
      peer.emit('sync', matchID, bob.playerID, bob.playerCredentials, 5)
      await peerSync
      const chatReceived = vi.fn()
      peer.on('chat', chatReceived)
      const before = JSON.stringify(storage.fetch(matchID, {
        metadata: true,
        state: true,
      }))
      const disconnected = waitForEvent(sender, 'disconnect')

      sender.emit('chat', matchID, {
        id: 'message-1',
        sender: alice.playerID,
        payload: 'must-not-broadcast',
      }, alice.playerCredentials)

      await disconnected
      await new Promise<void>((resolve) => setTimeout(resolve, 25))
      expect(chatReceived).not.toHaveBeenCalled()
      expect(JSON.stringify(storage.fetch(matchID, {
        metadata: true,
        state: true,
      }))).toBe(before)
    } finally {
      sender?.close()
      peer?.close()
      await running.close()
    }
  })

  it('disconnects a client message larger than 64 KiB', async () => {
    const running = await startAvalonServer({ config, db: new MemoryStorage() })
    const socket = connectSocket(running.gamePort)

    try {
      await waitForEvent(socket, 'connect')
      const disconnected = waitForEvent(socket, 'disconnect')
      socket.emit('sync', 'x'.repeat(65 * 1024), '0', 'credential', 5)
      await disconnected
      expect(socket.connected).toBe(false)
    } finally {
      socket.close()
      await running.close()
    }
  })
})
