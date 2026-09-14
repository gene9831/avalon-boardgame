// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/useElementSize', () => ({
  useElementSize: () => ({ ref: () => {}, size: { height: 0, width: 0 } }),
}))

import { RoomLayoutBasePreview } from '../src/RoomLayoutPreview'
import { RoomMoreMenu, RoomMoreMenuPanel } from '../src/RoomMoreMenu'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderMenu(showRoomExit = true) {
  await act(async () => {
    root.render(
      <RoomMoreMenu
        connected
        entries={[]}
        isOwner={false}
        onRequestRoomExit={vi.fn()}
        roomExitBlocked={false}
        roomExitBusy={false}
        seatChangePending={false}
        showRoomExit={showRoomExit}
      />,
    )
  })

  const trigger = container.querySelector<HTMLButtonElement>('[data-room-toolbar-item="room"]')
  if (trigger === null) throw new Error('Expected More trigger')
  return trigger
}

async function click(element: HTMLElement) {
  await act(async () => element.click())
}

async function keydown(target: EventTarget, key: string) {
  await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })))
}

describe('RoomMoreMenuPanel', () => {
  it('keeps the public log before the owner room action', () => {
    const html = renderToStaticMarkup(
      <RoomMoreMenuPanel
        isOwner
        onOpenLog={vi.fn()}
        onRequestRoomExit={vi.fn()}
        roomActionDisabled={false}
        roomExitBusy={false}
      />,
    )

    expect(html.indexOf('对局记录')).toBeLessThan(html.indexOf('border-t'))
    expect(html.indexOf('border-t')).toBeLessThan(html.indexOf('解散房间'))
    expect(html).toContain('role="menu"')
  })

  it('shows a disabled member exit action while recovery blocks room changes', () => {
    const html = renderToStaticMarkup(
      <RoomMoreMenuPanel
        isOwner={false}
        onOpenLog={vi.fn()}
        onRequestRoomExit={vi.fn()}
        roomActionDisabled
        roomExitBusy={false}
      />,
    )

    expect(html).toContain('退出房间')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>退出房间<\/button>/)
  })

  it('keeps the log as the only menu action when room exit is unavailable', () => {
    const html = renderToStaticMarkup(
      <RoomMoreMenuPanel
        isOwner={false}
        onOpenLog={vi.fn()}
        onRequestRoomExit={vi.fn()}
        roomActionDisabled={false}
        roomExitBusy={false}
        showRoomExit={false}
      />,
    )

    expect(html).toContain('对局记录')
    expect(html).not.toContain('border-t')
    expect(html).not.toContain('退出房间')
    expect(html).not.toContain('解散房间')
  })
})

describe('RoomMoreMenu keyboard interactions', () => {
  it('moves focus through its menuitems and restores the More trigger on Escape', async () => {
    const trigger = await renderMenu()

    await click(trigger)
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    expect(items.map((item) => item.textContent)).toEqual(['对局记录', '退出房间'])
    expect(document.activeElement).toBe(items[0])

    await keydown(items[0], 'ArrowDown')
    expect(document.activeElement).toBe(items[1])
    await keydown(items[1], 'ArrowDown')
    expect(document.activeElement).toBe(items[0])
    await keydown(items[0], 'End')
    expect(document.activeElement).toBe(items[1])
    await keydown(items[1], 'Home')
    expect(document.activeElement).toBe(items[0])
    await keydown(items[0], 'ArrowUp')
    expect(document.activeElement).toBe(items[1])

    await keydown(items[1], 'Escape')
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps the sole log item focusable and restores More after closing its dialog', async () => {
    const trigger = await renderMenu(false)

    await click(trigger)
    const logItem = container.querySelector<HTMLButtonElement>('[role="menuitem"]')
    expect(logItem?.textContent).toBe('对局记录')
    expect(document.activeElement).toBe(logItem)

    await keydown(logItem!, 'ArrowDown')
    expect(document.activeElement).toBe(logItem)
    await click(logItem!)
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    const close = container.querySelector<HTMLButtonElement>('button[aria-label="关闭对局记录"]')
    if (close === null) throw new Error('Expected log close button')
    await click(close)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})

describe('RoomLayoutBasePreview toolbar', () => {
  it('opens the real More menu for the log instead of rendering a direct log control', async () => {
    await act(async () => {
      root.render(<MemoryRouter><RoomLayoutBasePreview /></MemoryRouter>)
    })

    expect(container.querySelector('[aria-label="查看对局记录"]')).toBeNull()
    const trigger = container.querySelector<HTMLButtonElement>('[data-room-toolbar-item="room"]')
    expect(trigger).not.toBeNull()
    await click(trigger!)

    expect(container.querySelector('[role="menu"]')?.textContent).toContain('对局记录')
  })
})
