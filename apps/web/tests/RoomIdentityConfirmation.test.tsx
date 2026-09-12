import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  RoomIdentityConfirmationPhaseContent,
  RoomIdentityConfirmationStage,
  type RoomIdentityConfirmationPresentation,
} from '../src/RoomIdentityConfirmation'

function presentation(
  state: RoomIdentityConfirmationPresentation['state'],
): RoomIdentityConfirmationPresentation {
  return {
    confirmedCount: 1,
    onCloseReview: vi.fn(),
    onConfirm: vi.fn(),
    onHide: vi.fn(),
    onHideComplete: vi.fn(),
    onReveal: vi.fn(),
    onRevealComplete: vi.fn(),
    onReview: vi.fn(),
    participantCount: 5,
    role: 'merlin',
    state,
  }
}

describe('RoomIdentityConfirmation', () => {
  it('reveals the complete private role summary without releasing recognition knowledge', () => {
    const current = presentation('revealed')
    const stage = renderToStaticMarkup(
      <RoomIdentityConfirmationStage presentation={current} />,
    )
    const phase = RoomIdentityConfirmationPhaseContent({ presentation: current })
    const phaseAction = renderToStaticMarkup(<>{phase.action}</>)

    expect(stage).toContain('data-identity-confirmation-stage="revealed"')
    expect(stage).toContain('data-identity-role-artwork="merlin"')
    expect(stage).toContain('梅林')
    expect(stage).toContain('正义阵营')
    expect(stage).toContain('你的目标')
    expect(stage).toContain('角色能力')
    expect(stage).toContain('行动提示')
    expect(stage).not.toContain('你知道的玩家')
    expect(`${stage}${phaseAction}`).not.toContain('仅你可见')
    expect(phaseAction).toContain('暂时隐藏')
    expect(phaseAction).toContain('我已记住身份')
  })

  it('keeps the concealed phase controls while the role card is revealing', () => {
    const current = presentation('revealing')
    const stage = renderToStaticMarkup(
      <RoomIdentityConfirmationStage presentation={current} />,
    )
    const phase = RoomIdentityConfirmationPhaseContent({ presentation: current })
    const phaseTitle = renderToStaticMarkup(<>{phase.title}</>)
    const phaseAction = renderToStaticMarkup(<>{phase.action}</>)

    expect(stage).toContain('data-identity-card-motion="revealing"')
    expect(stage).toContain('data-identity-role-artwork="merlin"')
    expect(phaseTitle).toContain('确认你的身份')
    expect(phaseAction).toContain('disabled=""')
    expect(phaseAction).not.toContain('我已记住身份')
  })

  it('keeps the revealed phase controls while the role card is hiding', () => {
    const current = presentation('hiding')
    const stage = renderToStaticMarkup(
      <RoomIdentityConfirmationStage presentation={current} />,
    )
    const phase = RoomIdentityConfirmationPhaseContent({ presentation: current })
    const phaseTitle = renderToStaticMarkup(<>{phase.title}</>)
    const phaseAction = renderToStaticMarkup(<>{phase.action}</>)

    expect(stage).toContain('data-identity-card-motion="hiding"')
    expect(stage).toContain('data-identity-role-artwork="merlin"')
    expect(phaseTitle).toContain('记住你的身份')
    expect(phaseAction.match(/disabled=""/g)).toHaveLength(2)
  })

  it('returns to the unobstructed round table after the viewer confirms', () => {
    const current = { ...presentation('waiting'), confirmedCount: 3 }
    const stage = renderToStaticMarkup(
      <RoomIdentityConfirmationStage presentation={current} />,
    )
    const phase = RoomIdentityConfirmationPhaseContent({ presentation: current })
    const phaseMiddle = renderToStaticMarkup(<>{phase.middle}</>)
    const phaseAction = renderToStaticMarkup(<>{phase.action}</>)

    expect(stage).toBe('')
    expect(phaseMiddle).toContain('你的身份已确认')
    expect(phaseAction).toContain('再次查看身份')
  })

  it('reopens a confirmed identity for review without offering confirmation again', () => {
    const current = presentation('reviewing')
    const stage = renderToStaticMarkup(
      <RoomIdentityConfirmationStage presentation={current} />,
    )
    const phase = RoomIdentityConfirmationPhaseContent({ presentation: current })
    const phaseAction = renderToStaticMarkup(<>{phase.action}</>)

    expect(stage).toContain('data-identity-confirmation-stage="reviewing"')
    expect(stage).toContain('data-identity-role-artwork="merlin"')
    expect(phaseAction).toContain('收起身份')
    expect(phaseAction).not.toContain('我已记住身份')
  })

  it('keeps the identity visible while the confirmation request is pending', () => {
    const current = presentation('confirming')
    const stage = renderToStaticMarkup(
      <RoomIdentityConfirmationStage presentation={current} />,
    )
    const phase = RoomIdentityConfirmationPhaseContent({ presentation: current })
    const phaseAction = renderToStaticMarkup(<>{phase.action}</>)

    expect(stage).toContain('data-identity-role-artwork="merlin"')
    expect(phaseAction).toContain('正在确认…')
    expect(phaseAction.match(/disabled=""/g)).toHaveLength(2)
  })
})
