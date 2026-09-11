import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { QuestProgressTrack } from '../src/QuestProgressTrack'
import type { QuestProgressNodeModel } from '../src/room-screen-model'

const nodes: readonly QuestProgressNodeModel[] = [
  { questIndex: 0, teamSize: 2, failThreshold: 1, state: 'success' },
  { questIndex: 1, teamSize: 3, failThreshold: 1, state: 'current' },
  { questIndex: 2, teamSize: 2, failThreshold: 1, state: 'upcoming' },
  { questIndex: 3, teamSize: 3, failThreshold: 2, state: 'failure' },
  { questIndex: 4, teamSize: 3, failThreshold: 1, state: 'upcoming' },
]

describe('QuestProgressTrack', () => {
  it('renders five modeled task states and their known requirements', () => {
    const html = renderToStaticMarkup(<QuestProgressTrack nodes={nodes} />)

    expect(html.match(/data-quest-index=/g)).toHaveLength(5)
    expect(html).toContain('第 2 次任务，3 人，需 1 张失败牌才会失败，当前任务')
    expect(html).toContain('lucide-users-round')
    expect(html.match(/lucide-circle-x/g)).toHaveLength(1)
    expect(html).toContain('>II<')
    expect(html).toContain('aria-current="step"')
  })

  it('does not invent requirement metadata for loading placeholders', () => {
    const loadingNodes = nodes.map((node) => ({
      ...node,
      teamSize: null,
      failThreshold: null,
      state: 'upcoming' as const,
    }))
    const html = renderToStaticMarkup(<QuestProgressTrack nodes={loadingNodes} />)

    expect(html.match(/quest-progress-meta/g) ?? []).toHaveLength(0)
    expect(html).toContain('第 1 次任务')
  })
})
