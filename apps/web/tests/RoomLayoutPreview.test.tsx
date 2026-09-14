import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RoomLayoutBasePreview, RoomLayoutPreview } from '../src/RoomLayoutPreview'
import { RoomAssassinationPreview } from '../src/RoomAssassinationPreview'
import { RoomLobbyPreview } from '../src/RoomLobbyPreview'
import { RoomLoadingPreview } from '../src/RoomLoadingPreview'
import { RoomIdentityRecognitionPreview } from '../src/RoomIdentityRecognitionPreview'
import { RoomQuestPreview } from '../src/RoomQuestPreview'
import { RoomResultPreview } from '../src/RoomResultPreview'
import { RoomTeamProposalPreview } from '../src/RoomTeamProposalPreview'
import { RoomTeamVotePreview } from '../src/RoomTeamVotePreview'
import { RoomScreenPreviewShell } from '../src/RoomScreenPreviewShell'
import { HelpProvider } from '../src/HelpProvider'
import { ToastProvider } from '../src/toast'

function renderGroupedPreviewRoot(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoomLoadingPreview />} path="/dev/room-layout/loading" />
        <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby" />
        <Route element={<RoomIdentityRecognitionPreview />} path="/dev/room-layout/identity-recognition" />
        <Route element={<RoomTeamProposalPreview />} path="/dev/room-layout/team-proposal" />
        <Route element={<RoomTeamVotePreview />} path="/dev/room-layout/team-vote" />
        <Route element={<RoomQuestPreview />} path="/dev/room-layout/quest" />
        <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination" />
        <Route element={<RoomResultPreview />} path="/dev/room-layout/result" />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoomLayoutPreview', () => {
  it('puts one observed production screen, complete chrome, and development controls outside the screen contract', () => {
    const html = renderToStaticMarkup(
      <HelpProvider>
        <ToastProvider>
          <MemoryRouter>
            <RoomScreenPreviewShell
              actions={null}
              controls={<p>preview controls</p>}
              scene={{ kind: 'gameResult', matchID: 'preview', playerCount: 5, players: [], questProgress: [], winner: 'good', reason: '任务成功', questScore: '3 : 1' }}
            />
          </MemoryRouter>
        </ToastProvider>
      </HelpProvider>,
    )

    expect(html.match(/data-room-preview-shell="true"/g)).toHaveLength(1)
    expect(html.match(/data-room-screen="true"/g)).toHaveLength(1)
    expect(html.match(/aria-label="返回主页"/g)).toHaveLength(1)
    expect(html.match(/aria-label="房间工具"/g)).toHaveLength(1)
    expect(html.match(/aria-label="系统通知"/g)).toHaveLength(1)
    expect(html).toContain('data-room-toolbar-item="identity"')
    expect(html).toContain('data-room-toolbar-item="help"')
    expect(html).toContain('data-room-toolbar-item="room"')
    expect(html).not.toContain('aria-label="查看对局记录"')
    expect(html).toContain('aria-label="打开开发预览控制"')
    expect(html).not.toContain('data-room-slot="stage-atmosphere"')
  })

  it('links every room layout demo from one index', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><RoomLayoutPreview /></MemoryRouter>,
    )

    expect(html.match(/href="\/dev\/room-layout\//g)).toHaveLength(28)
    expect(html).toContain('href="/dev/room-layout/loading"')
    expect(html).toContain('href="/dev/room-layout/base"')
    expect(html).toContain('href="/dev/room-layout/identity-confirmation/concealed"')
    expect(html).toContain('href="/dev/room-layout/identity-confirmation/revealed"')
    expect(html).toContain('href="/dev/room-layout/identity-confirmation/confirming"')
    expect(html).toContain('href="/dev/room-layout/identity-confirmation/waiting"')
    expect(html).toContain('href="/dev/room-layout/identity-recognition/evil-allies"')
    expect(html).toContain('href="/dev/room-layout/identity-recognition/merlin-evil"')
    expect(html).toContain('href="/dev/room-layout/identity-recognition/percival-candidates"')
    expect(html).toContain('href="/dev/room-layout/identity-recognition/none"')
    expect(html).toContain('href="/dev/room-layout/lobby/current-player-disconnected"')
    expect(html).toContain('href="/dev/room-layout/team-proposal/leader"')
    expect(html).toContain('href="/dev/room-layout/team-proposal/member"')
    expect(html).toContain('href="/dev/room-layout/team-vote/voter"')
    expect(html).toContain('href="/dev/room-layout/quest/member-good"')
    expect(html).toContain('href="/dev/room-layout/quest/member-evil"')
    expect(html).toContain('href="/dev/room-layout/quest/observer"')
    expect(html).toContain('href="/dev/room-layout/assassination/assassin"')
    expect(html).toContain('href="/dev/room-layout/assassination/evil"')
    expect(html).toContain('href="/dev/room-layout/assassination/good"')
    expect(html).toContain('href="/dev/room-layout/result/good-assassination"')
    expect(html).toContain('href="/dev/room-layout/result/evil-assassination"')
    expect(html).toContain('href="/dev/room-layout/result/evil-quests"')
    expect(html).toContain('href="/dev/room-layout/result/evil-rejections"')
  })

  it('uses the More menu rather than a direct log control in the base preview toolbar', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><RoomLayoutBasePreview /></MemoryRouter>,
    )

    expect(html).toContain('data-room-toolbar-item="room"')
    expect(html).not.toContain('aria-label="查看对局记录"')
  })

  it.each([
    '/dev/room-layout/lobby',
    '/dev/room-layout/identity-recognition',
    '/dev/room-layout/team-proposal',
    '/dev/room-layout/team-vote',
    '/dev/room-layout/quest',
    '/dev/room-layout/assassination',
    '/dev/room-layout/result',
  ])('does not render an intermediate index at %s', (path) => {
    const html = renderGroupedPreviewRoot(path)

    expect(html).toBe('')
  })
})
