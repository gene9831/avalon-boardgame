import { defineConfig } from '@playwright/test'

import { deriveAvalonSeeds } from '@avalon/test-support'

const masterSeed = process.env.E2E_MASTER_SEED ?? 'playwright-smoke'
const { gameSeed } = deriveAvalonSeeds(masterSeed)

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:5183',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  webServer: [
    {
      command: `NODE_ENV=test AVALON_STORAGE=memory AVALON_DEV_TOOLS=false AVALON_ORIGINS=http://127.0.0.1:5183 AVALON_TEST_GAME_SEED=${gameSeed} pnpm --filter @avalon/server dev`,
      url: 'http://127.0.0.1:8001/games',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'VITE_GAME_URL=http://127.0.0.1:8000 VITE_LOBBY_URL=http://127.0.0.1:8001 pnpm --filter @avalon/web exec vite --host 127.0.0.1 --port 5183',
      url: 'http://127.0.0.1:5183',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
