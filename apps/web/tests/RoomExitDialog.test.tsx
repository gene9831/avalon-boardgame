import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { RoomExitDialog, type RoomExitDialogProps } from '../src/RoomExitDialog'

function renderDialog(overrides: Partial<RoomExitDialogProps> = {}) {
  const props: RoomExitDialogProps = {
    busy: false,
    isHost: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    open: true,
    ...overrides,
  }

  return renderToStaticMarkup(<RoomExitDialog {...props} />)
}

describe('RoomExitDialog', () => {
  it('warns a guest that exiting releases the seat', () => {
    const html = renderDialog()

    expect(html).toContain('确认退出房间')
    expect(html).toContain('退出后将释放座位，重新进入需要再次选择座位。')
    expect(html).toContain('>退出房间<')
  })

  it('warns the host that dissolution removes the room for everyone', () => {
    const html = renderDialog({ isHost: true })

    expect(html).toContain('确认解散房间')
    expect(html).toContain('解散后，所有玩家都会返回主页，且本房间无法恢复。')
    expect(html).toContain('>解散房间<')
  })

  it('locks dismissal during submission', () => {
    const busyHtml = renderDialog({ busy: true })

    expect(busyHtml).toMatch(/<button[^>]*disabled=""[^>]*>取消<\/button>/)
    expect(busyHtml).toMatch(/<button[^>]*disabled=""[^>]*>正在退出…<\/button>/)
  })
})
