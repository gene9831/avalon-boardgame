import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomMoreMenuPanel } from '../src/RoomMoreMenu'

describe('RoomMoreMenuPanel', () => {
  it('keeps the public log before the owner room action', () => {
    const html = renderToStaticMarkup(
      <RoomMoreMenuPanel
        isOwner
        onOpenLog={vi.fn()}
        onRequestRoomExit={vi.fn()}
        roomActionDisabled={false}
        roomExitBusy={false}
      />,
    )

    expect(html.indexOf('对局记录')).toBeLessThan(html.indexOf('border-t'))
    expect(html.indexOf('border-t')).toBeLessThan(html.indexOf('解散房间'))
    expect(html).toContain('role="menu"')
  })

  it('shows a disabled member exit action while recovery blocks room changes', () => {
    const html = renderToStaticMarkup(
      <RoomMoreMenuPanel
        isOwner={false}
        onOpenLog={vi.fn()}
        onRequestRoomExit={vi.fn()}
        roomActionDisabled
        roomExitBusy={false}
      />,
    )

    expect(html).toContain('退出房间')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>退出房间<\/button>/)
  })
})
