import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RoomPhasePanel } from '../src/RoomPhasePanel'

describe('RoomPhasePanel', () => {
  it('provides separate middle and bottom action slots', () => {
    const html = renderToStaticMarkup(<RoomPhasePanel action={<button type="button">开始游戏</button>} middle={<p>等待玩家</p>} />)

    expect(html).toContain('data-room-slot="phase-middle"')
    expect(html).toContain('data-room-slot="phase-action"')
    expect(html).toContain('grid-rows-[minmax(0,1fr)_3.5rem]')
  })
})
