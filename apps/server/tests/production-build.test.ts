import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const serverRoot = fileURLToPath(new URL('../', import.meta.url))

it('starts and stops the production JavaScript artifact with standard Node', async () => {
  await execFileAsync(process.execPath, ['scripts/build.mjs'], { cwd: serverRoot })

  const child = execFile(
    process.execPath,
    ['dist/index.js'],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        AVALON_STORAGE: 'memory',
        AVALON_GAME_PORT: '0',
        AVALON_LOBBY_PORT: '0',
        AVALON_ORIGINS: '*',
      },
    },
  )

  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
  child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
  const exitPromise = once(child, 'exit')

  try {
    await Promise.race([
      new Promise<void>((resolve) => {
        child.stdout?.on('data', () => {
          if (stdout.includes('Avalon game server listening')) resolve()
        })
      }),
      exitPromise.then(([code]) => {
        throw new Error(`production server exited early (${String(code)}): ${stderr}`)
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`production server did not start: ${stderr}`)), 5_000)
      }),
    ])
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
  }

  const [code] = await exitPromise
  expect(code).toBe(0)
}, 10_000)
