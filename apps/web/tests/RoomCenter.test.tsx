import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RoomCenter } from '../src/RoomCenter'

describe('RoomCenter', () => {
  it('uses the shared Avalon serif baseline and regular density by default', () => {
    const html = renderToStaticMarkup(
      <RoomCenter role="status">等待玩家</RoomCenter>,
    )

    expect(html).toContain('font-avalon-serif')
    expect(html).toContain('room-center-summary')
    expect(html).toContain('w-[168px]')
    expect(html).toContain('role="status"')
  })

  it.each([
    ['compact', 'w-[152px]'],
    ['regular', 'w-[168px]'],
    ['wide', 'w-[min(20rem,100%)]'],
  ] as const)('applies the %s center density', (density, widthClass) => {
    const html = renderToStaticMarkup(
      <RoomCenter density={density}>公开进度</RoomCenter>,
    )

    expect(html).toContain(widthClass)
  })
})
