import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import { RoomQuestPreview } from '../src/RoomQuestPreview'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<RoomQuestPreview />} path="/dev/room-layout/quest" />
            <Route element={<RoomQuestPreview />} path="/dev/room-layout/quest/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomQuestPreview', () => {
  it('renders the production room screen for all three quest perspectives', () => {
    for (const scenarioID of ['member-good', 'member-evil', 'observer']) {
      const html = renderPreview(`/dev/room-layout/quest/${scenarioID}`)

      expect(html).toContain('data-room-screen="true"')
      expect(html).toContain('打开开发预览控制')
    }
  })

  it('gives Good and Evil members the agreed private controls', () => {
    const good = renderPreview('/dev/room-layout/quest/member-good')
    const evil = renderPreview('/dev/room-layout/quest/member-evil')

    expect(good).toContain('正义阵营只能提交成功牌')
    expect(good).toContain('确认成功牌')
    expect(good).not.toContain('data-quest-card="fail"')
    expect(evil).toContain('data-quest-card="success"')
    expect(evil).toContain('data-quest-card="fail"')
    expect(evil).toContain('确认任务牌')
  })

  it('gives an observer waiting copy without a quest-card action', () => {
    const html = renderPreview('/dev/room-layout/quest/observer')

    expect(html).toContain('等待任务结果')
    expect(html).toContain('任务队员正在秘密提交任务牌')
    expect(html).not.toContain('确认任务牌')
    expect(html).not.toContain('确认成功牌')
  })

  it('does not render an intermediate quest index', () => {
    expect(renderPreview('/dev/room-layout/quest')).not.toContain('data-room-screen="true"')
  })
})
