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
        onRoleConfigurationChange={vi.fn()}
        open
        roleConfiguration={{ percivalMorgana: true }}
      />,
    )

    for (const count of [5, 6, 7, 8, 9, 10]) {
      expect(html).toContain(`>${count}<`)
    }
    expect(html).toContain('创建房间')
    expect(html).toContain('正义阵营')
    expect(html).toContain('邪恶阵营')
    expect(html).toContain('五次任务所需人数')
    expect(html).toContain('4 人正义阵营 · 3 人邪恶阵营')
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
        onRoleConfigurationChange={vi.fn()}
        open
        roleConfiguration={{ percivalMorgana: true }}
      />,
    )

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>取消<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>正在创建…<\/button>/)
  })

  it('enables the Percival and Morgana pair for a new room', () => {
    const html = renderToStaticMarkup(
      <CreateGameDialog busy={false} numPlayers={5} onCancel={vi.fn()} onConfirm={vi.fn()} onPlayerCountChange={vi.fn()} onRoleConfigurationChange={vi.fn()} open roleConfiguration={{ percivalMorgana: true }} />,
    )

    expect(html).toContain('role="switch"')
    expect(html).toContain('checked=""')
    expect(html).toContain('帕西维尔与莫甘娜')
  })
})
