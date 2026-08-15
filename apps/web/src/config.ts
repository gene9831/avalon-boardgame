function serverURL(port: number) {
  const protocol = window.location.protocol || 'http:'
  const hostname = window.location.hostname || 'localhost'
  return `${protocol}//${hostname}:${port}`
}

export const webConfig = {
  lobbyURL: import.meta.env.VITE_LOBBY_URL || serverURL(8001),
  gameURL: import.meta.env.VITE_GAME_URL || serverURL(8000),
} as const
