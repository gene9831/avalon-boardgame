import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CreateGameDialog } from '../src/CreateGameDialog'

describe('CreateGameDialog', () => {
  it('shows every supported player count and the selected rule summary', () => {
    const html = renderToStaticMarkup(
      <CreateGameDialog
        busy={false}
        numPlayers={7}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onPlayerCountChange={vi.fn()}
        open
      />,
    )

    for (const count of [5, 6, 7, 8, 9, 10]) {
      expect(html).toContain(`>${count}<`)
    }
    expect(html).toContain('4 名正义 · 3 名邪恶')
    expect(html).toContain('2 · 3 · 3 · 4 · 4')
    expect(html).not.toContain('角色配置即将开放')
  })

  it('keeps both dialog actions unavailable while creation is pending', () => {
    const html = renderToStaticMarkup(
      <CreateGameDialog
        busy
        numPlayers={5}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onPlayerCountChange={vi.fn()}
        open
      />,
    )

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>取消<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>正在创建…<\/button>/)
  })
})
