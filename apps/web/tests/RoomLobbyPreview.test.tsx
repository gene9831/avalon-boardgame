import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RoomLobbyPreview } from '../src/RoomLobbyPreview'
import { buildRoomScreenModel } from '../src/room-screen-controller'
import {
  applyLobbyPreviewReconnectCompletion,
  buildLobbyPreviewState,
  completeLobbyPreviewReconnect,
  getLobbyPreviewReconnectPresentation,
  resetLobbyPreviewReconnect,
} from '../src/room-lobby-preview-model'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby" />
          <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby/:scenarioID" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('RoomLobbyPreview', () => {
  it('gives the demo root a definite viewport-sized room container', () => {
    const css = readFileSync(new URL('../src/RoomLayoutPreview.css', import.meta.url), 'utf8')

    expect(css).toMatch(/\.room-lobby-preview\s*\{[^}]*width:\s*100vw;[^}]*height:\s*100vh;[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/s)
  })

  it('lists the five lobby scenarios', () => {
    const html = renderPreview('/dev/room-layout/lobby')

    expect(html.match(/href="\/dev\/room-layout\/lobby\//g)).toHaveLength(5)
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
    expect(renderPreview('/dev/room-layout/lobby/owner-full')).toContain('模拟开始中')
    expect(renderPreview('/dev/room-layout/lobby/member-incomplete')).toContain('模拟换座')
    const html = renderPreview('/dev/room-layout/lobby/current-player-disconnected')
    expect(html).toContain('自动重连中')
    expect(html).toContain('可手动重连')
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
    const model = buildRoomScreenModel({
      kind: 'ready', matchID: room.matchID, room, game: preview.game, phase: 'lobby', activeStage: undefined,
      currentPlayerID: preview.currentPlayerID, selectedTeam: [], selectedTarget: null, roleKnowledgeOpen: false,
      canStart: preview.canStart, roomExitBusy: false, connected: true, manualReconnectAvailable: false, startPending: false,
    })

    expect(model.phase.kind).toBe('lobby')
    expect(model.players.find((player) => player.isCurrentPlayer)?.connected).toBe(true)
    expect(room.players.filter((player) => String(player.id) !== preview.currentPlayerID)).toEqual(
      preview.room.players.filter((player) => String(player.id) !== preview.currentPlayerID),
    )
  })
})
