import { describe, expect, it } from 'vitest'

import { loadServerConfig } from '../src/config'

describe('loadServerConfig', () => {
  it('loads LAN defaults', () => {
    expect(loadServerConfig({})).toEqual({
      gamePort: 8000,
      lobbyPort: 8001,
      origins: ['http://localhost:5183'],
      devToolsEnabled: false,
      devAdminToken: undefined,
      testGameSeed: undefined,
    })
  })

  it('parses configured ports and origins', () => {
    expect(loadServerConfig({
      AVALON_GAME_PORT: '9100',
      AVALON_LOBBY_PORT: '9101',
      AVALON_ORIGINS: 'http://a.test, http://b.test',
    })).toEqual({
      gamePort: 9100,
      lobbyPort: 9101,
      origins: ['http://a.test', 'http://b.test'],
      devToolsEnabled: false,
      devAdminToken: undefined,
      testGameSeed: undefined,
    })
  })

  it('enables development tools only for an explicit flag and token', () => {
    expect(loadServerConfig({
      AVALON_DEV_TOOLS: 'true',
      AVALON_DEV_ADMIN_TOKEN: 'local-dev-token',
    })).toMatchObject({
      devToolsEnabled: true,
      devAdminToken: 'local-dev-token',
    })
  })

  it('rejects a port outside the TCP range', () => {
    expect(() => loadServerConfig({ AVALON_GAME_PORT: '65536' })).toThrow(
      'AVALON_GAME_PORT must be an integer between 0 and 65535',
    )
  })

  it('loads a deterministic game seed only in the test environment', () => {
    expect(loadServerConfig({
      NODE_ENV: 'test',
      AVALON_TEST_GAME_SEED: 'browser-replay-seed',
    }).testGameSeed).toBe('browser-replay-seed')
    expect(loadServerConfig({
      NODE_ENV: 'production',
      AVALON_TEST_GAME_SEED: 'must-be-ignored',
    }).testGameSeed).toBeUndefined()
  })
})
