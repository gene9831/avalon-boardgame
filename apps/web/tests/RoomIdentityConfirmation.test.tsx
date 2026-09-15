import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSeatLayout } from '@avalon/ui-layout'

import { RoomIdentityConfirmationScene } from '../src/RoomIdentityConfirmationScene'
import type {
  RoomActionsByKind,
  RoomIdentityConfirmationScene as RoomIdentityConfirmationSceneData,
} from '../src/room-screen-props'

const interactivePlayer = {
  playerID: '0', relativeSeatIndex: 0, seatNumber: 1, name: 'Alice', occupied: true,
  isCurrentPlayer: true,
  portrait: { kind: 'playerAvatar', avatarID: 'merlin', connected: true },
  markers: [], caption: { kind: 'none' }, emphasis: 'selected',
  interaction: { kind: 'selectTeam', disabled: false, selected: true },
} as const satisfies RoomIdentityConfirmationSceneData['players'][number]

const interactivePlayerSeat: PlayerSeatLayout = {
  relativeSeatIndex: 0,
  playerSeatBounds: { x: 0, y: 0, width: 92, height: 88 },
  playerBoundaryCircle: { center: { x: 46, y: 34 }, radius: 46 },
  avatarRect: { x: 22, y: 10, width: 48, height: 48 },
  nameRect: { x: 0, y: 64, width: 92, height: 22 }, avatarTopClearance: 10,
}

const actions = (): RoomActionsByKind['identityConfirmation'] => ({
  onConfirm: vi.fn(),
  onHide: vi.fn(),
  onHideComplete: vi.fn(),
  onReveal: vi.fn(),
  onRevealComplete: vi.fn(),
})

function scene(
  view: RoomIdentityConfirmationSceneData['view'],
  confirmRequestState: RoomIdentityConfirmationSceneData['confirmRequestState'] = 'idle',
): RoomIdentityConfirmationSceneData {
  return {
    kind: 'identityConfirmation', matchID: 'ABC123456', playerCount: 5, players: [], questProgress: [],
    role: 'merlin', view, completedCount: 1, participantCount: 5,
    confirmRequestState,
  }
}

function renderScene(
  view: RoomIdentityConfirmationSceneData['view'],
  confirmRequestState: RoomIdentityConfirmationSceneData['confirmRequestState'] = 'idle',
) {
  return renderToStaticMarkup(
    <RoomIdentityConfirmationScene
      actions={actions()}
      geometry={{ stageLayout: {
        status: 'ready', shape: 'circle', tabletop: { x: 0, y: 0, width: 300, height: 300 },
        centerPanel: { x: 74, y: 74, width: 152, height: 152 }, playerSeats: [],
      } }}
      scene={scene(view, confirmRequestState)}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

describe('RoomIdentityConfirmationScene', () => {
  it('keeps the private role absent until the viewer explicitly reveals it', () => {
    const html = renderScene('concealed')

    expect(html).toContain('data-room-scene="identityConfirmation"')
    expect(html).toContain('aria-label="揭示身份"')
    expect(html).toContain('请确保其他玩家无法看到你的屏幕')
    expect(html).not.toContain('data-identity-role-artwork')
    expect(html).not.toContain('梅林')
  })

  it('removes preexisting seat interactions from the private confirmation scene', () => {
    const current = { ...scene('concealed'), players: [interactivePlayer] }
    const html = renderToStaticMarkup(
      <RoomIdentityConfirmationScene
        actions={actions()}
        geometry={{ stageLayout: {
          status: 'ready', shape: 'circle', tabletop: { x: 0, y: 0, width: 300, height: 300 },
          centerPanel: { x: 74, y: 74, width: 152, height: 152 }, playerSeats: [interactivePlayerSeat],
        } }}
        scene={current}
        slots={{ back: null, toolbar: null }}
      />,
    )

    expect(html).toContain('data-player-id="0"')
    expect(html).toContain('>Alice</span>')
    expect(html).not.toMatch(/<button[^>]*data-player-id="0"/)
  })

  it('reveals the complete private role card without recognition knowledge', () => {
    const html = renderScene('revealed')

    expect(html).toContain('data-identity-role-artwork="merlin"')
    expect(html).toContain('梅林')
    expect(html).toContain('正义阵营')
    expect(html).toContain('你的目标')
    expect(html).toContain('角色能力')
    expect(html).toContain('行动提示')
    expect(html).not.toContain('你知道的玩家')
    expect(html).toContain('暂时隐藏')
    expect(html).toContain('我已记住身份')
  })

  it('keeps the fixed role card separate from independently scrolling details', () => {
    const html = renderScene('revealed')
    const css = readFileSync(new URL('../src/RoomIdentityConfirmation.css', import.meta.url), 'utf8')

    expect(html).toMatch(/identity-confirmation-card-motion.*identity-confirmation-details-slot/s)
    expect(css).toMatch(/\.identity-confirmation-card-motion\s*\{[^}]*position:\s*absolute;/s)
    expect(css).toMatch(/\.identity-confirmation-details\s*\{[^}]*overflow-y:\s*auto;/s)
  })

  it('keeps the concealed controls while the role card is revealing', () => {
    const html = renderScene('revealing')

    expect(html).toContain('data-identity-card-motion="revealing"')
    expect(html).toContain('data-identity-role-artwork="merlin"')
    expect(html).toContain('确认你的身份')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('我已记住身份')
  })

  it('keeps the revealed controls while the role card is hiding', () => {
    const html = renderScene('hiding')

    expect(html).toContain('data-identity-card-motion="hiding"')
    expect(html).toContain('data-identity-role-artwork="merlin"')
    expect(html).toContain('记住你的身份')
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })

  it('keeps the original confirmation label while only the request is pending', () => {
    const html = renderScene('revealed', 'pending')

    expect(html).toContain('data-identity-role-artwork="merlin"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>我已记住身份<\/button>/)
    expect(html).not.toContain('正在确认')
  })
})
