// @vitest-environment happy-dom

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('mobile viewport', () => {
  it('prevents automatic focus zoom without disabling manual zoom', async () => {
    const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8')

    const parsedDocument = new DOMParser().parseFromString(html, 'text/html')

    const content = parsedDocument
      .querySelector<HTMLMetaElement>('meta[name="viewport"]')
      ?.content.split(',')
      .map((directive) => directive.trim())

    expect(content).toEqual(
      expect.arrayContaining([
        'width=device-width',
        'initial-scale=1.0',
        'maximum-scale=1.0',
        'viewport-fit=cover',
      ]),
    )
    expect(content).not.toContain('user-scalable=no')
  })
})
