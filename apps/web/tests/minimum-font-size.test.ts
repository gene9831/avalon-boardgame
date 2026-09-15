import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
const auditScript = path.join(webRoot, 'scripts/check-minimum-font-size.mjs')

function runAudit(sourceRoot: string) {
  return spawnSync(process.execPath, [auditScript, sourceRoot], {
    encoding: 'utf8',
  })
}

describe('minimum visible font size audit', () => {
  it('reports imported CSS and Tailwind arbitrary font sizes below 12px', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'avalon-font-size-'))

    try {
      await mkdir(path.join(fixtureRoot, 'src'))
      await writeFile(
        path.join(fixtureRoot, 'src/component.tsx'),
        "import './style.css'\nexport const label = <span className=\"text-[0.68rem]\">Label</span>\n",
      )
      await writeFile(
        path.join(fixtureRoot, 'src/style.css'),
        '.label { font-size: 10px; }\n.badge { font: 600 0.55rem/1 sans-serif; }\n',
      )

      const result = runAudit(path.join(fixtureRoot, 'src'))

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('component.tsx:2')
      expect(result.stdout).toContain('style.css:1')
      expect(result.stdout).toContain('style.css:2')
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true })
    }
  })

  it('accepts 10px only for explicitly marked standalone numeric text', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'avalon-font-size-'))

    try {
      await mkdir(path.join(fixtureRoot, 'src'))
      await writeFile(
        path.join(fixtureRoot, 'src/component.tsx'),
        "import './style.css'\nexport const label = <span className=\"text-[0.75rem]\">Label</span>\nexport const number = <span data-numeric-text=\"true\">10</span>\n",
      )
      await writeFile(
        path.join(fixtureRoot, 'src/style.css'),
        '.label { font-size: 12px; }\n.badge { font: 600 0.75rem/1 sans-serif; }\n[data-numeric-text=\'true\'] { font-size: 10px; }\n',
      )

      const result = runAudit(path.join(fixtureRoot, 'src'))

      expect(result.status, result.stderr).toBe(0)
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true })
    }
  })

  it('rejects explicitly marked numeric text below 10px', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'avalon-font-size-'))

    try {
      await mkdir(path.join(fixtureRoot, 'src'))
      await writeFile(
        path.join(fixtureRoot, 'src/component.tsx'),
        "import './style.css'\nexport const number = <span data-numeric-text=\"true\">8</span>\n",
      )
      await writeFile(
        path.join(fixtureRoot, 'src/style.css'),
        "[data-numeric-text='true'] { font-size: 9px; }\n",
      )

      const result = runAudit(path.join(fixtureRoot, 'src'))

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('style.css:1')
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true })
    }
  })

  it('keeps regular Web text at 12px and marked standalone numbers at 10px or larger', () => {
    const result = runAudit(path.join(webRoot, 'src'))

    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0)
  })
})
