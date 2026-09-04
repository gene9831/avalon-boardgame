import { describe, expect, it } from 'vitest'

import { createDeploymentConfig } from '../src/deployment-config'

describe('createDeploymentConfig', () => {
  it('uses same-origin endpoints at the deployment root', () => {
    expect(createDeploymentConfig({
      baseURI: 'https://game.example/',
      origin: 'https://game.example',
      isDevelopment: false,
    })).toEqual({
      routerBasename: '/',
      lobbyURL: 'https://game.example',
      gameURL: 'https://game.example',
      socketPath: '/socket.io',
    })
  })

  it('derives browser-visible endpoints from a nested base URI', () => {
    expect(createDeploymentConfig({
      baseURI: 'https://game.example/one/two/avalon/',
      origin: 'https://game.example',
      isDevelopment: false,
    })).toEqual({
      routerBasename: '/one/two/avalon',
      lobbyURL: 'https://game.example/one/two/avalon',
      gameURL: 'https://game.example',
      socketPath: '/one/two/avalon/socket.io',
    })
  })

  it('keeps split game and Lobby ports during direct Vite development', () => {
    expect(createDeploymentConfig({
      baseURI: 'http://192.0.2.10:5183/',
      origin: 'http://192.0.2.10:5183',
      isDevelopment: true,
    })).toEqual({
      routerBasename: '/',
      lobbyURL: 'http://192.0.2.10:8001',
      gameURL: 'http://192.0.2.10:8000',
      socketPath: '/socket.io',
    })
  })

  it('preserves explicit split-host URL overrides', () => {
    expect(createDeploymentConfig({
      baseURI: 'https://game.example/avalon/',
      origin: 'https://game.example',
      isDevelopment: false,
      lobbyOverride: 'https://api.example/lobby',
      gameOverride: 'https://socket.example',
    })).toEqual({
      routerBasename: '/avalon',
      lobbyURL: 'https://api.example/lobby',
      gameURL: 'https://socket.example',
      socketPath: '/avalon/socket.io',
    })
  })
})
