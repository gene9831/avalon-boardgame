import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomTeamVoteScene } from '../src/RoomTeamVoteScene'
import type { RoomTeamVoteScene as Scene } from '../src/room-screen-props'

const stageLayout = {
  status: 'ready' as const,
  shape: 'circle' as const,
  tabletop: { x: 20, y: 40, width: 319, height: 319 },
  centerPanel: { x: 103.5, y: 123.5, width: 152, height: 152 },
  playerSeats: [],
}

function makeScene(view: Scene['view']): Scene {
  return {
    kind: 'teamVote', matchID: 'vote-room', playerCount: 5, players: [], questProgress: [],
    questIndex: 2, submittedCount: 2, participantCount: 5, consecutiveRejectedTeams: 1, view,
  }
}

function render(view: Scene['view']) {
  return renderToStaticMarkup(
    <RoomTeamVoteScene
      actions={{ onSelectVote: vi.fn(), onConfirmVote: vi.fn() }}
      geometry={{ stageLayout }}
      scene={makeScene(view)}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

describe('RoomTeamVoteScene', () => {
  it('requires one private vote choice before enabling confirmation', () => {
    const unselected = render({ kind: 'choosing', selectedVote: null, canChoose: true, submitRequestState: 'idle' })
    const selected = render({ kind: 'choosing', selectedVote: 'approve', canChoose: true, submitRequestState: 'idle' })

    expect(unselected).toContain('2 / 5')
    expect(unselected).toContain('aria-label="同意任务队伍"')
    expect(unselected).toContain('aria-label="反对任务队伍"')
    expect(unselected).toMatch(/aria-label="确认投票"[^>]*disabled=""/)
    expect(selected).toContain('aria-label="同意任务队伍" aria-pressed="true"')
    expect(selected).not.toMatch(/aria-label="确认投票"[^>]*disabled=""/)
  })

  it('keeps the original label and disables both choices while pending', () => {
    const html = render({ kind: 'choosing', selectedVote: 'reject', canChoose: true, submitRequestState: 'pending' })

    expect(html.match(/disabled=""/g)).toHaveLength(3)
    expect(html).toContain('>确认投票</button>')
    expect(html).not.toContain('正在确认')
  })

  it('moves a submitted private vote to waiting and removes every action', () => {
    const html = render({ kind: 'waiting', submittedVote: 'reject' })

    expect(html).toMatch(/你已提交.*反对票/s)
    expect(html).toContain('等待其他玩家投票')
    expect(html).not.toContain('确认投票')
    expect(html).not.toContain('aria-label="同意任务队伍"')
  })
})
