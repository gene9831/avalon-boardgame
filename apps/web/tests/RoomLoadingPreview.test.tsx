import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import { ToastProvider } from '../src/toast'
import { RoomLoadingPreview } from '../src/RoomLoadingPreview'

describe('RoomLoadingPreview', () => {
  it('renders the deterministic loading scene through the shared preview shell', () => {
    const html = renderToStaticMarkup(
      <HelpProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/dev/room-layout/loading']}>
            <Routes><Route element={<RoomLoadingPreview />} path="/dev/room-layout/loading" /></Routes>
          </MemoryRouter>
        </ToastProvider>
      </HelpProvider>,
    )

    expect(html).toContain('data-room-preview-shell="true"')
    expect(html).toContain('data-room-scene="loading"')
    expect(html).toContain('正在加载房间')
  })
})
