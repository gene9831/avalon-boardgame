import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomPhasePanelContent } from '../src/RoomPhasePanelContent'
import type { RoomPhaseModel, RoomScreenActions } from '../src/room-screen-model'

const actions: RoomScreenActions = {
  onActivatePlayer: vi.fn(), onStart: vi.fn(), onConfirmIdentityRecognition: vi.fn(),
  onSubmitTeam: vi.fn(), onCastTeamVote: vi.fn(), onPlayQuestCard: vi.fn(), onAssassinate: vi.fn(),
}

function render(model: RoomPhaseModel) {
  const content = RoomPhasePanelContent({ actions, model })
  return {
    title: renderToStaticMarkup(<>{content.title}</>),
    middle: renderToStaticMarkup(<>{content.middle}</>),
    action: renderToStaticMarkup(<>{content.action}</>),
  }
}

describe('RoomPhasePanelContent', () => {
  it('puts the lobby start action outside the center summary', () => {
    const html = render({ kind: 'lobby', title: '等待玩家', occupied: 5, total: 5, isOwner: true, canStart: true, busy: false })
    expect(html.action).toContain('>开始游戏<')
    expect(html.middle).toContain('5 / 5')
  })

  it('renders recognition confirmation and progress in the phase panel', () => {
    const html = render({
      kind: 'identityRecognition', title: '身份辨认', confirmationLabel: '我已确认身份', confirmed: false,
      confirmedCount: 1, participantCount: 5, isParticipant: true,
    })
    expect(html.middle).toContain('1 / 5 已确认')
    expect(html.action).toContain('我已确认身份')
  })

  it('shows success without a fail choice to a good quest player', () => {
    const html = render({ kind: 'quest', title: '执行任务', status: '请选择任务牌', submittedCard: null, canPlaySuccess: true, canPlayFail: false })
    expect(html.action).toContain('aria-label="让任务成功"')
    expect(html.action).not.toContain('aria-label="让任务失败"')
  })

  it('keeps the viewer\'s submitted vote and quest card visible only in phase copy', () => {
    const vote = render({
      kind: 'teamVote', title: '表决任务队伍', proposedTeamNames: ['Alice', 'Bob'],
      submittedCount: 1, total: 5, submittedVote: 'reject', canVote: false,
    })
    const quest = render({
      kind: 'quest', title: '执行任务', status: '请选择任务牌', submittedCard: 'fail',
      canPlaySuccess: false, canPlayFail: false,
    })

    expect(vote.action).toContain('你已选择：反对')
    expect(quest.action).toContain('你已提交失败，等待任务结算。')
  })
})
