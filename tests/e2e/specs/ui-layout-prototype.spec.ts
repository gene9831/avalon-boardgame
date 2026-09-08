import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

const prototypePath = new URL(
  '../../../docs/ui-layout/prototypes/avalon-landscape-responsive-lab.html',
  import.meta.url,
)

async function openPrototype(page: import('@playwright/test').Page) {
  await page.setContent(await readFile(prototypePath, 'utf8'), { waitUntil: 'load' })
}

test('the ten-player portrait prototype selects the largest fitting avatar tier', async ({
  page,
}) => {
  await openPrototype(page)

  const widthInput = page.getByRole('spinbutton', { name: '宽度', exact: true })
  const heightInput = page.getByRole('spinbutton', { name: '高度', exact: true })
  const stage = page.getByRole('main', { name: '圆桌舞台' })

  for (const expected of [
    { width: 375, height: 667, avatar: '40', shape: 'stadium' },
    { width: 390, height: 844, avatar: '48', shape: 'stadium' },
    { width: 430, height: 932, avatar: '56', shape: 'stadium' },
    { width: 768, height: 1024, avatar: '56', shape: 'circle' },
  ]) {
    await widthInput.fill(String(expected.width))
    await heightInput.fill(String(expected.height))
    await expect(stage).toHaveAttribute('data-table-shape', expected.shape)
    await expect(stage).toHaveAttribute('data-avatar-size', expected.avatar)
  }
})

test('portrait diagnostics show crown-safe seat bounds and balanced boundary gaps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await openPrototype(page)
  await page.getByRole('spinbutton', { name: '宽度', exact: true }).fill('390')
  await page.getByRole('spinbutton', { name: '高度', exact: true }).fill('844')
  await page.getByRole('checkbox', { name: '显示几何' }).check()

  const legend = page.getByLabel('舞台线框图例')
  await expect(legend.getByText('普通座位间距', { exact: true })).toBeVisible()
  await expect(legend.getByText('中央通道间距', { exact: true })).toBeVisible()

  const stage = page.getByRole('main', { name: '圆桌舞台' })
  await expect(stage.locator('.alp-seat-bound')).toHaveCount(10)
  await expect(stage.locator('[data-gap-kind="standard"]')).toHaveCount(8)
  await expect(stage.locator('[data-gap-kind="center-aisle"]')).toHaveCount(2)

  const geometry = await stage.evaluate((element) => {
    const crown = element.querySelector('.alp-leader')?.getBoundingClientRect()
    const leaderBounds = element.querySelector(
      '.alp-seat-bound[data-seat-index="0"]',
    )?.getBoundingClientRect()
    const standardGaps = Array.from(
      element.querySelectorAll<SVGLineElement>('[data-gap-kind="standard"]'),
    ).map((line) => Number(line.dataset.gapValue))
    const centerAisleGaps = Array.from(
      element.querySelectorAll<SVGLineElement>('[data-gap-kind="center-aisle"]'),
    ).map((line) => Number(line.dataset.gapValue))
    const centerAisleMidpoints = Array.from(
      element.querySelectorAll<SVGLineElement>('[data-gap-kind="center-aisle"]'),
    ).map((line) => (
      (Number(line.getAttribute('y1')) + Number(line.getAttribute('y2'))) / 2
    ))
    const tabletop = element.querySelector<HTMLElement>('.alp-portrait-tabletop')
    const tabletopCenterY = tabletop === null
      ? undefined
      : Number.parseFloat(tabletop.style.top)
        + Number.parseFloat(tabletop.style.height) / 2

    return {
      centerAisleGaps,
      centerAisleMidpoints,
      crownInsideLeaderBounds: crown !== undefined
        && leaderBounds !== undefined
        && crown.left >= leaderBounds.left - 1
        && crown.right <= leaderBounds.right + 1
        && crown.top >= leaderBounds.top - 1
        && crown.bottom <= leaderBounds.bottom + 1,
      standardGaps,
      tabletopCenterY,
    }
  })

  expect(geometry.crownInsideLeaderBounds).toBe(true)
  expect(Math.max(...geometry.standardGaps) - Math.min(...geometry.standardGaps))
    .toBeLessThanOrEqual(2)
  expect(geometry.centerAisleGaps[0]).toBeCloseTo(geometry.centerAisleGaps[1], 1)
  expect(geometry.centerAisleMidpoints[0]).toBeCloseTo(
    geometry.tabletopCenterY ?? Number.NaN,
    1,
  )
  expect(geometry.centerAisleMidpoints[1]).toBeCloseTo(
    geometry.tabletopCenterY ?? Number.NaN,
    1,
  )
  expect(Math.min(...geometry.centerAisleGaps)).toBeGreaterThan(
    Math.max(...geometry.standardGaps),
  )
})
