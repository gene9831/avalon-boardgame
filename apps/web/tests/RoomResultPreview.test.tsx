import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import { buildRoomScreenModel } from '../src/room-screen-controller'
import { createRoomResultPreviewState, RoomResultPreview } from '../src/RoomResultPreview'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<RoomResultPreview />} path="/dev/room-layout/result" />
            <Route element={<RoomResultPreview />} path="/dev/room-layout/result/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomResultPreview', () => {
  it.each([
    ['good-assassination', 'good', '刺杀未命中'],
    ['evil-assassination', 'evil', '刺杀命中梅林'],
    ['evil-quests', 'evil', '破坏 3 次任务'],
    ['evil-rejections', 'evil', '连续否决 5 支队伍'],
  ] as const)('renders %s through the production RoomScreen', (scenarioID, winner, reason) => {
    const html = renderPreview(`/dev/room-layout/result/${scenarioID}`)
    const preview = createRoomResultPreviewState({ scenarioID, playerCount: 5, pairedRoles: true })
    const model = buildRoomScreenModel({
      kind: 'ready', matchID: preview.room.matchID, room: preview.room, game: preview.game,
      phase: 'finished', activeStage: undefined, currentPlayerID: '2', selectedTeam: [],
      selectedTarget: null, roleKnowledgeOpen: false, canStart: false, roomExitBusy: false,
      connected: true, manualReconnectAvailable: false, startPending: false,
    })

    expect(html).toContain('data-room-screen="true"')
    expect(html).toContain('所有玩家身份已公开，可查看对局记录')
    expect(html).toContain('打开开发预览控制')
    expect(model.center).toMatchObject({ kind: 'resultSummary', winner })
    expect(model.center.kind === 'resultSummary' ? model.center.reason : '').toContain(reason)
    expect(model.players.every(({ portrait, caption, markers, interaction }) => (
      portrait.kind === 'roleArtwork' && caption.kind === 'role' &&
      markers.length === 0 && interaction.kind === 'none'
    ))).toBe(true)
  })

  it('defaults to five players with the paired roles enabled', () => {
    const preview = createRoomResultPreviewState({
      scenarioID: 'good-assassination', playerCount: 5, pairedRoles: true,
    })
    const roles = Object.values(preview.game.revealedRoles ?? {})

    expect(preview.room.players).toHaveLength(5)
    expect(roles).toContain('percival')
    expect(roles).toContain('morgana')
  })

  it('does not render an intermediate result index', () => {
    expect(renderPreview('/dev/room-layout/result')).not.toContain('data-room-screen="true"')
  })
})
