import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import { RoomIdentityConfirmationPreview } from '../src/RoomIdentityConfirmationPreview'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<RoomIdentityConfirmationPreview />} path="/dev/room-layout/identity-confirmation" />
            <Route element={<RoomIdentityConfirmationPreview />} path="/dev/room-layout/identity-confirmation/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomIdentityConfirmationPreview', () => {
  it.each([
    ['concealed', '确认你的身份', 'aria-label="揭示身份"'],
    ['revealed', '记住你的身份', 'data-identity-role-artwork="merlin"'],
    ['confirming', '记住你的身份', '正在确认…'],
    ['waiting', '等待其他玩家', '再次查看身份'],
  ])('renders the %s scenario through the shared room screen', (scenarioID, title, expectedMarkup) => {
    const html = renderPreview(`/dev/room-layout/identity-confirmation/${scenarioID}`)

    expect(html).toContain('data-room-screen="true"')
    expect(html).toContain(`data-identity-confirmation-state="${scenarioID}"`)
    expect(html).toContain(title)
    expect(html).toContain(expectedMarkup)
  })

  it('does not render an intermediate identity confirmation index', () => {
    expect(renderPreview('/dev/room-layout/identity-confirmation')).not.toContain('data-room-screen="true"')
  })
})
