import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import {
  createRoomResultPreviewScene,
  createRoomResultPreviewState,
  RoomResultPreview,
} from '../src/RoomResultPreview'
import { RoomGameResultScene } from '../src/RoomGameResultScene'
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
  it('renders only the supplied terminal role presentation for result seats', () => {
    const html = renderToStaticMarkup(
      <RoomGameResultScene
        actions={null}
        geometry={{
          stageLayout: {
            status: 'ready', shape: 'circle', tabletop: { x: 20, y: 40, width: 319, height: 319 },
            centerPanel: { x: 103.5, y: 123.5, width: 152, height: 152 },
            playerSeats: [{ relativeSeatIndex: 0, playerSeatBounds: { x: 130, y: 340, width: 90, height: 90 }, playerBoundaryCircle: { center: { x: 175, y: 375 }, radius: 45 }, avatarRect: { x: 151, y: 351, width: 48, height: 48 }, nameRect: { x: 130, y: 405, width: 90, height: 22 }, avatarTopClearance: 11 }],
          },
        }}
        scene={{
          kind: 'gameResult', matchID: 'ABC123456', playerCount: 5, questProgress: [], winner: 'good', reason: '刺杀未命中', questScore: '3 : 2',
          players: [{
            playerID: '0', relativeSeatIndex: 0, seatNumber: 1, name: 'Alice', occupied: true, isCurrentPlayer: false,
            portrait: { kind: 'roleArtwork', role: 'merlin' }, markers: [], caption: { kind: 'role', role: 'merlin' }, emphasis: 'default', interaction: { kind: 'none' },
          }],
        }}
        slots={{ back: null, toolbar: null }}
      />,
    )

    expect(html).toContain('正义阵营获胜')
    expect(html).toContain('data-room-role-revealed="true"')
    expect(html).toContain('>梅林</span>')
    expect(html).not.toContain('data-seat-decoration=')
  })

  it.each([
    ['good-assassination', 'good', '刺杀未命中'],
    ['evil-assassination', 'evil', '刺杀命中梅林'],
    ['evil-quests', 'evil', '破坏 3 次任务'],
    ['evil-rejections', 'evil', '连续否决 5 支队伍'],
  ] as const)('renders %s through the production RoomScreen', (scenarioID, winner, reason) => {
    const html = renderPreview(`/dev/room-layout/result/${scenarioID}`)
    const scene = createRoomResultPreviewScene(
      createRoomResultPreviewState({ scenarioID, playerCount: 5, pairedRoles: true }),
    )

    expect(html).toContain('data-room-screen="true"')
    expect(html).toContain('所有玩家身份已公开，可查看对局记录')
    expect(html).toContain('打开开发预览控制')
    expect(scene.winner).toBe(winner)
    expect(scene.reason).toContain(reason)
    expect(scene.players.every(({ portrait, caption, markers, interaction }) => (
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
