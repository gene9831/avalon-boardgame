import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RoomLayoutPreview } from '../src/RoomLayoutPreview'
import { RoomAssassinationPreview } from '../src/RoomAssassinationPreview'
import { RoomLobbyPreview } from '../src/RoomLobbyPreview'
import { RoomIdentityRecognitionPreview } from '../src/RoomIdentityRecognitionPreview'
import { RoomQuestPreview } from '../src/RoomQuestPreview'
import { RoomResultPreview } from '../src/RoomResultPreview'
import { RoomTeamProposalPreview } from '../src/RoomTeamProposalPreview'
import { RoomTeamVotePreview } from '../src/RoomTeamVotePreview'

function renderGroupedPreviewRoot(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
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
  it('links every room layout demo from one index', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><RoomLayoutPreview /></MemoryRouter>,
    )

    expect(html.match(/href="\/dev\/room-layout\//g)).toHaveLength(27)
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
