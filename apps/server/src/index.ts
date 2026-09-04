import { loadServerConfig } from './config'
import { startAvalonServer } from './server'

const running = await startAvalonServer({ config: loadServerConfig() })

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  await running.close()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

console.log(
  `Avalon game server listening on ${running.gamePort}; ` +
    `Lobby API listening on ${running.lobbyPort}`,
)
