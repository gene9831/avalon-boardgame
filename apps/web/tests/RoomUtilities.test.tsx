import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomUtilities } from '../src/RoomUtilities'

const tools = {
  connected: true,
  manualReconnectAvailable: false,
  onReconnect: vi.fn(),
  onOpenHelp: vi.fn(),
  logEntries: [],
  profile: { avatarID: 'merlin' as const, name: 'Alice' },
  onSaveProfile: vi.fn(),
  onRequestRoomExit: vi.fn(),
  roomExitBusy: false,
  roomExitBlocked: false,
  seatChangePending: false,
  isOwner: true,
  onToggleRoleKnowledge: vi.fn(),
}

describe('RoomUtilities', () => {
  it('keeps recovery, help, and log controls in every room mode', () => {
    const html = renderToStaticMarkup(<RoomUtilities model={{
      showProfile: false, showRoomExit: false, showIdentityKnowledge: false, roleKnowledgeOpen: false,
    }} tools={tools} />)
    expect(html).toContain('aria-label="打开帮助说明"')
    expect(html).toContain('aria-label="查看对局记录"')
  })

  it('adds profile and owner exit controls only when the model permits them', () => {
    const html = renderToStaticMarkup(<RoomUtilities model={{
      showProfile: true, showRoomExit: true, showIdentityKnowledge: false, roleKnowledgeOpen: false,
    }} tools={tools} />)
    expect(html).toContain('aria-label="打开用户中心"')
    expect(html).toContain('>解散房间<')
  })
})
