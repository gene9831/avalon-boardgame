import { copyFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const serverRoot = fileURLToPath(new URL('../', import.meta.url))
const gameEntry = fileURLToPath(
  new URL('../../../packages/game/src/index.ts', import.meta.url),
)
const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url))

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })
await build({
  absWorkingDir: serverRoot,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['node-persist', 'pg'],
  alias: { '@avalon/game': gameEntry },
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module'",
      'const require = __createRequire(import.meta.url)',
    ].join('\n'),
  },
  legalComments: 'none',
  logLevel: 'info',
})
await copyFile(
  new URL('../src/storage/schema.sql', import.meta.url),
  new URL('../dist/schema.sql', import.meta.url),
)
