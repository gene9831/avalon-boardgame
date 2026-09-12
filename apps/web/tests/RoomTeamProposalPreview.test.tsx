import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSeatLayout, RoundTableStageLayoutResult } from '@avalon/ui-layout'

import { RoomTeamProposalScene } from '../src/RoomTeamProposalScene'
import type { RoomPlayerPresentation, RoomTeamProposalScene as Scene } from '../src/room-screen-props'

const playerLayout: PlayerSeatLayout = {
  relativeSeatIndex: 0,
  playerSeatBounds: { x: 100, y: 200, width: 92, height: 88 },
  playerBoundaryCircle: { center: { x: 146, y: 234 }, radius: 46 },
  avatarRect: { x: 122, y: 210, width: 48, height: 48 },
  nameRect: { x: 100, y: 264, width: 92, height: 22 },
  avatarTopClearance: 10,
}
const stageLayout: RoundTableStageLayoutResult = {
  status: 'ready', shape: 'circle',
  tabletop: { x: 20, y: 40, width: 319, height: 319 },
  centerPanel: { x: 103.5, y: 123.5, width: 152, height: 152 },
  playerSeats: [playerLayout],
}
const player: RoomPlayerPresentation = {
  playerID: '0', relativeSeatIndex: 0, seatNumber: 1, name: 'Alice', occupied: true,
  isCurrentPlayer: true,
  portrait: { kind: 'playerAvatar', avatarID: 'merlin', connected: true },
  markers: [{ kind: 'leader' }], caption: { kind: 'none' }, emphasis: 'default',
  interaction: { kind: 'selectTeam', disabled: false, selected: false },
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    kind: 'teamProposal', matchID: 'proposal-room', playerCount: 5,
    players: [player], questProgress: [], questIndex: 1, requiredTeamSize: 3,
    selectedCount: 0, consecutiveRejectedTeams: 2, perspective: 'leader',
    canSubmit: false, submitRequestState: 'idle', ...overrides,
  }
}

function render(scene: Scene) {
  return renderToStaticMarkup(
    <RoomTeamProposalScene
      actions={{ onActivatePlayer: vi.fn(), onSubmitTeam: vi.fn() }}
      geometry={{ stageLayout }}
      scene={scene}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

describe('RoomTeamProposalScene', () => {
  it('gives the leader selectable seats and enables the exact team action only when ready', () => {
    const incomplete = render(makeScene())
    const complete = render(makeScene({ selectedCount: 3, canSubmit: true }))

    expect(incomplete).toContain('已选 <strong class="text-cyan-200">0 / 3</strong>')
    expect(incomplete).toContain('aria-label="选择 Alice 加入任务队伍')
    expect(incomplete).toMatch(/aria-label="确认队伍"[^>]*disabled=""/)
    expect(complete).toMatch(/aria-label="确认队伍"/)
    expect(complete).not.toMatch(/aria-label="确认队伍"[^>]*disabled=""/)
  })

  it('locks the original team action and every seat selection while pending', () => {
    const html = render(makeScene({ selectedCount: 3, canSubmit: true, submitRequestState: 'pending' }))

    expect(html).toMatch(/aria-label="确认队伍"[^>]*disabled=""/)
    expect(html).toContain('>确认队伍</button>')
    expect(html).not.toContain('正在确认')
    expect(html).not.toContain('<button aria-label="选择 Alice 加入任务队伍')
  })

  it('normalizes observer seats to non-actionable groups and removes the bottom action', () => {
    const html = render(makeScene({ perspective: 'observer' }))

    expect(html).toContain('队长正在组建任务队伍')
    expect(html).toContain('role="group"')
    expect(html).not.toContain('确认队伍')
    expect(html).not.toContain('<button aria-label="选择 Alice')
  })
})
