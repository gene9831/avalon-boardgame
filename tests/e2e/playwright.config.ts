import { randomUUID } from 'node:crypto'

import { defineConfig } from '@playwright/test'

import { deriveAvalonSeeds } from '@avalon/test-support'

const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
const { gameSeed } = deriveAvalonSeeds(masterSeed)
const devAdminToken = randomUUID()
const gamePort = 18_000
const lobbyPort = 18_001
const webPort = 15_183
const webURL = `http://127.0.0.1:${webPort}`

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: webURL,
    screenshot: 'only-on-failure',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  webServer: [
    {
      command: `NODE_ENV=test AVALON_STORAGE=memory AVALON_GAME_PORT=${gamePort} AVALON_LOBBY_PORT=${lobbyPort} AVALON_DEV_TOOLS=true AVALON_DEV_ADMIN_TOKEN=${devAdminToken} AVALON_ORIGINS=${webURL} AVALON_TEST_GAME_SEED=${gameSeed} pnpm --filter @avalon/server dev`,
      url: `http://127.0.0.1:${lobbyPort}/rooms/avalon`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `VITE_GAME_URL=http://127.0.0.1:${gamePort} VITE_LOBBY_URL=http://127.0.0.1:${lobbyPort} pnpm --filter @avalon/web exec vite --host 127.0.0.1 --port ${webPort}`,
      url: webURL,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
