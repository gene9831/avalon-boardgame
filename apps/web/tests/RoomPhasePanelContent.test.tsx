import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomPhasePanel } from '../src/RoomPhasePanel'
import { RoomPhasePanelContent } from '../src/RoomPhasePanelContent'
import type { RoomPhaseModel, RoomScreenActions } from '../src/room-screen-model'

const actions: RoomScreenActions = {
  onActivatePlayer: vi.fn(), onStart: vi.fn(), onConfirmIdentityRecognition: vi.fn(),
  onReconnect: vi.fn(), onSubmitTeam: vi.fn(), onSelectTeamVote: vi.fn(), onConfirmTeamVote: vi.fn(),
  onSelectQuestCard: vi.fn(), onConfirmQuestCard: vi.fn(), onAssassinate: vi.fn(),
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
  it('inherits one serif baseline and preserves the bottom action band without an action', () => {
    const content = RoomPhasePanelContent({
      actions,
      model: { kind: 'loading', title: '连接房间', message: '正在连接' },
    })
    const html = renderToStaticMarkup(
      <RoomPhasePanel action={content.action} middle={content.middle} />,
    )

    expect(html).toContain('font-avalon-serif')
    expect(html).toContain('grid-rows-[minmax(0,1fr)_3.5rem]')
    expect(html).toContain('data-room-slot="phase-middle"')
    expect(html).toContain('data-room-slot="phase-action"')
  })

  it.each([
    [{ isOwner: true, occupied: 3, total: 5 }, '还差 2 位玩家即可开始', '开始游戏', true],
    [{ isOwner: true, occupied: 5, total: 5 }, '所有玩家已入座，可以开始游戏', '开始游戏', false],
    [{ isOwner: false, occupied: 3, total: 5 }, '还差 2 位玩家', '', false],
    [{ isOwner: false, occupied: 5, total: 5 }, '所有玩家已入座', '', false],
  ] as const)('renders the approved lobby phase contract', (state, middleText, actionText, disabled) => {
    const html = render({
      kind: 'lobby', title: '等待玩家',
      canStart: state.isOwner && state.occupied === state.total,
      startPending: false,
      ...state,
    })

    expect(html.middle).toContain(middleText)
    expect(html.action).toContain(actionText)
    expect(html.action.includes('disabled=""')).toBe(disabled)
  })

  it('moves manual reconnect into the bottom action slot only after the delay', () => {
    const automatic = render({
      kind: 'connectionRecovery', title: '正在重新连接',
      manualReconnectAvailable: false,
    })
    const manual = render({
      kind: 'connectionRecovery', title: '正在重新连接',
      manualReconnectAvailable: true,
    })

    expect(automatic.action).toBe('')
    expect(manual.action).toContain('>重新连接<')
  })

  it('renders recognition confirmation and progress in the phase panel', () => {
    const html = render({
      kind: 'identityRecognition', title: '身份辨认', confirmationLabel: '我已确认身份', confirmed: false,
      confirmedCount: 1, participantCount: 5, isParticipant: true,
    })
    expect(html.middle).toContain('1 / 5 已确认')
    expect(html.action).toContain('我已确认身份')
  })

  it('separates the leader selection instructions from the state-changing action', () => {
    const selecting = render({
      kind: 'teamProposal', title: '组建任务队伍', requiredTeamSize: 2,
      selectedCount: 1, isLeader: true, canSubmit: false, isSubmitting: false,
    })
    const complete = render({
      kind: 'teamProposal', title: '组建任务队伍', requiredTeamSize: 2,
      selectedCount: 2, isLeader: true, canSubmit: true, isSubmitting: false,
    })
    const submitting = render({
      kind: 'teamProposal', title: '组建任务队伍', requiredTeamSize: 2,
      selectedCount: 2, isLeader: true, canSubmit: false, isSubmitting: true,
    })

    expect(selecting.middle).toContain('请选择 <strong class="text-amber-200">2 名玩家</strong>')
    expect(selecting.middle).toContain('已选 <strong class="text-cyan-200">1 / 2</strong>')
    expect(selecting.action).toContain('>确认队伍<')
    expect(selecting.action).toContain('disabled=""')
    expect(complete.action).toContain('>确认队伍<')
    expect(complete.action).not.toContain('disabled=""')
    expect(submitting.action).toContain('>正在确认…<')
    expect(submitting.action).toContain('disabled=""')
  })

  it('gives non-leaders waiting copy without a bottom action', () => {
    const html = render({
      kind: 'teamProposal', title: '等待队长组队', requiredTeamSize: 2,
      selectedCount: 0, isLeader: false, canSubmit: false, isSubmitting: false,
    })

    expect(html.middle).toContain('队长正在组建任务队伍')
    expect(html.action).toBe('')
  })

  it('gives a Good quest member one fixed Success card and a bottom confirmation', () => {
    const html = render({
      kind: 'quest', title: '执行任务', isOnTeam: true, isEvil: false,
      selectedCard: 'success', submittedCard: null, canSelect: true,
      canConfirm: true, isSubmitting: false,
    })

    expect(html.middle).toContain('正义阵营只能提交成功牌')
    expect(html.middle).toContain('data-quest-card="success"')
    expect(html.middle).not.toContain('data-quest-card="fail"')
    expect(html.action).toContain('>确认成功牌<')
    expect(html.action).not.toContain('disabled=""')
  })

  it('requires an Evil quest member to select a card before confirmation', () => {
    const unselected = render({
      kind: 'quest', title: '执行任务', isOnTeam: true, isEvil: true,
      selectedCard: null, submittedCard: null, canSelect: true,
      canConfirm: false, isSubmitting: false,
    })
    const selected = render({
      kind: 'quest', title: '执行任务', isOnTeam: true, isEvil: true,
      selectedCard: 'fail', submittedCard: null, canSelect: true,
      canConfirm: true, isSubmitting: false,
    })

    expect(unselected.middle).toContain('data-quest-card="success"')
    expect(unselected.middle).toContain('data-quest-card="fail"')
    expect(unselected.action).toContain('disabled=""')
    expect(selected.middle).toContain('aria-pressed="true"')
    expect(selected.action).not.toContain('disabled=""')
  })

  it('requires a team vote choice before enabling the bottom confirmation action', () => {
    const unselected = render({
      kind: 'teamVote', title: '表决任务队伍', selectedVote: null,
      submittedVote: null, canVote: true, isSubmitting: false,
    })
    const selected = render({
      kind: 'teamVote', title: '表决任务队伍', selectedVote: 'approve',
      submittedVote: null, canVote: true, isSubmitting: false,
    })

    expect(unselected.middle).toContain('aria-label="同意任务队伍"')
    expect(unselected.middle).toContain('aria-label="反对任务队伍"')
    expect(unselected.action).toContain('>确认投票<')
    expect(unselected.action).toContain('disabled=""')
    expect(selected.middle).toContain('aria-pressed="true"')
    expect(selected.action).not.toContain('disabled=""')
  })

  it('locks a team vote while submitting and after confirmation', () => {
    const submitting = render({
      kind: 'teamVote', title: '表决任务队伍', selectedVote: 'reject',
      submittedVote: null, canVote: false, isSubmitting: true,
    })
    const submitted = render({
      kind: 'teamVote', title: '表决任务队伍', selectedVote: null,
      submittedVote: 'reject', canVote: false, isSubmitting: false,
    })

    expect(submitting.middle.match(/disabled=""/g)).toHaveLength(2)
    expect(submitting.action).toContain('>正在确认…<')
    expect(submitted.middle).toContain('aria-pressed="true"')
    expect(submitted.action).toContain('>已确认<')
  })

  it('locks the selected quest card while submitting', () => {
    const quest = render({
      kind: 'quest', title: '执行任务', isOnTeam: true, isEvil: true,
      selectedCard: 'fail', submittedCard: null, canSelect: false,
      canConfirm: false, isSubmitting: true,
    })

    expect(quest.middle.match(/disabled=""/g)).toHaveLength(2)
    expect(quest.action).toContain('>正在确认…<')
    expect(quest.action).toContain('disabled=""')
  })

  it('keeps only the viewer\'s submitted card in waiting copy and removes the bottom action', () => {
    const member = render({
      kind: 'quest', title: '等待任务结果', isOnTeam: true, isEvil: true,
      selectedCard: null, submittedCard: 'fail', canSelect: false,
      canConfirm: false, isSubmitting: false,
    })
    const observer = render({
      kind: 'quest', title: '等待任务结果', isOnTeam: false, isEvil: false,
      selectedCard: null, submittedCard: null, canSelect: false,
      canConfirm: false, isSubmitting: false,
    })

    expect(member.middle).toMatch(/你已提交.*失败牌/s)
    expect(member.middle).toContain('等待其他任务队员')
    expect(member.action).toBe('')
    expect(observer.middle).toContain('任务队员正在秘密提交任务牌')
    expect(observer.action).toBe('')
  })

  it('keeps quest settlement informational and out of the bottom action slot', () => {
    const success = render({
      kind: 'questResult', title: '任务结算', succeeded: true,
      successCount: 3, failCount: 1,
    })
    const failure = render({
      kind: 'questResult', title: '任务结算', succeeded: false,
      successCount: 1, failCount: 2,
    })

    expect(success.middle).toContain('任务成功')
    expect(success.middle).toContain('3 成功 / 1 失败')
    expect(success.middle).toContain('text-emerald-300')
    expect(success.action).toBe('')
    expect(failure.middle).toContain('任务失败')
    expect(failure.middle).toContain('text-rose-300')
    expect(failure.action).toBe('')
  })

  it('gives only the Assassin a target confirmation action', () => {
    const assassin = render({
      kind: 'assassination', title: '刺杀梅林', perspective: 'assassin',
      targetName: null, canSubmit: false, isSubmitting: false,
    })
    const evil = render({
      kind: 'assassination', title: '协助刺杀', perspective: 'evil',
      targetName: null, canSubmit: false, isSubmitting: false,
    })
    const good = render({
      kind: 'assassination', title: '等待刺杀', perspective: 'good',
      targetName: null, canSubmit: false, isSubmitting: false,
    })

    expect(assassin.middle).toContain('选择你认为是梅林的玩家')
    expect(assassin.action).toContain('>确认刺杀<')
    expect(assassin.action).toContain('disabled=""')
    expect(evil.middle).toContain('协助刺客找出梅林')
    expect(evil.action).toBe('')
    expect(good.middle).toContain('等待刺客选择目标')
    expect(good.action).toBe('')
  })

  it('shows the Assassin target and locks confirmation while submitting', () => {
    const selected = render({
      kind: 'assassination', title: '刺杀梅林', perspective: 'assassin',
      targetName: '梅林候选', canSubmit: true, isSubmitting: false,
    })
    const submitting = render({
      kind: 'assassination', title: '刺杀梅林', perspective: 'assassin',
      targetName: '梅林候选', canSubmit: false, isSubmitting: true,
    })

    expect(selected.middle).toContain('目标：梅林候选')
    expect(selected.action).not.toContain('disabled=""')
    expect(submitting.action).toContain('>正在确认…<')
    expect(submitting.action).toContain('disabled=""')
  })

  it('keeps assassination settlement informational', () => {
    const html = render({
      kind: 'assassinationResult', title: '刺杀结果', hit: true,
      targetName: '梅林候选', targetRoleLabel: '梅林', winner: 'evil',
    })

    expect(html.middle).toMatch(/梅林候选.*梅林.*邪恶阵营获胜/s)
    expect(html.action).toBe('')
  })

  it('keeps the final phase informational and points players to the log', () => {
    const html = render({
      kind: 'finished', title: '对局结束',
      message: '所有玩家身份已公开，可查看对局记录', rolesRevealed: true,
    })

    expect(html.title).toContain('对局结束')
    expect(html.middle).toContain('所有玩家身份已公开，可查看对局记录')
    expect(html.action).toBe('')
  })
})
