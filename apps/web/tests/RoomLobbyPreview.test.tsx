import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RoomLobbyPreview } from '../src/RoomLobbyPreview'
import { RoomLobbyScene } from '../src/RoomLobbyScene'
import { HelpProvider } from '../src/HelpProvider'
import {
  applyLobbyPreviewReconnectCompletion,
  buildLobbyPreviewState,
  completeLobbyPreviewReconnect,
  getLobbyPreviewReconnectPresentation,
  resetLobbyPreviewReconnect,
} from '../src/room-lobby-preview-model'
import { buildRoomPlayers } from '../src/room-presentation'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby" />
            <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomLobbyPreview', () => {
  it('presents the owner start affordance and occupied-seat summary through the lobby scene', () => {
    const html = renderToStaticMarkup(
      <RoomLobbyScene
        actions={{ onActivatePlayer: () => {}, onStart: () => {} }}
        geometry={{
          stageLayout: {
            status: 'ready', shape: 'circle', tabletop: { x: 20, y: 40, width: 319, height: 319 },
            centerPanel: { x: 103.5, y: 123.5, width: 152, height: 152 },
            playerSeats: [],
          },
        }}
        scene={{
          kind: 'lobby', matchID: 'ABC123456', playerCount: 5, players: [], questProgress: [],
          occupiedCount: 5, seatCount: 5, viewer: 'owner', canStart: true, startRequestState: 'idle',
        }}
        slots={{ back: null, toolbar: null }}
      />,
    )

    expect(html).toContain('5 / 5')
    expect(html).toContain('开始游戏')
    expect(html).toContain('所有玩家已入座')
  })

  it('gives the demo root a definite viewport-sized room container', () => {
    const css = readFileSync(new URL('../src/RoomLayoutPreview.css', import.meta.url), 'utf8')

    expect(css).toMatch(/\.room-lobby-preview\s*\{[^}]*width:\s*100vw;[^}]*height:\s*100vh;[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/s)
  })

  it.each([
    'member-incomplete',
    'owner-incomplete',
    'member-full',
    'owner-full',
    'current-player-disconnected',
  ])('renders the production room screen for %s', (scenarioID) => {
    const html = renderPreview(`/dev/room-layout/lobby/${scenarioID}`)

    expect(html.match(/data-room-screen="true"/g)).toHaveLength(1)
    expect(html).toContain('开发预览控制')
    expect(html).toContain('5 人')
    expect(html).toContain('10 人')
  })

  it('exposes inspectable lobby and reconnect controls', () => {
    expect(renderPreview('/dev/room-layout/lobby/owner-full')).toContain('打开开发预览控制')
    expect(renderPreview('/dev/room-layout/lobby/member-incomplete')).toContain('打开开发预览控制')
    const html = renderPreview('/dev/room-layout/lobby/current-player-disconnected')
    expect(html).toContain('打开开发预览控制')
  })

  it('keeps shared developer controls collapsed and outside the production stage', () => {
    const html = renderPreview('/dev/room-layout/lobby/member-incomplete')

    expect(html).toContain('aria-label="打开开发预览控制"')
    expect(html).not.toContain('id="room-screen-preview-controls"')
    expect(html).not.toContain('aria-label="关闭开发预览控制"')
    expect(html).not.toContain('data-room-slot="stage-atmosphere"')
    expect(html).toContain('lucide-info')
  })

  it('exposes the existing help entry through the shared complete toolbar', () => {
    const html = renderPreview('/dev/room-layout/lobby/member-incomplete')

    expect(html).toContain('aria-label="房间工具"')
    expect(html).toContain('data-room-toolbar-item="help"')
    expect(html).toContain('aria-label="帮助"')
  })

  it('completes a manual reconnect once, then can reset to automatic recovery', () => {
    const initial = { mode: 'manual' as const, completed: false }
    const firstCompletion = completeLobbyPreviewReconnect(initial)

    expect(getLobbyPreviewReconnectPresentation(firstCompletion.state)).toEqual({
      connected: true,
      manualReconnectAvailable: false,
    })
    expect(firstCompletion.toast).toEqual({ message: '已重新连接房间。', tone: 'success' })
    expect(completeLobbyPreviewReconnect(firstCompletion.state).toast).toBeNull()

    expect(resetLobbyPreviewReconnect(firstCompletion.state)).toEqual({ mode: 'automatic', completed: false })
    expect(getLobbyPreviewReconnectPresentation(resetLobbyPreviewReconnect(firstCompletion.state))).toEqual({
      connected: false,
      manualReconnectAvailable: false,
    })
  })

  it('restores the current player seat connection in the completed lobby model', () => {
    const preview = buildLobbyPreviewState({
      scenarioID: 'current-player-disconnected', playerCount: 5,
      reconnectMode: 'manual', seatChangeTargetID: null, startPending: false,
    })
    const completion = completeLobbyPreviewReconnect({ mode: 'manual', completed: false })
    const room = applyLobbyPreviewReconnectCompletion(
      preview.room,
      preview.currentPlayerID,
      completion.state.completed,
    )
    const players = buildRoomPlayers({
      players: room.players,
      numPlayers: 5,
      currentPlayerID: preview.currentPlayerID,
      phase: 'lobby',
      viewerConnected: true,
      ownerPlayerID: room.ownerPlayerID,
      game: preview.game,
      selectedTeam: [],
      selectedTarget: null,
      showKnownPlayerInfo: false,
      showPrivateRoleKnowledge: false,
      interactionMode: 'changeSeat',
    })

    expect(players.find((player) => player.isCurrentPlayer)?.portrait).toMatchObject({
      kind: 'playerAvatar', connected: true,
    })
    expect(room.players.filter((player) => String(player.id) !== preview.currentPlayerID)).toEqual(
      preview.room.players.filter((player) => String(player.id) !== preview.currentPlayerID),
    )
  })
})
