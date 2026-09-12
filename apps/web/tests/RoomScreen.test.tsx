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
          onSubmitTeam: vi.fn(), onSelectTeamVote: vi.fn(), onConfirmTeamVote: vi.fn(),
          onSelectQuestCard: vi.fn(), onConfirmQuestCard: vi.fn(), onAssassinate: vi.fn(),
        }}
        diagnosticsMode="off"
        model={buildRoomScreenModel({ kind: 'loading', matchID: 'ABC123456', numPlayers: null })}
        stageAccessory={<button type="button">开发信息</button>}
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
    expect(html).toMatch(/data-room-slot="stage"[^>]*>\s*<div[^>]*data-room-slot="stage-accessory"[^>]*>\s*<button[^>]*>开发信息<\/button>/)
    expect(html.match(/data-room-slot="phase-middle"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-action"/g)).toHaveLength(1)
    expect(html).toContain('data-room-mode="loading"')
    expect(html).not.toContain('avalon-room-shell')
  })

  it('keeps the role concealed until the viewer explicitly reveals it', () => {
    const html = renderToStaticMarkup(
      <RoomScreen
        actions={{
          onActivatePlayer: vi.fn(), onStart: vi.fn(), onReconnect: vi.fn(), onConfirmIdentityRecognition: vi.fn(),
          onSubmitTeam: vi.fn(), onSelectTeamVote: vi.fn(), onConfirmTeamVote: vi.fn(),
          onSelectQuestCard: vi.fn(), onConfirmQuestCard: vi.fn(), onAssassinate: vi.fn(),
        }}
        diagnosticsMode="off"
        identityConfirmation={{
          confirmedCount: 0,
          onCloseReview: vi.fn(),
          onConfirm: vi.fn(),
          onHide: vi.fn(),
          onHideComplete: vi.fn(),
          onReveal: vi.fn(),
          onRevealComplete: vi.fn(),
          onReview: vi.fn(),
          participantCount: 5,
          role: 'merlin',
          state: 'concealed',
        }}
        model={buildRoomScreenModel({ kind: 'loading', matchID: 'ABC123456', numPlayers: null })}
        tools={{
          connected: false, isOwner: false, logEntries: [], manualReconnectAvailable: false,
          onBackHome: vi.fn(), onOpenHelp: vi.fn(), onReconnect: vi.fn(), onRequestRoomExit: vi.fn(),
          onSaveProfile: vi.fn(), onToggleRoleKnowledge: vi.fn(), profile: { avatarID: 'merlin', name: 'Alice' },
          roomExitBlocked: false, roomExitBusy: false, seatChangePending: false, seatChangeTargetID: null,
        }}
      />,
    )

    expect(html).toContain('data-identity-confirmation-state="concealed"')
    expect(html).toContain('aria-label="揭示身份"')
    expect(html).toContain('请确保其他玩家无法看到你的屏幕')
    expect(html).not.toContain('梅林')
  })

  it('uses the round-table center for identity confirmation progress', () => {
    const html = renderToStaticMarkup(
      <RoomScreen
        actions={{
          onActivatePlayer: vi.fn(), onStart: vi.fn(), onReconnect: vi.fn(), onConfirmIdentityRecognition: vi.fn(),
          onSubmitTeam: vi.fn(), onSelectTeamVote: vi.fn(), onConfirmTeamVote: vi.fn(),
          onSelectQuestCard: vi.fn(), onConfirmQuestCard: vi.fn(), onAssassinate: vi.fn(),
        }}
        diagnosticsMode="off"
        identityConfirmation={{
          confirmedCount: 3,
          onCloseReview: vi.fn(),
          onConfirm: vi.fn(),
          onHide: vi.fn(),
          onHideComplete: vi.fn(),
          onReveal: vi.fn(),
          onRevealComplete: vi.fn(),
          onReview: vi.fn(),
          participantCount: 5,
          role: 'merlin',
          state: 'waiting',
        }}
        model={buildRoomScreenModel({ kind: 'loading', matchID: 'ABC123456', numPlayers: null })}
        tools={{
          connected: false, isOwner: false, logEntries: [], manualReconnectAvailable: false,
          onBackHome: vi.fn(), onOpenHelp: vi.fn(), onReconnect: vi.fn(), onRequestRoomExit: vi.fn(),
          onSaveProfile: vi.fn(), onToggleRoleKnowledge: vi.fn(), profile: { avatarID: 'merlin', name: 'Alice' },
          roomExitBlocked: false, roomExitBusy: false, seatChangePending: false, seatChangeTargetID: null,
        }}
      />,
    )

    expect(html).toContain('data-identity-confirmation-center="true"')
    expect(html).toMatch(/3 \/ 5.*玩家已确认身份.*等待其他玩家确认/s)
    expect(html).not.toContain('aria-label="等待其他玩家确认身份"')
  })

  it('uses the round table as the identity recognition information surface', () => {
    const props = {
      actions: {
        onActivatePlayer: vi.fn(), onStart: vi.fn(), onReconnect: vi.fn(), onConfirmIdentityRecognition: vi.fn(),
        onSubmitTeam: vi.fn(), onSelectTeamVote: vi.fn(), onConfirmTeamVote: vi.fn(),
        onSelectQuestCard: vi.fn(), onConfirmQuestCard: vi.fn(), onAssassinate: vi.fn(),
      },
      diagnosticsMode: 'off' as const,
      identityRecognition: {
        confirmedCount: 0,
        onCloseReview: vi.fn(),
        onConfirm: vi.fn(),
        onHide: vi.fn(),
        onHideComplete: vi.fn(),
        onReveal: vi.fn(),
        onRevealComplete: vi.fn(),
        onReview: vi.fn(),
        participantCount: 5,
        scene: { type: 'evil-allies' as const, targetPlayerIDs: ['0'] },
        selfConfirmed: false,
        state: 'revealed' as const,
      },
      model: buildRoomScreenModel({ kind: 'loading' as const, matchID: 'ABC123456', numPlayers: null }),
      tools: {
        connected: false, isOwner: false, logEntries: [], manualReconnectAvailable: false,
        onBackHome: vi.fn(), onOpenHelp: vi.fn(), onReconnect: vi.fn(), onRequestRoomExit: vi.fn(),
        onSaveProfile: vi.fn(), onToggleRoleKnowledge: vi.fn(), profile: { avatarID: 'merlin' as const, name: 'Alice' },
        roomExitBlocked: false, roomExitBusy: false, seatChangePending: false, seatChangeTargetID: null,
      },
    }
    const html = renderToStaticMarkup(<RoomScreen {...props} />)

    expect(html).toContain('data-identity-recognition-state="revealed"')
    expect(html).toContain('data-identity-recognition-center="evil-allies"')
    expect(html).toContain('暗影中的同伴')
    expect(html).not.toContain('data-identity-role-artwork')
  })
})
