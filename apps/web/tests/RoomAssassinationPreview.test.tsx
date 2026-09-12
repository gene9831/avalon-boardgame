import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import { RoomAssassinationPreview } from '../src/RoomAssassinationPreview'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination" />
            <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomAssassinationPreview', () => {
  it('renders all three assassination perspectives through the production RoomScreen', () => {
    for (const scenarioID of ['assassin', 'evil', 'good']) {
      const html = renderPreview(`/dev/room-layout/assassination/${scenarioID}`)

      expect(html).toContain('data-room-screen="true"')
      expect(html).toContain('打开开发预览控制')
    }
  })

  it('gives only the Assassin a private target action', () => {
    const assassin = renderPreview('/dev/room-layout/assassination/assassin')
    const evil = renderPreview('/dev/room-layout/assassination/evil')
    const good = renderPreview('/dev/room-layout/assassination/good')

    expect(assassin).toContain('选择你认为是梅林的玩家')
    expect(assassin).toContain('确认刺杀')
    expect(evil).toContain('协助刺客找出梅林')
    expect(evil).not.toContain('确认刺杀')
    expect(good).toContain('等待刺客选择目标')
    expect(good).not.toContain('确认刺杀')
  })

  it('does not render an intermediate assassination index', () => {
    expect(renderPreview('/dev/room-layout/assassination')).not.toContain('data-room-screen="true"')
  })
})
