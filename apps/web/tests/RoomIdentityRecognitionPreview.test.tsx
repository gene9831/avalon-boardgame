import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import { RoomIdentityRecognitionPreview } from '../src/RoomIdentityRecognitionPreview'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<RoomIdentityRecognitionPreview />} path="/dev/room-layout/identity-recognition" />
            <Route element={<RoomIdentityRecognitionPreview />} path="/dev/room-layout/identity-recognition/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomIdentityRecognitionPreview', () => {
  it.each([
    'evil-allies',
    'merlin-evil',
    'percival-candidates',
    'none',
  ])('starts the %s perspective in the shared concealed night scene', (scenarioID) => {
    const html = renderPreview(`/dev/room-layout/identity-recognition/${scenarioID}`)

    expect(html).toContain('data-room-screen="true"')
    expect(html).toContain(`data-identity-recognition-scene="${scenarioID}"`)
    expect(html).toContain('data-identity-recognition-state="concealed"')
    if (scenarioID === 'none') {
      expect(html).toContain('我已了解')
      expect(html).not.toContain('查看线索')
    } else {
      expect(html).toContain('查看线索')
      expect(html).not.toContain('我已了解')
    }
    expect(html).not.toContain('data-identity-role-artwork')
    expect(html).not.toContain('仅你可见')
  })

  it('does not render an intermediate identity recognition index', () => {
    expect(renderPreview('/dev/room-layout/identity-recognition')).not.toContain('data-room-screen="true"')
  })
})
