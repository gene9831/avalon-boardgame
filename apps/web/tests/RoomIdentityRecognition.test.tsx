import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSeatLayout } from '@avalon/ui-layout'

import { RoomIdentityRecognitionScene } from '../src/RoomIdentityRecognitionScene'
import type {
  RoomActionsByKind,
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
  onConfirm: vi.fn(), onHide: vi.fn(), onReveal: vi.fn(), onRevealComplete: vi.fn(),
})

type CluePresentation = Extract<RoomIdentityRecognitionSceneData['presentation'], { kind: 'clue' }>

function clueScene(
  view: CluePresentation['view'],
  confirmRequestState: CluePresentation['confirmRequestState'] = 'idle',
): RoomIdentityRecognitionSceneData {
  return {
    kind: 'identityRecognition', matchID: 'ABC123456', playerCount: 3, players, questProgress: [],
    presentation: {
      kind: 'clue',
      clue: { kind: 'merlinEvil', targetPlayerIDs: ['0'] },
      view,
      confirmRequestState,
    },
    completedCount: 1,
    participantCount: 5,
  }
}

function waitingScene(): RoomIdentityRecognitionSceneData {
  return {
    kind: 'identityRecognition', matchID: 'ABC123456', playerCount: 3, players, questProgress: [],
    presentation: { kind: 'waiting' }, completedCount: 3, participantCount: 5,
  }
}

function renderScene(scene: RoomIdentityRecognitionSceneData) {
  return renderToStaticMarkup(
    <RoomIdentityRecognitionScene
      actions={actions()}
      geometry={{ stageLayout: {
        status: 'ready', shape: 'circle', tabletop: { x: 0, y: 0, width: 300, height: 300 },
        centerPanel: { x: 74, y: 74, width: 152, height: 152 }, playerSeats,
      } }}
      scene={scene}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

describe('RoomIdentityRecognitionScene', () => {
  it('keeps the round table visible while private clue markers are concealed', () => {
    const html = renderScene(clueScene('concealed'))

    expect(html).toContain('data-room-stage="true"')
    expect(html).toContain('查看线索')
    expect(html).not.toContain('data-recognition-seat-state="target"')
    expect(html).not.toContain('身份辨认幕布')
  })

  it('locks the reveal control until the clue transition finishes', () => {
    const html = renderScene(clueScene('revealing'))

    expect(html).toContain('查看线索')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('我已辨认')
  })

  it('maps only supplied target IDs onto normalized recognition seats', () => {
    const html = renderScene(clueScene('revealed'))

    expect(html).toMatch(/data-player-id="0"[^>]*data-recognition-seat-state="target"[^>]*data-recognition-tone="evil"/)
    expect(html).toMatch(/data-player-id="2"[^>]*data-recognition-seat-state="self"[^>]*data-recognition-tone="self"/)
    expect(html).toMatch(/data-player-id="1"[^>]*data-recognition-seat-state="dimmed"/)
    expect(html).toContain('>邪恶</span>')
    expect(html).toContain('暂时隐藏')
    expect(html).toContain('我已辨认')
  })

  it('removes preexisting seat interactions from the private recognition scene', () => {
    const html = renderScene(clueScene('revealed'))

    expect(html).toContain('data-player-id="1"')
    expect(html).toContain('>Bob</span>')
    expect(html).not.toMatch(/<button[^>]*data-player-id="1"/)
  })

  it('preserves the revealed clue while confirmation is pending', () => {
    const html = renderScene(clueScene('revealed', 'pending'))

    expect(html).toContain('奥术视野')
    expect(html).toContain('1 名邪恶玩家')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>我已辨认<\/button>/)
    expect(html).not.toContain('正在确认')
  })

  it('returns completed players to an unobstructed table with anonymous progress', () => {
    const html = renderScene(waitingScene())

    expect(html).toMatch(/3 \/ 5.*玩家已完成身份辨认.*等待其他玩家/s)
    expect(html).toContain('等待其他玩家完成身份辨认')
    expect(html).toContain('data-room-stage="true"')
    expect(html).not.toContain('data-recognition-seat-state="target"')
    expect(html).not.toContain('data-identity-recognition-atmosphere')
    expect(html).not.toContain('身份辨认幕布')
  })
})
