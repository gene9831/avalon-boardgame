export interface AvalonServerConfig {
  gamePort: number
  lobbyPort: number
  origins: string[]
}

const DEFAULT_GAME_PORT = 8000
const DEFAULT_LOBBY_PORT = 8001
const DEFAULT_ORIGINS = ['http://localhost:5173']

function parsePort(name: string, rawValue: string | undefined, fallback: number) {
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback
  }

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error(`${name} must be an integer between 0 and 65535`)
  }

  return value
}

function parseOrigins(rawValue: string | undefined) {
  if (rawValue === undefined || rawValue.trim() === '') {
    return [...DEFAULT_ORIGINS]
  }

  const origins = rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (origins.length === 0) {
    throw new Error('AVALON_ORIGINS must contain at least one origin')
  }

  return origins
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): AvalonServerConfig {
  return {
    gamePort: parsePort('AVALON_GAME_PORT', env.AVALON_GAME_PORT, DEFAULT_GAME_PORT),
    lobbyPort: parsePort('AVALON_LOBBY_PORT', env.AVALON_LOBBY_PORT, DEFAULT_LOBBY_PORT),
    origins: parseOrigins(env.AVALON_ORIGINS),
  }
}
