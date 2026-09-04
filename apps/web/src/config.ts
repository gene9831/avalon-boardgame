import { createDeploymentConfig } from './deployment-config'

export const webConfig = createDeploymentConfig({
  baseURI: document.baseURI,
  origin: window.location.origin,
  isDevelopment: import.meta.env.DEV,
  lobbyOverride: import.meta.env.VITE_LOBBY_URL,
  gameOverride: import.meta.env.VITE_GAME_URL,
})
