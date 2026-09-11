import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RoomCenterSummary } from '../src/RoomCenterSummary'
import type { RoomCenterModel } from '../src/room-screen-model'

function renderCenter(model: RoomCenterModel) {
  return renderToStaticMarkup(<RoomCenterSummary model={model} />)
}

describe('RoomCenterSummary', () => {
  it('renders a seated-player count while the lobby is filling', () => {
    const html = renderCenter({ kind: 'lobbySummary', occupied: 3, total: 5, ready: false })

    expect(html).toContain('<strong')
    expect(html).toContain('3 / 5')
    expect(html).toContain('已入座')
  })

  it('tells full lobbies to wait for the owner to start', () => {
    const html = renderCenter({ kind: 'lobbySummary', occupied: 5, total: 5, ready: true })

    expect(html).toContain('等待房主')
    expect(html).toContain('开始游戏')
  })
})
