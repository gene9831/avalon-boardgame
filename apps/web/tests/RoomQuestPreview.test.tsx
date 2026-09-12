import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomQuestScene } from '../src/RoomQuestScene'
import type { RoomQuestScene as Scene } from '../src/room-screen-props'

const stageLayout = {
  status: 'ready' as const,
  shape: 'circle' as const,
  tabletop: { x: 20, y: 40, width: 319, height: 319 },
  centerPanel: { x: 103.5, y: 123.5, width: 152, height: 152 },
  playerSeats: [],
}

function makeScene(view: Scene['view']): Scene {
  return {
    kind: 'quest', matchID: 'quest-room', playerCount: 7, players: [], questProgress: [],
    questIndex: 3, requiredSubmissionCount: 4, submittedCount: 2, view,
  }
}

function render(view: Scene['view']) {
  return renderToStaticMarkup(
    <RoomQuestScene
      actions={{ onSelectCard: vi.fn(), onConfirmCard: vi.fn() }}
      geometry={{ stageLayout }}
      scene={makeScene(view)}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

describe('RoomQuestScene', () => {
  it('shows a Good member only the authorized Success choice', () => {
    const html = render({ kind: 'choosing', alignment: 'good', selectedCard: 'success', canChoose: true, submitRequestState: 'idle' })

    expect(html).toContain('data-quest-card="success"')
    expect(html).not.toContain('data-quest-card="fail"')
    expect(html).toContain('正义阵营只能提交成功牌')
    expect(html).toContain('>确认成功牌</button>')
  })

  it('requires an Evil member to select between the authorized Success and Fail choices', () => {
    const unselected = render({ kind: 'choosing', alignment: 'evil', selectedCard: null, canChoose: true, submitRequestState: 'idle' })
    const selected = render({ kind: 'choosing', alignment: 'evil', selectedCard: 'fail', canChoose: true, submitRequestState: 'idle' })

    expect(unselected).toContain('data-quest-card="success"')
    expect(unselected).toContain('data-quest-card="fail"')
    expect(unselected).toMatch(/>确认任务牌<\/button>/)
    expect(unselected).toContain('disabled=""')
    expect(selected).toContain('data-quest-card="fail" aria-pressed="true"')
  })

  it('locks the original action and every available card while pending', () => {
    const html = render({ kind: 'choosing', alignment: 'evil', selectedCard: 'fail', canChoose: true, submitRequestState: 'pending' })

    expect(html.match(/disabled=""/g)).toHaveLength(3)
    expect(html).toContain('>确认任务牌</button>')
    expect(html).not.toContain('正在确认')
  })

  it('keeps only a member private submitted card in waiting copy and exposes no action', () => {
    const member = render({ kind: 'waiting', participation: 'member', submittedCard: 'fail' })
    const observer = render({ kind: 'waiting', participation: 'observer', submittedCard: null })

    expect(member).toMatch(/你已提交.*失败牌/s)
    expect(member).toContain('等待其他任务队员')
    expect(observer).toContain('任务队员正在秘密提交任务牌')
    expect(member).not.toContain('确认任务牌')
    expect(observer).not.toContain('确认成功牌')
  })

  it('keeps the settled public quest outcome informational', () => {
    const success = render({ kind: 'result', succeeded: true, successCount: 3, failCount: 1 })
    const failure = render({ kind: 'result', succeeded: false, successCount: 2, failCount: 2 })

    expect(success).toContain('任务成功')
    expect(success).toContain('3 成功 / 1 失败')
    expect(failure).toContain('任务失败')
    expect(failure).toContain('2 成功 / 2 失败')
    expect(success).not.toContain('确认任务牌')
  })
})
