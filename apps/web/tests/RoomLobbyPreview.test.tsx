import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RoomLobbyPreview } from '../src/RoomLobbyPreview'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby" />
        <Route element={<RoomLobbyPreview />} path="/dev/room-layout/lobby/:scenarioID" />
      </Routes>
    </MemoryRouter>,
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
})
