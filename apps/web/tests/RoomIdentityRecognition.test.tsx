import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSeatLayout } from '@avalon/ui-layout'

import { RoomIdentityRecognitionScene } from '../src/RoomIdentityRecognitionScene'
import type {
  RoomActionsByKind,
  RoomIdentityClue,
  RoomIdentityRecognitionScene as RoomIdentityRecognitionSceneData,
  RoomPlayerPresentation,
} from '../src/room-screen-props'

const players: readonly RoomPlayerPresentation[] = ['0', '1', '2'].map((playerID, relativeSeatIndex) => ({
  playerID, relativeSeatIndex, seatNumber: relativeSeatIndex + 1,
  name: ['Alice', 'Bob', 'Carol'][relativeSeatIndex], occupied: true, isCurrentPlayer: playerID === '2',
  portrait: { kind: 'playerAvatar', avatarID: 'merlin', connected: true },
  markers: playerID === '0' ? [{ kind: 'knownEvil' }] : [],
  caption: { kind: 'none' }, emphasis: playerID === '0' ? 'knownEvil' : 'default',
  interaction: playerID === '1'
    ? { kind: 'selectTeam', disabled: false, selected: false }
    : { kind: 'none' },
}))

const playerSeats: readonly PlayerSeatLayout[] = players.map((player) => ({
  relativeSeatIndex: player.relativeSeatIndex,
  playerSeatBounds: { x: player.relativeSeatIndex * 100, y: 0, width: 92, height: 88 },
  playerBoundaryCircle: { center: { x: player.relativeSeatIndex * 100 + 46, y: 34 }, radius: 46 },
  avatarRect: { x: player.relativeSeatIndex * 100 + 22, y: 10, width: 48, height: 48 },
  nameRect: { x: player.relativeSeatIndex * 100, y: 64, width: 92, height: 22 }, avatarTopClearance: 10,
}))

const actions = (): RoomActionsByKind['identityRecognition'] => ({
  onConfirm: vi.fn(), onReveal: vi.fn(), onRevealComplete: vi.fn(),
})

function scene(
  view: RoomIdentityRecognitionSceneData['view'],
  clue: RoomIdentityClue = { kind: 'merlinEvil', targetPlayerIDs: ['0'] },
  confirmRequestState: RoomIdentityRecognitionSceneData['confirmRequestState'] = 'idle',
): RoomIdentityRecognitionSceneData {
  return {
    kind: 'identityRecognition', matchID: 'ABC123456', playerCount: 3, players, questProgress: [],
    clue, view, confirmedCount: view === 'waiting' ? 3 : 1, participantCount: 5, confirmRequestState,
  }
}

function renderScene(
  view: RoomIdentityRecognitionSceneData['view'],
  clue?: RoomIdentityClue,
  confirmRequestState: RoomIdentityRecognitionSceneData['confirmRequestState'] = 'idle',
) {
  return renderToStaticMarkup(
    <RoomIdentityRecognitionScene
      actions={actions()}
      geometry={{ stageLayout: {
        status: 'ready', shape: 'circle', tabletop: { x: 0, y: 0, width: 300, height: 300 },
        centerPanel: { x: 74, y: 74, width: 152, height: 152 }, playerSeats,
      } }}
      scene={scene(view, clue, confirmRequestState)}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

describe('RoomIdentityRecognitionScene', () => {
  it('locks the reveal control until the clue transition finishes', () => {
    const html = renderScene('revealing')

    expect(html).toContain('查看线索')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('我已辨认')
  })

  it('uses a decorative night atmosphere instead of a content overlay', () => {
    const html = renderScene('revealed')

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-identity-recognition-atmosphere="revealed"')
    expect(html).not.toContain('身份辨认幕布')
  })

  it('maps only supplied target IDs onto normalized recognition seats', () => {
    const html = renderScene('revealed')

    expect(html).toMatch(/data-player-id="0"[^>]*data-recognition-seat-state="target"[^>]*data-recognition-tone="evil"/)
    expect(html).toMatch(/data-player-id="2"[^>]*data-recognition-seat-state="self"[^>]*data-recognition-tone="self"/)
    expect(html).toMatch(/data-player-id="1"[^>]*data-recognition-seat-state="dimmed"/)
    expect(html).toContain('>邪恶</span>')
    expect(html).toContain('>你</span>')
  })

  it('removes preexisting seat interactions from the private recognition scene', () => {
    const html = renderScene('revealed')

    expect(html).toContain('data-player-id="1"')
    expect(html).toContain('>Bob</span>')
    expect(html).not.toMatch(/<button[^>]*data-player-id="1"/)
  })

  it('keeps the original target clue and label while confirmation is pending', () => {
    const html = renderScene('revealed', undefined, 'pending')

    expect(html).toContain('奥术视野')
    expect(html).toContain('1 名邪恶玩家')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>我已辨认<\/button>/)
    expect(html).not.toContain('正在确认')
  })

  it('keeps the no-clue confirmation label while the request is pending', () => {
    const html = renderScene('revealed', { kind: 'none', targetPlayerIDs: [] }, 'pending')

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>我已了解<\/button>/)
    expect(html).not.toContain('正在确认')
  })

  it('clears every private clue before showing aggregate waiting progress', () => {
    const html = renderScene('waiting')

    expect(html).toMatch(/3 \/ 5.*玩家已完成辨认.*等待其他玩家/s)
    expect(html).not.toContain('奥术视野')
    expect(html).not.toContain('data-identity-recognition-label')
    expect(html).not.toContain('data-recognition-seat-state="target"')
    expect(html).not.toContain('data-identity-recognition-atmosphere')
    expect(html).not.toContain('已知阵营信息')
    expect(html).not.toContain('data-avatar-state="known-evil"')
  })
})
