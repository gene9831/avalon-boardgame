import { MemoryStorage } from './memory'
import { PostgresStorage } from './postgres'

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is required when AVALON_STORAGE=postgres`)
  }
  return value
}

function requiredPort(value: string | undefined) {
  const rawPort = value?.trim()
  const port = Number(rawPort)
  if (
    rawPort === undefined ||
    rawPort === '' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'PGPORT must be an integer between 1 and 65535 when AVALON_STORAGE=postgres',
    )
  }
  return port
}

export function createConfiguredStorage(
  env: NodeJS.ProcessEnv = process.env,
): MemoryStorage | PostgresStorage {
  const storageMode = env.AVALON_STORAGE

  if (storageMode === 'memory') return new MemoryStorage()
  if (storageMode !== undefined && storageMode !== 'postgres') {
    throw new Error('AVALON_STORAGE must be either postgres or memory')
  }

  const connectionString = env.DATABASE_URL
  if (connectionString !== undefined && connectionString.trim() !== '') {
    return new PostgresStorage({ connectionString })
  }

  if (storageMode === 'postgres') {
    return new PostgresStorage({
      connection: {
        host: required(env, 'PGHOST'),
        port: requiredPort(env.PGPORT),
        database: required(env, 'PGDATABASE'),
        user: required(env, 'PGUSER'),
        password: required(env, 'PGPASSWORD'),
      },
    })
  }

  if (env.NODE_ENV === 'test') return new MemoryStorage()

  throw new Error(
    'PostgreSQL configuration is required outside tests; set AVALON_STORAGE=memory only for local ephemeral development',
  )
}
