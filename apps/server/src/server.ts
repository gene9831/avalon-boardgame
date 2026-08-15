import type { AddressInfo } from 'node:net'

import type { StorageAPI } from 'boardgame.io'
import { Server as createBoardgameServer } from 'boardgame.io/server'

import { AvalonGame } from '@avalon/game'

import { loadServerConfig, type AvalonServerConfig } from './config'
import { MemoryStorage } from './storage/memory'

type BoardgameServer = ReturnType<typeof createBoardgameServer>
type ServerHandles = Awaited<ReturnType<BoardgameServer['run']>>
type BoardgameGame = Parameters<typeof createBoardgameServer>[0]['games'][number]

export interface AvalonServerOptions {
  config?: AvalonServerConfig
  db?: StorageAPI.Sync | StorageAPI.Async
}

export interface RunningAvalonServer {
  config: AvalonServerConfig
  boardgame: BoardgameServer
  servers: ServerHandles
  gamePort: number
  lobbyPort: number
  close: () => void
}

function getPort(server: NonNullable<ServerHandles['appServer']>) {
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Avalon server must listen on a TCP port')
  }

  return (address as AddressInfo).port
}

export function createAvalonServer(options: AvalonServerOptions = {}) {
  const config = options.config ?? loadServerConfig()
  const db = options.db ?? new MemoryStorage()
  const boardgame = createBoardgameServer({
    games: [AvalonGame as unknown as BoardgameGame],
    db,
    origins: config.origins,
    apiOrigins: config.origins,
  })

  return { boardgame, config }
}

export async function startAvalonServer(
  options: AvalonServerOptions = {},
): Promise<RunningAvalonServer> {
  const { boardgame, config } = createAvalonServer(options)
  const servers = await boardgame.run({
    port: config.gamePort,
    lobbyConfig: { apiPort: config.lobbyPort },
  })
  let closed = false

  return {
    boardgame,
    config,
    servers,
    gamePort: getPort(servers.appServer),
    lobbyPort: getPort(servers.apiServer ?? servers.appServer),
    close: () => {
      if (closed) return
      closed = true
      boardgame.kill(servers)
    },
  }
}
