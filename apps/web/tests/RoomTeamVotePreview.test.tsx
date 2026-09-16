// @vitest-environment happy-dom
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const mockedRoomLayout = vi.hoisted(() => ({
    canvasRef: () => undefined,
    stageRef: () => undefined,
    snapshot: {
      viewportSize: { width: 390, height: 844 }, canvasSize: { width: 390, height: 844 }, stageSize: { width: 390, height: 500 },
      diagnostics: null,
      stageLayout: {
        status: 'ready', shape: 'circle', tabletop: { x: 20, y: 20, width: 300, height: 300 },
        centerPanel: { x: 94, y: 94, width: 152, height: 152 },
        playerSeats: Array.from({ length: 5 }, (_, relativeSeatIndex) => ({
          relativeSeatIndex, playerSeatBounds: { x: 10 + relativeSeatIndex * 4, y: 340, width: 92, height: 88 },
          playerBoundaryCircle: { center: { x: 56 + relativeSeatIndex * 4, y: 374 }, radius: 46 },
          avatarRect: { x: 32 + relativeSeatIndex * 4, y: 350, width: 48, height: 48 },
          nameRect: { x: 10 + relativeSeatIndex * 4, y: 404, width: 92, height: 22 }, avatarTopClearance: 10,
        })),
      },
    },
}))

vi.mock('../src/useRoomLayout', () => ({
  useRoomLayout: () => mockedRoomLayout,
}))

import { HelpProvider } from '../src/HelpProvider'
import { RoomTeamVotePreview } from '../src/RoomTeamVotePreview'
import { RoomTeamVoteScene } from '../src/RoomTeamVoteScene'
import type { RoomTeamVoteScene as Scene } from '../src/room-screen-props'
import { ToastProvider } from '../src/toast'

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text)
  if (button === undefined) throw new Error(`Missing button: ${text}`)
  return button
}

async function mountPreview(): Promise<Readonly<{ container: HTMLDivElement; root: Root }>> {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(
    <HelpProvider><ToastProvider><MemoryRouter initialEntries={['/dev/room-layout/team-vote/voter']}><Routes>
      <Route element={<RoomTeamVotePreview />} path="/dev/room-layout/team-vote/:scenarioID" />
    </Routes></MemoryRouter></ToastProvider></HelpProvider>,
  ))
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="打开开发预览控制"]')?.click())
  return { container, root }
}

const stageLayout = {
  status: 'ready' as const,
  shape: 'circle' as const,
  tabletop: { x: 20, y: 40, width: 319, height: 319 },
  centerPanel: { x: 103.5, y: 123.5, width: 152, height: 152 },
  playerSeats: [],
}

function makeScene(view: Scene['view']): Scene {
  return {
    kind: 'teamVote', matchID: 'vote-room', playerCount: 5, players: [], questProgress: [],
    questIndex: 2, submittedCount: 2, participantCount: 5, consecutiveRejectedTeams: 1,
    teamTokens: [{ playerID: '1', seatNumber: 2, name: 'Bob', avatarID: 'merlin' }], view,
  }
}

function render(view: Scene['view'], consecutiveRejectedTeams = 1) {
  return renderToStaticMarkup(
    <RoomTeamVoteScene
      actions={{ onSelectVote: vi.fn(), onConfirmVote: vi.fn(), onContinue: vi.fn() }}
      geometry={{ stageLayout }}
      scene={{ ...makeScene(view), consecutiveRejectedTeams }}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

function renderPreview() {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/dev/room-layout/team-vote/voter']}>
          <Routes>
            <Route element={<RoomTeamVotePreview />} path="/dev/room-layout/team-vote/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomTeamVoteScene', () => {
  it('renders the voter preview through the shared formal scene shell', () => {
    const html = renderPreview()

    expect(html).toContain('data-room-preview-shell="true"')
    expect(html).toContain('data-room-scene="teamVote"')
    expect(html).toContain('aria-label="打开开发预览控制"')
  })

  it('requires one private vote choice before enabling confirmation', () => {
    const unselected = render({ kind: 'choosing', selectedVote: null, canChoose: true, submitRequestState: 'idle' })
    const selected = render({ kind: 'choosing', selectedVote: 'approve', canChoose: true, submitRequestState: 'idle' })

    expect(unselected).toContain('已投票 2 / 5')
    expect(unselected).toContain('表决任务队伍 · 过半通过')
    expect(unselected).toContain('data-team-token="filled"')
    expect(unselected).toContain('aria-label="2 号座位：Bob"')
    expect(unselected).toContain('aria-label="同意任务队伍"')
    expect(unselected).toContain('aria-label="反对任务队伍"')
    expect(unselected).toMatch(/aria-label="确认投票"[^>]*disabled=""/)
    expect(selected).toContain('aria-label="同意任务队伍" aria-pressed="true"')
    expect(selected).not.toMatch(/aria-label="确认投票"[^>]*disabled=""/)
  })

  it('places in-progress vote participation before the task member list', () => {
    const html = render({ kind: 'choosing', selectedVote: null, canChoose: true, submitRequestState: 'idle' })

    expect(html.indexOf('已投票 2 / 5')).toBeLessThan(html.indexOf('data-team-token-layout="vertical"'))
  })

  it('uses the shared secondary-text size for the rejection counter in the center summary', () => {
    const html = render({ kind: 'choosing', selectedVote: null, canChoose: true, submitRequestState: 'idle' })

    expect(html).toContain('class="mt-1 block text-sm text-slate-400">连续否决 1 / 5</span>')
  })

  it('keeps the original label and disables both choices while pending', () => {
    const html = render({ kind: 'choosing', selectedVote: 'reject', canChoose: true, submitRequestState: 'pending' })

    expect(html.match(/disabled=""/g)).toHaveLength(3)
    expect(html).toContain('>确认投票</button>')
    expect(html).not.toContain('正在确认')
  })

  it('moves a submitted private vote to waiting and removes every action', () => {
    const html = render({ kind: 'waiting', submittedVote: 'reject' })

    expect(html).toMatch(/你已提交.*反对票/s)
    expect(html).toContain('等待其他玩家投票')
    expect(html).not.toContain('确认投票')
    expect(html).not.toContain('aria-label="同意任务队伍"')
    expect(html).toContain('data-team-token="filled"')
  })

  it('uses the final-vote title and text/icon rejection warning at four rejections', () => {
    const html = renderToStaticMarkup(
      <RoomTeamVoteScene
        actions={{ onSelectVote: vi.fn(), onConfirmVote: vi.fn(), onContinue: vi.fn() }}
        geometry={{ stageLayout }}
        scene={{ ...makeScene({ kind: 'choosing', selectedVote: null, canChoose: true, submitRequestState: 'idle' }), consecutiveRejectedTeams: 4 }}
        slots={{ back: null, toolbar: null }}
      />,
    )

    expect(html).toContain('最终表决 · 否决即邪恶获胜')
    expect(html).toContain('连续否决 4 / 5')
    expect(html).toContain('data-critical-rejection-warning="true"')
  })

  it('renders a settled vote with its explicit title, totals, tokens, and continuation intent', () => {
    const ordinary = render({
      kind: 'result', approved: true, approvalCount: 3, rejectionCount: 2, continueIntent: 'continue',
    }, 4)
    const terminal = render({
      kind: 'result', approved: false, approvalCount: 2, rejectionCount: 3, continueIntent: 'gameResult',
    }, 0)

    expect(ordinary).toContain('队伍表决结果')
    expect(ordinary).toContain('队伍通过')
    expect(ordinary).toContain('3 同意 / 2 反对')
    expect(ordinary).toContain('data-team-token="filled"')
    expect(ordinary).toContain('>继续</button>')
    expect(ordinary).not.toContain('最终表决 · 否决即邪恶获胜')
    expect(terminal).toContain('队伍被否决')
    expect(terminal).toContain('>查看对局结果</button>')
  })

  it('rebuilds the approved quest successor without pending vote markers', async () => {
    const { container, root } = await mountPreview()
    await act(async () => buttonByText(container, '模拟队伍通过').click())
    await act(async () => buttonByText(container, '继续').click())

    expect(container.querySelector('[data-room-scene="quest"]')).not.toBeNull()
    expect(container.querySelector('[data-seat-decoration="vote"]')).toBeNull()
    await act(async () => root.unmount())
    container.remove()
  })

  it('rebuilds rejected and terminal successors without stale process markers', async () => {
    const ordinary = await mountPreview()
    await act(async () => buttonByText(ordinary.container, '模拟队伍被否决').click())
    await act(async () => buttonByText(ordinary.container, '继续').click())
    expect(ordinary.container.querySelector('[data-room-scene="teamProposal"]')).not.toBeNull()
    expect(ordinary.container.querySelector('[data-seat-decoration="vote"]')).toBeNull()
    expect(ordinary.container.querySelector('[data-seat-decoration="quest-member"]')).toBeNull()
    await act(async () => ordinary.root.unmount())
    ordinary.container.remove()

    const terminal = await mountPreview()
    const rejectionSelect = terminal.container.querySelectorAll('select')[2] as HTMLSelectElement
    await act(async () => {
      rejectionSelect.value = '4'
      rejectionSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => buttonByText(terminal.container, '模拟队伍被否决').click())
    await act(async () => buttonByText(terminal.container, '查看对局结果').click())
    expect(terminal.container.querySelector('[data-room-scene="gameResult"]')).not.toBeNull()
    expect(terminal.container.querySelectorAll('[data-role-loyalty]')).toHaveLength(5)
    expect(terminal.container.querySelector('[data-seat-decoration]')).toBeNull()
    await act(async () => terminal.root.unmount())
    terminal.container.remove()
  })
})
