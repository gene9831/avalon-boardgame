import { loadServerConfig } from './config'
import { startAvalonServer } from './server'

const running = await startAvalonServer({ config: loadServerConfig() })

console.log(
  `Avalon game server listening on ${running.gamePort}; ` +
    `Lobby API listening on ${running.lobbyPort}`,
)

const shutdown = () => {
  running.close()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
