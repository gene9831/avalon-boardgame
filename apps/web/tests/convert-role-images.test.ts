import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

describe('role image conversion', () => {
  it('generates common responsive widths plus each source image native width', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'avalon-role-images-'))
    const realWebRoot = fileURLToPath(new URL('..', import.meta.url))
    const fixtureWebRoot = path.join(fixtureRoot, 'apps/web')
    const fixtureScriptDir = path.join(fixtureWebRoot, 'scripts')
    const fixtureSourceDir = path.join(fixtureRoot, 'images/source/roles')
    const fixtureOutputDir = path.join(fixtureWebRoot, 'public/images/roles')
    const fixtureScript = path.join(fixtureScriptDir, 'convert-role-images.mjs')

    try {
      await Promise.all([
        mkdir(fixtureScriptDir, { recursive: true }),
        mkdir(fixtureSourceDir, { recursive: true }),
        mkdir(fixtureOutputDir, { recursive: true }),
      ])
      await copyFile(
        path.join(realWebRoot, 'scripts/convert-role-images.mjs'),
        fixtureScript,
      )
      await symlink(
        path.join(realWebRoot, 'node_modules'),
        path.join(fixtureWebRoot, 'node_modules'),
        'dir',
      )
      await Promise.all([
        sharp({
          create: {
            background: '#164e63',
            channels: 3,
            height: 1127,
            width: 752,
          },
        }).png().toFile(path.join(fixtureSourceDir, 'Merlin.png')),
        sharp({
          create: {
            background: '#451a03',
            channels: 3,
            height: 1051,
            width: 674,
          },
        }).png().toFile(path.join(fixtureSourceDir, 'Assassin.png')),
      ])

      const result = spawnSync(process.execPath, [fixtureScript], {
        encoding: 'utf8',
      })

      expect(result.status, result.stderr).toBe(0)
      expect((await readdir(fixtureOutputDir)).sort()).toEqual([
        'assassin-320.webp',
        'assassin-480.webp',
        'assassin-674.webp',
        'merlin-320.webp',
        'merlin-480.webp',
        'merlin-752.webp',
      ])
      await expect(sharp(path.join(fixtureOutputDir, 'merlin-752.webp')).metadata())
        .resolves.toMatchObject({ format: 'webp', height: 1127, width: 752 })
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true })
    }
  })
})
