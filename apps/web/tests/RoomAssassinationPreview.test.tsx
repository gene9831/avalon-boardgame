import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HelpProvider } from '../src/HelpProvider'
import { RoomAssassinationPreview } from '../src/RoomAssassinationPreview'
import { withAssassinationOutcome } from '../src/room-assassination-preview-model'
import type { RoomScreenModel } from '../src/room-screen-model'
import { ToastProvider } from '../src/toast'

function renderPreview(path: string) {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination" />
            <Route element={<RoomAssassinationPreview />} path="/dev/room-layout/assassination/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomAssassinationPreview', () => {
  it('normalizes the temporary assassination outcome target for the production seat renderer', () => {
    const baseModel: RoomScreenModel = {
      mode: 'assassination', matchID: 'assassination-preview-assassin', numPlayers: 1,
      connected: true,
      players: [{
        playerID: '0', relativeSeatIndex: 0, seatNumber: 1, name: '苍 1', occupied: true,
        isCurrentPlayer: false,
        portrait: { kind: 'playerAvatar', avatarID: 'merlin', connected: true },
        markers: [], caption: { kind: 'none' }, emphasis: 'default', interaction: { kind: 'none' },
      }],
      playerInteractionMode: 'none', questProgress: [],
      center: {
        kind: 'assassinationSummary', title: '刺杀梅林', status: '正在确认', detail: '',
        statusTone: 'neutral',
      },
      phase: {
        kind: 'assassination', title: '刺杀梅林', perspective: 'assassin',
        targetName: '苍 1', canSubmit: false, isSubmitting: true,
      },
      stageOverlay: { kind: 'none' },
      utilities: {
        variant: 'game', showRoomExit: false, showIdentityKnowledge: false,
        roleKnowledgeOpen: false,
      },
    }

    const model = withAssassinationOutcome(
      baseModel,
      { targetID: '0', targetRole: 'merlin', hit: true, winner: 'evil' },
      '苍 1',
    )

    expect(model.players[0]).toMatchObject({
      emphasis: 'target',
      portrait: { kind: 'roleArtwork', role: 'merlin' },
      caption: { kind: 'none' },
    })
  })

  it('renders all three assassination perspectives through the production RoomScreen', () => {
    for (const scenarioID of ['assassin', 'evil', 'good']) {
      const html = renderPreview(`/dev/room-layout/assassination/${scenarioID}`)

      expect(html).toContain('data-room-screen="true"')
      expect(html).toContain('打开开发预览控制')
    }
  })

  it('gives only the Assassin a private target action', () => {
    const assassin = renderPreview('/dev/room-layout/assassination/assassin')
    const evil = renderPreview('/dev/room-layout/assassination/evil')
    const good = renderPreview('/dev/room-layout/assassination/good')

    expect(assassin).toContain('选择你认为是梅林的玩家')
    expect(assassin).toContain('确认刺杀')
    expect(evil).toContain('协助刺客找出梅林')
    expect(evil).not.toContain('确认刺杀')
    expect(good).toContain('等待刺客选择目标')
    expect(good).not.toContain('确认刺杀')
  })

  it('does not render an intermediate assassination index', () => {
    expect(renderPreview('/dev/room-layout/assassination')).not.toContain('data-room-screen="true"')
  })
})
