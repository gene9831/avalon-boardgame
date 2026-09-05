import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
const roleAvatars = [
  'assassin',
  'loyal-servant',
  'merlin',
  'minion-of-mordred',
  'mordred',
  'morgana',
  'oberon',
  'percival',
] as const

describe('generated role avatar assets', () => {
  it.each(roleAvatars)('%s is an opaque 256px sRGB WebP', async (role) => {
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
