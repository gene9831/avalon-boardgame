import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
const roleAvatars = [
  { master: 'Assassin', masterSize: 1051, role: 'assassin' },
  { master: 'Loyal-Servant', masterSize: 1010, role: 'loyal-servant' },
  { master: 'Merlin', masterSize: 1127, role: 'merlin' },
  { master: 'Minion', masterSize: 1010, role: 'minion-of-mordred' },
  { master: 'Mordred', masterSize: 1127, role: 'mordred' },
  { master: 'Morgana', masterSize: 1127, role: 'morgana' },
  { master: 'Oberon', masterSize: 1127, role: 'oberon' },
  { master: 'Percival', masterSize: 1127, role: 'percival' },
] as const

describe('generated role avatar assets', () => {
  it.each(roleAvatars)(
    '$role keeps its square opaque sRGB PNG master',
    async ({ master, masterSize }) => {
      const masterPath = path.join(
        webRoot,
        `../../images/source/role-avatars/${master}.png`,
      )

      expect(existsSync(masterPath)).toBe(true)

      const metadata = await sharp(masterPath).metadata()

      expect(metadata).toMatchObject({
        channels: 3,
        depth: 'uchar',
        format: 'png',
        hasAlpha: false,
        height: masterSize,
        space: 'srgb',
        width: masterSize,
      })
    },
  )

  it.each(roleAvatars)('$role is an opaque 256px sRGB WebP', async ({ role }) => {
    const webpPath = path.join(webRoot, `src/assets/roles/${role}.webp`)

    expect(existsSync(webpPath)).toBe(true)

    const metadata = await sharp(webpPath).metadata()

    expect(metadata).toMatchObject({
      channels: 3,
      depth: 'uchar',
      format: 'webp',
      hasAlpha: false,
      height: 256,
      space: 'srgb',
      width: 256,
    })
  })
})
