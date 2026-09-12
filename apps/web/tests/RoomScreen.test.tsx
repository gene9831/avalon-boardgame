import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomScreen } from '../src/RoomScreen'
import { ObservedRoomScreen } from '../src/ObservedRoomScreen'
import { RoomIdentityConfirmationScene } from '../src/RoomIdentityConfirmationScene'
import { RoomIdentityRecognitionScene } from '../src/RoomIdentityRecognitionScene'
import { RoomLoadingScene } from '../src/RoomLoadingScene'
import { RoomSceneFrame } from '../src/RoomSceneFrame'

describe('RoomScreen', () => {
  it('gives an informational scene one shared layout and one semantic content slot per region', () => {
    const html = renderToStaticMarkup(
      <RoomSceneFrame
        content={{
          title: '正在加载房间',
          center: '正在读取房间信息…',
          phaseMiddle: '请稍候。',
          phaseAction: null,
          stageAtmosphere: <span>加载中的舞台氛围</span>,
        }}
        geometry={{ stageLayout: null }}
        scene={{
          kind: 'loading', matchID: 'ABC123456', playerCount: null, players: [], questProgress: [], message: '正在读取房间信息…',
        }}
        slots={{ back: <button type="button">返回</button>, toolbar: <button type="button">帮助</button> }}
      />,
    )

    expect(html.match(/class="avalon-room-layout"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="stage"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-middle"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-action"/g)).toHaveLength(1)
    expect(html).toContain('加载中的舞台氛围')
    expect(html).toContain('帮助')
  })

  it('shows recovery status without a reconnect action while automatic recovery is running', () => {
    const html = renderToStaticMarkup(
      <RoomLoadingScene
        actions={{ onReconnect: () => {} }}
        geometry={{ stageLayout: null }}
        scene={{
          kind: 'connectionRecovery', matchID: 'ABC123456', playerCount: null, players: [], questProgress: [],
          manualReconnectAvailable: false,
        }}
        slots={{ back: null, toolbar: null }}
      />,
    )

    expect(html).toContain('正在重新连接')
    expect(html).toContain('正在恢复与房间的连接。')
    expect(html).not.toContain('>重新连接</button>')
  })

  it('shows an enabled reconnect action when recovery requires manual reconnection', () => {
    const html = renderToStaticMarkup(
      <RoomLoadingScene
        actions={{ onReconnect: () => {} }}
        geometry={{ stageLayout: null }}
        scene={{
          kind: 'connectionRecovery', matchID: 'ABC123456', playerCount: null, players: [], questProgress: [],
          manualReconnectAvailable: true,
        }}
        slots={{ back: null, toolbar: null }}
      />,
    )

    const reconnectButton = html.match(/<button[^>]*>重新连接<\/button>/)?.[0] ?? ''

    expect(reconnectButton).toContain('>重新连接</button>')
    expect(reconnectButton).not.toMatch(/\sdisabled(?:=|(?=\s|>))/)
  })

  it('renders a public loading scene with one frame and one complete toolbar slot', () => {
    const html = renderToStaticMarkup(
      <RoomScreen
        actions={null}
        geometry={{ stageLayout: null }}
        scene={{
          kind: 'loading', matchID: 'ABC123456', playerCount: null, players: [], questProgress: [],
          message: '正在读取房间信息…',
        }}
        slots={{
          back: <button type="button">返回</button>,
          toolbar: <div data-complete-toolbar="true"><button type="button">帮助</button><button type="button">记录</button></div>,
        }}
      />,
    )

    expect(html.match(/class="avalon-room-layout"/g)).toHaveLength(1)
    expect(html.match(/class="avalon-room-layout__toolbar"/g)).toHaveLength(1)
    expect(html.match(/data-complete-toolbar="true"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="stage"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-middle"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-action"/g)).toHaveLength(1)
    expect(html).toContain('data-room-scene="loading"')
  })

  it('keeps observation outside the public scene contract', () => {
    const html = renderToStaticMarkup(
      <ObservedRoomScreen
        actions={null}
        scene={{
          kind: 'gameResult', matchID: 'ABC123456', playerCount: 5, players: [], questProgress: [],
          winner: 'good', reason: '三次任务成功', questScore: '3 : 0',
        }}
        slots={{ back: <span>返回</span>, toolbar: <div data-complete-toolbar="true">完整工具栏</div> }}
      />,
    )

    expect(html.match(/class="avalon-room-layout"/g)).toHaveLength(1)
    expect(html).toContain('data-room-scene="gameResult"')
    expect(html).toContain('完整工具栏')
  })

  it('renders identity confirmation through its pure scene entry and shared frame', () => {
    const html = renderToStaticMarkup(
      <RoomIdentityConfirmationScene
        actions={{
          onCloseReview: vi.fn(), onConfirm: vi.fn(), onHide: vi.fn(), onHideComplete: vi.fn(),
          onReveal: vi.fn(), onRevealComplete: vi.fn(), onReview: vi.fn(),
        }}
        geometry={{ stageLayout: null }}
        scene={{
          kind: 'identityConfirmation', matchID: 'ABC123456', playerCount: 5, players: [], questProgress: [],
          role: 'merlin', view: 'concealed', confirmedCount: 0, participantCount: 5,
          confirmRequestState: 'idle',
        }}
        slots={{ back: null, toolbar: null }}
      />,
    )

    expect(html.match(/class="avalon-room-layout"/g)).toHaveLength(1)
    expect(html).toContain('data-room-scene="identityConfirmation"')
    expect(html).toContain('data-identity-confirmation-state="concealed"')
    expect(html).toContain('aria-label="揭示身份"')
    expect(html).not.toContain('梅林')
  })

  it('renders identity recognition through its pure scene entry without role artwork', () => {
    const html = renderToStaticMarkup(
      <RoomIdentityRecognitionScene
        actions={{
          onConfirm: vi.fn(), onReveal: vi.fn(), onRevealComplete: vi.fn(),
        }}
        geometry={{ stageLayout: {
          status: 'ready', shape: 'circle', tabletop: { x: 0, y: 0, width: 300, height: 300 },
          centerPanel: { x: 74, y: 74, width: 152, height: 152 }, playerSeats: [],
        } }}
        scene={{
          kind: 'identityRecognition', matchID: 'ABC123456', playerCount: 5, players: [], questProgress: [],
          clue: { kind: 'evilAllies', targetPlayerIDs: ['0'] }, view: 'revealed',
          confirmedCount: 0, participantCount: 5, confirmRequestState: 'idle',
        }}
        slots={{ back: null, toolbar: null }}
      />,
    )

    expect(html.match(/class="avalon-room-layout"/g)).toHaveLength(1)
    expect(html).toContain('data-room-scene="identityRecognition"')
    expect(html).toContain('data-identity-recognition-state="revealed"')
    expect(html).toContain('data-identity-recognition-center="evilAllies"')
    expect(html).toContain('暗影中的同伴')
    expect(html).not.toContain('data-identity-role-artwork')
  })
})
