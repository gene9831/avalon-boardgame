import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomScreen } from '../src/RoomScreen'
import { buildRoomScreenModel } from '../src/room-screen-controller'

describe('RoomScreen', () => {
  it('renders one container layout with one instance of every business slot', () => {
    const html = renderToStaticMarkup(
      <RoomScreen
        actions={{
          onActivatePlayer: vi.fn(), onStart: vi.fn(), onReconnect: vi.fn(), onConfirmIdentityRecognition: vi.fn(),
          onSubmitTeam: vi.fn(), onCastTeamVote: vi.fn(), onPlayQuestCard: vi.fn(), onAssassinate: vi.fn(),
        }}
        diagnosticsMode="off"
        model={buildRoomScreenModel({ kind: 'loading', matchID: 'ABC123456', numPlayers: null })}
        tools={{
          connected: false, isOwner: false, logEntries: [], manualReconnectAvailable: false,
          onBackHome: vi.fn(), onOpenHelp: vi.fn(), onReconnect: vi.fn(), onRequestRoomExit: vi.fn(),
          onSaveProfile: vi.fn(), onToggleRoleKnowledge: vi.fn(), profile: { avatarID: 'merlin', name: 'Alice' },
          roomExitBlocked: false, roomExitBusy: false, seatChangePending: false, seatChangeTargetID: null,
        }}
      />,
    )

    expect(html.match(/data-room-screen="true"/g)).toHaveLength(1)
    expect(html).toContain('class="avalon-room-layout"')
    expect(html).toContain('aria-label="返回主页"')
    expect(html).toContain('aria-label="五次任务进度"')
    expect(html.match(/data-room-slot="stage"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-middle"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-action"/g)).toHaveLength(1)
    expect(html).toContain('data-room-mode="loading"')
    expect(html).not.toContain('avalon-room-shell')
  })
})
