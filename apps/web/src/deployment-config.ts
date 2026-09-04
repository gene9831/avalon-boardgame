export interface DeploymentConfigInput {
  baseURI: string
  origin: string
  isDevelopment: boolean
  lobbyOverride?: string
  gameOverride?: string
}

export interface DeploymentConfig {
  routerBasename: string
  lobbyURL: string
  gameURL: string
  socketPath: string
}

function normalizeBasePath(baseURI: string) {
  const pathname = new URL(baseURI).pathname
  const leadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  return leadingSlash.endsWith('/') ? leadingSlash : `${leadingSlash}/`
}

function withPort(origin: string, port: number) {
  const url = new URL(origin)
  url.port = String(port)
  return url.origin
}

export function createDeploymentConfig({
  baseURI,
  origin,
  isDevelopment,
  lobbyOverride,
  gameOverride,
}: DeploymentConfigInput): DeploymentConfig {
  const basePath = normalizeBasePath(baseURI)
  const routerBasename = basePath === '/' ? '/' : basePath.slice(0, -1)

  return {
    routerBasename,
    lobbyURL: lobbyOverride || (
      isDevelopment ? withPort(origin, 8001) : `${origin}${routerBasename === '/' ? '' : routerBasename}`
    ),
    gameURL: gameOverride || (isDevelopment ? withPort(origin, 8000) : origin),
    socketPath: `${basePath}socket.io`,
  }
}
