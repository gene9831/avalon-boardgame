import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomLogControl, RoomLogPanel } from '../src/RoomLogControl'

const entries = [
  {
    group: '第 1 次任务 · 第 1 次提案',
    id: 'proposal-0',
    kind: 'proposal' as const,
    title: 'Arthur（1号位）提出了任务队伍',
    detail: 'Arthur（1号位）、Claire（3号位）',
  },
  {
    group: '第 1 次任务',
    id: 'quest-0',
    kind: 'quest' as const,
    title: '第 1 次任务成功',
    detail: '2 张成功 · 0 张失败',
    tone: 'good' as const,
  },
]

describe('RoomLogControl', () => {
  it('renders only a plain log trigger without an unread badge', () => {
    const html = renderToStaticMarkup(<RoomLogControl entries={entries} />)

    expect(html).toContain('aria-label="查看操作日志"')
    expect(html).not.toContain('data-unread')
    expect(html).not.toContain('notification')
  })

  it('renders public operations in order without timestamps or a clear action', () => {
    const html = renderToStaticMarkup(
      <RoomLogPanel entries={entries} onClose={vi.fn()} />,
    )

    expect(html.indexOf(entries[0].title)).toBeLessThan(html.indexOf(entries[1].title))
    expect(html).toContain(entries[1].detail)
    expect(html).not.toContain('清空')
    expect(html).not.toMatch(/\d{1,2}:\d{2}/)
  })
})
