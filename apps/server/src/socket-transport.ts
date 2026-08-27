import { SocketIO as BoardgameSocketIO } from 'boardgame.io/server'

const MAX_SOCKET_MESSAGE_BYTES = 64 * 1024

type SocketListener = (...args: unknown[]) => unknown

interface SocketLike {
  conn?: { close(): void }
  disconnect(close?: boolean): void
  listeners(event: string): SocketListener[]
  on(event: string, listener: SocketListener): void
  removeListener(event: string, listener: SocketListener): void
}

interface NamespaceLike {
  listeners(event: string): Array<(socket: SocketLike) => void>
  on(event: string, listener: (socket: SocketLike) => void): void
  removeListener(event: string, listener: (socket: SocketLike) => void): void
}

function closeSocket(socket: SocketLike) {
  if (socket.conn !== undefined) {
    socket.conn.close()
  } else {
    socket.disconnect(true)
  }
}

export function hardenAvalonSocketNamespace(namespace: NamespaceLike) {
  const connectionListeners = namespace.listeners('connection')
  if (connectionListeners.length !== 1) {
    throw new Error(
      'Avalon Socket transport expected exactly one boardgame.io connection listener',
    )
  }

  const boardgameConnection = connectionListeners[0]
  namespace.removeListener('connection', boardgameConnection)
  namespace.on('connection', (socket) => {
    boardgameConnection.call(namespace, socket)
    for (const listener of socket.listeners('chat')) {
      socket.removeListener('chat', listener)
    }
    socket.on('chat', () => {
      console.warn('Socket.IO protocol rejected', {
        event: 'chat',
        code: 'protocol_not_available',
      })
      closeSocket(socket)
    })
  })
}

type SocketOptions = NonNullable<ConstructorParameters<typeof BoardgameSocketIO>[0]>

export class AvalonSocketIO extends BoardgameSocketIO {
  constructor(options: SocketOptions = {}) {
    super({
      ...options,
      socketOpts: {
        ...options.socketOpts,
        maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
      } as SocketOptions['socketOpts'],
    })
  }

  override init(...args: Parameters<BoardgameSocketIO['init']>) {
    super.init(...args)
    const [app, games] = args
    if (app._io === undefined) {
      throw new Error('Avalon Socket transport requires a Socket.IO server')
    }
    for (const game of games) {
      if (game.name === undefined) {
        throw new Error('Avalon Socket transport requires every game to have a name')
      }
      hardenAvalonSocketNamespace(
        app._io.of(game.name) as unknown as NamespaceLike,
      )
    }
  }
}
