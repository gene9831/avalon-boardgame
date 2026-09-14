import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomUtilities } from '../src/RoomUtilities'

const tools = {
  connected: true,
  onOpenHelp: vi.fn(),
  logEntries: [],
  onRequestRoomExit: vi.fn(),
  roomExitBusy: false,
  roomExitBlocked: false,
  seatChangePending: false,
  isOwner: true,
  onToggleRoleKnowledge: vi.fn(),
}

describe('RoomUtilities', () => {
  it('puts Help then More in the lobby toolbar without identity or profile controls', () => {
    const html = renderToStaticMarkup(<RoomUtilities model={{
      variant: 'lobby', showRoomExit: true, showIdentityKnowledge: false, roleKnowledgeOpen: false,
    }} tools={tools} />)

    expect(html.match(/data-room-toolbar-item="([^"]+)"/g)).toEqual([
      'data-room-toolbar-item="help"',
      'data-room-toolbar-item="room"',
    ])
    expect(html).not.toContain('打开用户中心')
    expect(html).not.toContain('data-room-toolbar-item="identity"')
  })

  it('keeps identity first, followed by help and More during the game', () => {
    const html = renderToStaticMarkup(<RoomUtilities model={{
      variant: 'game', showRoomExit: true, showIdentityKnowledge: true, roleKnowledgeOpen: false,
    }} tools={tools} />)

    const identityIndex = html.indexOf('data-room-toolbar-item="identity"')
    const helpIndex = html.indexOf('aria-label="打开帮助说明"')
    const moreIndex = html.indexOf('data-room-toolbar-item="room"')

    expect(identityIndex).toBeGreaterThanOrEqual(0)
    expect(helpIndex).toBeGreaterThan(identityIndex)
    expect(moreIndex).toBeGreaterThan(helpIndex)
    expect(html).not.toContain('aria-label="查看对局记录"')
  })

  it('keeps More available for the game log when room exit is unavailable', () => {
    const html = renderToStaticMarkup(<RoomUtilities model={{
      variant: 'game', showRoomExit: false, showIdentityKnowledge: false, roleKnowledgeOpen: false,
    }} tools={tools} />)

    expect(html).toContain('data-room-toolbar-item="room"')
    expect(html).not.toContain('aria-label="查看对局记录"')
  })

  it('owns an explicit sans-serif boundary for every complete toolbar', () => {
    const html = renderToStaticMarkup(<RoomUtilities model={{
      variant: 'game', showRoomExit: false, showIdentityKnowledge: false, roleKnowledgeOpen: false,
    }} tools={tools} />)

    expect(html).toMatch(/<nav[^>]*class="[^"]*font-sans[^"]*"/)
  })
})
