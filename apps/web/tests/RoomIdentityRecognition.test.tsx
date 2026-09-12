import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  RoomIdentityRecognitionCenter,
  RoomIdentityRecognitionPhaseContent,
  RoomIdentityRecognitionStage,
  type RoomIdentityRecognitionPresentation,
} from '../src/RoomIdentityRecognition'
import { getRoomIdentityRecognitionSeat } from '../src/room-identity-recognition-seat'

function presentation(
  state: RoomIdentityRecognitionPresentation['state'],
): RoomIdentityRecognitionPresentation {
  return {
    confirmedCount: 3,
    onConfirm: vi.fn(),
    onReveal: vi.fn(),
    onRevealComplete: vi.fn(),
    participantCount: 5,
    scene: { type: 'merlin-evil', targetPlayerIDs: ['0', '4'] },
    state,
  }
}

describe('RoomIdentityRecognition', () => {
  it('locks the reveal control until the clue transition finishes', () => {
    const revealing = presentation('revealing')
    const revealingAction = renderToStaticMarkup(
      <>{RoomIdentityRecognitionPhaseContent({ presentation: revealing }).action}</>,
    )

    expect(revealingAction).toContain('查看线索')
    expect(revealingAction).toContain('disabled=""')
    expect(revealingAction).not.toContain('我已辨认')
  })

  it('uses a decorative night atmosphere instead of a content overlay', () => {
    const revealed = renderToStaticMarkup(
      <RoomIdentityRecognitionStage presentation={presentation('revealed')} />,
    )
    const waiting = renderToStaticMarkup(
      <RoomIdentityRecognitionStage presentation={presentation('waiting')} />,
    )

    expect(revealed).toContain('aria-hidden="true"')
    expect(revealed).toContain('data-identity-recognition-atmosphere="revealed"')
    expect(revealed).not.toContain('身份辨认幕布')
    expect(waiting).toBe('')
  })

  it('maps only supplied target IDs onto recognition seat states', () => {
    const current = presentation('revealed')

    expect(getRoomIdentityRecognitionSeat(current, '0', false)).toEqual({ label: '邪恶', state: 'target', tone: 'evil' })
    expect(getRoomIdentityRecognitionSeat(current, '2', true)).toEqual({ label: '你', state: 'self' })
    expect(getRoomIdentityRecognitionSeat(current, '1', false)).toEqual({ state: 'dimmed' })
  })

  it('keeps visible clues on screen while confirmation is pending', () => {
    const revealed = presentation('revealed')
    const revealedPhase = RoomIdentityRecognitionPhaseContent({ presentation: revealed })
    const revealedMiddle = renderToStaticMarkup(<>{revealedPhase.middle}</>)
    const revealedAction = renderToStaticMarkup(<>{revealedPhase.action}</>)
    const confirming = presentation('confirming')
    const confirmingCenter = renderToStaticMarkup(
      <RoomIdentityRecognitionCenter presentation={confirming} />,
    )
    const confirmingAction = renderToStaticMarkup(
      <>{RoomIdentityRecognitionPhaseContent({ presentation: confirming }).action}</>,
    )

    expect(revealedMiddle).toContain('2 名邪恶玩家')
    expect(revealedAction).toContain('我已辨认')
    expect(revealedAction).not.toContain('暂时隐藏线索')
    expect(revealedAction.match(/<button/g)).toHaveLength(1)
    expect(confirmingCenter).toContain('奥术视野')
    expect(confirmingAction).toContain('正在确认…')
    expect(confirmingAction.match(/disabled=""/g)).toHaveLength(1)
  })

  it('clears private clues before showing aggregate waiting progress', () => {
    const current = presentation('waiting')
    const center = renderToStaticMarkup(
      <RoomIdentityRecognitionCenter presentation={current} />,
    )
    const phase = RoomIdentityRecognitionPhaseContent({ presentation: current })
    const phaseTitle = renderToStaticMarkup(<>{phase.title}</>)
    const phaseAction = renderToStaticMarkup(<>{phase.action}</>)

    expect(center).toMatch(/3 \/ 5.*玩家已完成辨认.*等待其他玩家/s)
    expect(center).not.toContain('奥术视野')
    expect(phaseTitle).toContain('等待其他玩家')
    expect(phaseAction).toBe('')
  })
})
