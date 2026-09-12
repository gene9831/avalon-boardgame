import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSeatLayout, RoundTableStageLayoutResult } from '@avalon/ui-layout'

import { HelpProvider } from '../src/HelpProvider'
import { RoomAssassinationPreview } from '../src/RoomAssassinationPreview'
import { RoomAssassinationScene } from '../src/RoomAssassinationScene'
import type { RoomAssassinationScene as Scene, RoomPlayerPresentation } from '../src/room-screen-props'
import { ToastProvider } from '../src/toast'

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
  isCurrentPlayer: false,
  portrait: { kind: 'playerAvatar', avatarID: 'merlin', connected: true },
  markers: [], caption: { kind: 'none' }, emphasis: 'default',
  interaction: { kind: 'selectAssassinationTarget', disabled: false, selected: true },
}

function makeScene(view: Scene['view']): Scene {
  return {
    kind: 'assassination', matchID: 'assassination-room', playerCount: 5,
    players: [player], questProgress: [], view,
  }
}

function render(view: Scene['view']) {
  return renderToStaticMarkup(
    <RoomAssassinationScene
      actions={{ onActivatePlayer: vi.fn(), onAssassinate: vi.fn() }}
      geometry={{ stageLayout }}
      scene={makeScene(view)}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

function renderPreview(scenarioID: 'assassin' | 'evil' | 'good') {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/dev/room-layout/assassination/${scenarioID}`]}>
          <Routes>
            <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomAssassinationScene', () => {
  it.each(['assassin', 'evil', 'good'] as const)('renders the %s preview through the shared formal scene shell', (scenarioID) => {
    const html = renderPreview(scenarioID)

    expect(html).toContain('data-room-preview-shell="true"')
    expect(html).toContain('data-room-scene="assassination"')
    expect(html).toContain('aria-label="打开开发预览控制"')
  })

  it('gives only the selecting Assassin a target control and confirmation action', () => {
    const html = render({ kind: 'selecting', targetPlayerID: '0', canSubmit: true, submitRequestState: 'idle' })

    expect(html).toContain('目标：Alice')
    expect(html).toContain('aria-label="选择 Alice 作为刺杀目标"')
    expect(html).toContain('>确认刺杀</button>')
  })

  it('locks the original action and target selections while pending', () => {
    const html = render({ kind: 'selecting', targetPlayerID: '0', canSubmit: true, submitRequestState: 'pending' })

    expect(html).toMatch(/aria-label="确认刺杀"[^>]*disabled=""/)
    expect(html).toContain('>确认刺杀</button>')
    expect(html).not.toContain('正在确认')
    expect(html).not.toContain('<button aria-label="选择 Alice 作为刺杀目标"')
  })

  it('normalizes Evil and Good observer seats to informational groups', () => {
    const evil = render({ kind: 'observing', perspective: 'evil' })
    const good = render({ kind: 'observing', perspective: 'good' })

    expect(evil).toContain('协助刺客找出梅林')
    expect(good).toContain('等待刺客选择目标')
    expect(evil).toContain('role="group"')
    expect(good).not.toContain('确认刺杀')
    expect(evil).not.toContain('<button aria-label="选择 Alice')
  })

  it('keeps the public assassination result informational and reveals the supplied target role', () => {
    const html = render({ kind: 'result', targetPlayerID: '0', targetRole: 'merlin', hit: true, winner: 'evil' })

    expect(html).toMatch(/Alice.*梅林/s)
    expect(html).toContain('刺杀命中')
    expect(html).toContain('邪恶阵营获胜')
    expect(html).not.toContain('确认刺杀')
    expect(html).not.toContain('<button aria-label="选择 Alice')
  })

  it('renders a supplied assassination miss without restoring an action', () => {
    const html = render({ kind: 'result', targetPlayerID: '0', targetRole: 'percival', hit: false, winner: 'good' })

    expect(html).toMatch(/Alice.*帕西维尔/s)
    expect(html).toContain('刺杀未命中')
    expect(html).toContain('正义阵营获胜')
    expect(html).not.toContain('确认刺杀')
  })
})
