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

type CluePresentation = Extract<RoomIdentityRecognitionSceneData['presentation'], { kind: 'clue' }>

function scene(
  view: CluePresentation['view'],
  clue: RoomIdentityClue = { kind: 'merlinEvil', targetPlayerIDs: ['0'] },
  confirmRequestState: CluePresentation['confirmRequestState'] = 'idle',
): RoomIdentityRecognitionSceneData {
  return {
    kind: 'identityRecognition', matchID: 'ABC123456', playerCount: 3, players, questProgress: [],
    presentation: { kind: 'clue', clue, view, confirmRequestState },
    confirmedCount: view === 'waiting' ? 3 : 1, participantCount: 5,
  }
}

function renderScene(
  view: CluePresentation['view'],
  clue?: RoomIdentityClue,
  confirmRequestState: CluePresentation['confirmRequestState'] = 'idle',
) {
  return renderSceneData(scene(view, clue, confirmRequestState))
}

function renderSceneData(sceneData: RoomIdentityRecognitionSceneData) {
  return renderToStaticMarkup(
    <RoomIdentityRecognitionScene
      actions={actions()}
      geometry={{ stageLayout: {
        status: 'ready', shape: 'circle', tabletop: { x: 0, y: 0, width: 300, height: 300 },
        centerPanel: { x: 74, y: 74, width: 152, height: 152 }, playerSeats,
      } }}
      scene={sceneData}
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

  it.each(['concealed', 'revealing', 'revealed'] as const)(
    'shows no-clue confirmation directly when view is %s', (view) => {
      const html = renderScene(view, { kind: 'none', targetPlayerIDs: [] })

      expect(html).toContain('data-identity-recognition-center="none"')
      expect(html).toContain('没有额外线索')
      expect(html).toContain('你没有需要辨认的玩家')
      expect(html).toContain('class="block text-lg font-semibold text-amber-100"')
      expect(html).toContain('class="mt-1 block text-sm leading-5 text-slate-300"')
      expect(html).toMatch(/<button[^>]*>我已了解<\/button>/)
      expect(html).not.toContain('查看线索')
      expect(html).not.toContain('data-identity-recognition-atmosphere="')
    },
  )

  it('does not include a trailing period in no-clue center text', () => {
    const html = renderScene('revealed', { kind: 'none', targetPlayerIDs: [] })

    expect(html).toContain('没有额外线索')
    expect(html).not.toContain('通过其他玩家的发言和投票判断阵营。')
  })

  it('clears every private clue before showing aggregate waiting progress', () => {
    const html = renderScene('waiting')

    expect(html).toMatch(/3 \/ 5.*玩家已完成辨认.*等待其他玩家/s)
    expect(html).toContain('class="block text-lg font-semibold text-amber-100"')
    expect(html).toContain('class="mt-1 block text-sm text-slate-400"')
    expect(html).not.toContain('奥术视野')
    expect(html).not.toContain('data-identity-recognition-label')
    expect(html).not.toContain('data-recognition-seat-state="target"')
    expect(html).not.toContain('data-identity-recognition-atmosphere')
    expect(html).not.toContain('已知阵营信息')
    expect(html).not.toContain('data-avatar-state="known-evil"')
  })

  it('shows the complete authorized role card and retains it after confirmation', () => {
    const roleReveal = (view: 'revealed' | 'waiting'): RoomIdentityRecognitionSceneData => ({
      kind: 'identityRecognition', matchID: 'ABC123456', playerCount: 3, players, questProgress: [],
      presentation: { kind: 'roleReveal', role: 'merlin', view, confirmRequestState: 'idle' },
      confirmedCount: view === 'waiting' ? 1 : 0, participantCount: 3,
    })

    const revealed = renderSceneData(roleReveal('revealed'))
    const waiting = renderSceneData(roleReveal('waiting'))

    for (const html of [revealed, waiting]) {
      expect(html).toContain('data-curtain-state="lowered"')
      expect(html).toContain('data-role-card="merlin"')
      expect(html).toContain('aria-label="我的身份：梅林"')
      expect(html).toContain('本局目标：')
    }
    expect(revealed).toContain('>我已确认身份<')
    expect(waiting).toContain('你的身份已确认，等待其他玩家')
    expect(waiting).not.toContain('>我已确认身份<')
  })

  it('keeps observers behind a closed opaque curtain without private content or actions', () => {
    const html = renderSceneData({
      kind: 'identityRecognition', matchID: 'ABC123456', playerCount: 3, players, questProgress: [],
      presentation: { kind: 'observer' }, confirmedCount: 1, participantCount: 2,
    })

    expect(html).toContain('data-curtain-state="closed"')
    expect(html).toContain('等待参与玩家完成辨认')
    expect(html).not.toContain('data-role-card=')
    expect(html).not.toContain('data-role-avatar=')
    expect(html).not.toContain('data-recognition-seat-state="target"')
    expect(html).not.toContain('你的线索已确认')
    expect(html).not.toContain('<button')
  })
})
