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
import { RoomQuestPreview } from '../src/RoomQuestPreview'
import { RoomQuestScene } from '../src/RoomQuestScene'
import type { RoomQuestScene as Scene } from '../src/room-screen-props'
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
    <HelpProvider><ToastProvider><MemoryRouter initialEntries={['/dev/room-layout/quest/member-good']}><Routes>
      <Route element={<RoomQuestPreview />} path="/dev/room-layout/quest/:scenarioID" />
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

function makeScene(view: Scene['view'], failThreshold = 1): Scene {
  return {
    kind: 'quest', matchID: 'quest-room', playerCount: 7, players: [], questProgress: [],
    questIndex: 3, requiredSubmissionCount: 4, submittedCount: 2, failThreshold, view,
  }
}

function render(view: Scene['view'], failThreshold = 1) {
  return renderToStaticMarkup(
    <RoomQuestScene
      actions={{ onSelectCard: vi.fn(), onConfirmCard: vi.fn(), onContinue: vi.fn() }}
      geometry={{ stageLayout }}
      scene={makeScene(view, failThreshold)}
      slots={{ back: null, toolbar: null }}
    />,
  )
}

function renderPreview(scenarioID: 'member-good' | 'member-evil' | 'observer') {
  return renderToStaticMarkup(
    <HelpProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/dev/room-layout/quest/${scenarioID}`]}>
          <Routes>
            <Route element={<RoomQuestPreview />} path="/dev/room-layout/quest/:scenarioID" />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </HelpProvider>,
  )
}

describe('RoomQuestScene', () => {
  it.each(['member-good', 'member-evil', 'observer'] as const)('renders the %s preview through the shared formal scene shell', (scenarioID) => {
    const html = renderPreview(scenarioID)

    expect(html).toContain('data-room-preview-shell="true"')
    expect(html).toContain('data-room-scene="quest"')
    expect(html).toContain('aria-label="打开开发预览控制"')
  })

  it('gives a Good member explanatory copy and one direct Success submission action', () => {
    const html = render({ kind: 'choosing', alignment: 'good', selectedCard: 'success', canChoose: true, submitRequestState: 'idle' })

    expect(html).not.toContain('data-quest-card="success"')
    expect(html).not.toContain('data-quest-card="fail"')
    expect(html).toContain('正义阵营只能提交成功牌')
    expect(html).toContain('>提交成功牌</button>')
  })

  it('requires an Evil member to select between the authorized Success and Fail choices', () => {
    const unselected = render({ kind: 'choosing', alignment: 'evil', selectedCard: null, canChoose: true, submitRequestState: 'idle' })
    const selected = render({ kind: 'choosing', alignment: 'evil', selectedCard: 'fail', canChoose: true, submitRequestState: 'idle' })

    expect(unselected).toContain('data-quest-card="success"')
    expect(unselected).toContain('data-quest-card="fail"')
    expect(unselected).toMatch(/>确认任务牌<\/button>/)
    expect(unselected).toContain('disabled=""')
    expect(selected).toContain('data-quest-card="fail" aria-pressed="true"')
  })

  it('locks the original action and every available card while pending', () => {
    const html = render({ kind: 'choosing', alignment: 'evil', selectedCard: 'fail', canChoose: true, submitRequestState: 'pending' })

    expect(html.match(/disabled=""/g)).toHaveLength(3)
    expect(html).toContain('>确认任务牌</button>')
    expect(html).not.toContain('正在确认')
  })

  it('keeps only a member private submitted card in waiting copy and exposes no action', () => {
    const member = render({ kind: 'waiting', participation: 'member', submittedCard: 'fail' })
    const observer = render({ kind: 'waiting', participation: 'observer', submittedCard: null })

    expect(member).toMatch(/你已提交.*失败牌/s)
    expect(member).toContain('等待其他任务队员')
    expect(observer).toContain('任务队员正在秘密提交任务牌')
    expect(member).not.toContain('确认任务牌')
    expect(observer).not.toContain('确认成功牌')
  })

  it('keeps the settled public quest outcome informational', () => {
    const success = render({ kind: 'result', succeeded: true, successCount: 3, failCount: 1, failThreshold: 2, continueIntent: 'assassination' }, 2)
    const failure = render({ kind: 'result', succeeded: false, successCount: 2, failCount: 2, failThreshold: 2, continueIntent: 'gameResult' }, 2)

    expect(success).toContain('任务成功')
    expect(success).toContain('3 成功 / 1 失败')
    expect(success).toContain('需要 2 张失败牌')
    expect(success).toContain('>进入刺杀阶段</button>')
    expect(failure).toContain('任务失败')
    expect(failure).toContain('2 成功 / 2 失败')
    expect(failure).toContain('>查看对局结果</button>')
    expect(success).not.toContain('确认任务牌')
  })

  it('shows the public two-fail threshold while choosing or waiting', () => {
    const choosing = render({ kind: 'choosing', alignment: 'evil', selectedCard: null, canChoose: true, submitRequestState: 'idle' }, 2)
    const waiting = render({ kind: 'waiting', participation: 'observer', submittedCard: null }, 2)

    expect(choosing).toContain('需要 2 张失败牌')
    expect(waiting).toContain('需要 2 张失败牌')
  })

  it('rebuilds assassination and terminal successors without the settled quest process state', async () => {
    const assassination = await mountPreview()
    const intentSelect = assassination.container.querySelectorAll('select')[3] as HTMLSelectElement
    await act(async () => {
      intentSelect.value = 'assassination'
      intentSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => buttonByText(assassination.container, '模拟任务成功').click())
    await act(async () => buttonByText(assassination.container, '进入刺杀阶段').click())
    expect(assassination.container.querySelector('[data-room-scene="assassination"]')).not.toBeNull()
    expect(assassination.container.querySelector('[data-seat-decoration="quest-member"]')).toBeNull()
    await act(async () => assassination.root.unmount())
    assassination.container.remove()

    const terminal = await mountPreview()
    const terminalIntent = terminal.container.querySelectorAll('select')[3] as HTMLSelectElement
    await act(async () => {
      terminalIntent.value = 'gameResult'
      terminalIntent.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => buttonByText(terminal.container, '模拟任务成功').click())
    await act(async () => buttonByText(terminal.container, '查看对局结果').click())
    expect(terminal.container.querySelector('[data-room-scene="gameResult"]')).not.toBeNull()
    expect(terminal.container.querySelectorAll('[data-role-loyalty]')).toHaveLength(5)
    expect(terminal.container.querySelector('[data-seat-decoration]')).toBeNull()
    await act(async () => terminal.root.unmount())
    terminal.container.remove()
  })
})
