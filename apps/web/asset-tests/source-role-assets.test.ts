import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = path.resolve(webRoot, '../..')
const lfsPointerHeader = 'version https://git-lfs.github.com/spec/v1'

const roleArtworkMasters = [
  { filename: 'Assassin.png', height: 1051, width: 674 },
  { filename: 'Loyal-Servant.png', height: 1010, width: 674 },
  { filename: 'Merlin.png', height: 1127, width: 752 },
  { filename: 'Minion.png', height: 1010, width: 674 },
  { filename: 'Mordred.png', height: 1127, width: 752 },
  { filename: 'Morgana.png', height: 1127, width: 752 },
  { filename: 'Oberon.png', height: 1127, width: 752 },
  { filename: 'Percival.png', height: 1127, width: 752 },
  { filename: '_Assassin(Original).png', height: 1051, width: 674 },
] as const

const roleAvatarMasters = [
  { filename: 'Assassin.png', size: 1051 },
  { filename: 'Loyal-Servant.png', size: 1010 },
  { filename: 'Merlin.png', size: 1127 },
  { filename: 'Minion.png', size: 1010 },
  { filename: 'Mordred.png', size: 1127 },
  { filename: 'Morgana.png', size: 1127 },
  { filename: 'Oberon.png', size: 1127 },
  { filename: 'Percival.png', size: 1127 },
] as const

async function expectHydratedPng(
  relativePath: string,
  expectedDimensions: { readonly height: number; readonly width: number },
) {
  const sourcePath = path.join(repoRoot, relativePath)

  expect(existsSync(sourcePath)).toBe(true)

  const contents = await readFile(sourcePath)
  expect(
    contents.subarray(0, lfsPointerHeader.length).toString(),
    `${relativePath} is an LFS pointer; run pnpm assets:pull before pnpm assets:verify`,
  ).not.toBe(lfsPointerHeader)

  const metadata = await sharp(contents).metadata()
  expect(metadata).toMatchObject({
    depth: 'uchar',
    format: 'png',
    height: expectedDimensions.height,
    space: 'srgb',
    width: expectedDimensions.width,
  })
}

describe('hydrated role artwork masters', () => {
  it.each(roleArtworkMasters)(
    '$filename is the expected sRGB PNG',
    async ({ filename, height, width }) => {
      await expectHydratedPng(`images/source/roles/${filename}`, { height, width })
    },
  )
})

describe('hydrated role avatar masters', () => {
  it.each(roleAvatarMasters)(
    '$filename is the expected square opaque sRGB PNG',
    async ({ filename, size }) => {
      const relativePath = `images/source/role-avatars/${filename}`
      await expectHydratedPng(relativePath, { height: size, width: size })

      const metadata = await sharp(path.join(repoRoot, relativePath)).metadata()
      expect(metadata).toMatchObject({ channels: 3, hasAlpha: false })
    },
  )
})
