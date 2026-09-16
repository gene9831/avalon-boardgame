// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlayerProfileDialog, PlayerProfilePanel } from '../src/PlayerProfileControl'
import type { PlayerProfile } from '../src/player-profile'

let root: Root | null = null
let container: HTMLDivElement | null = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

async function renderDialog(
  onSave: (profile: PlayerProfile) => Promise<void>,
  options: { saveDisabledReason?: string; onClose?: () => void } = {},
) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const onClose = options.onClose ?? vi.fn()
  await act(async () => root?.render(
    <PlayerProfileDialog
      onClose={onClose}
      onSave={onSave}
      open
      panelPlacement="bottom-sheet"
      profile={{ avatarID: 'merlin', name: 'Alice' }}
      saveDisabledReason={options.saveDisabledReason}
      triggerRef={{ current: null }}
    />,
  ))
  return { onClose }
}

describe('PlayerProfilePanel', () => {
  it('offers name and avatar editing outside a room with source attribution', () => {
    const html = renderToStaticMarkup(
      <PlayerProfilePanel
        draft={{ avatarID: 'merlin', name: '银月骑士' }}
        error={null}
        locked={false}
        onAvatarChange={vi.fn()}
        onClose={vi.fn()}
        onNameChange={vi.fn()}
        onRandomize={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(html).toContain('value="银月骑士"')
    expect(html.match(/data-avatar-option=/g)).toHaveLength(8)
    expect(html).toContain('重新随机')
    expect(html).toContain('保存资料')
    expect(html).toMatch(
      /<input[^>]*class="[^"]*text-base[^"]*sm:text-sm[^"]*"[^>]*name="player-profile-name"/,
    )
    expect(html).toContain('ImperialOctopus/avalon-printable')
    expect(html).toContain('<details')
    expect(html).toContain('>素材与许可<')
    expect(html).toContain('CC BY 4.0')
  })

  it('shows the room lock instead of edit controls after the player joins', () => {
    const html = renderToStaticMarkup(
      <PlayerProfilePanel
        draft={{ avatarID: 'merlin', name: '银月骑士' }}
        error={null}
        locked
        onAvatarChange={vi.fn()}
        onClose={vi.fn()}
        onNameChange={vi.fn()}
        onRandomize={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(html).toContain('退出房间后可修改名称和头像')
    expect(html).not.toContain('name="player-profile-name"')
    expect(html).not.toContain('保存资料')
  })

  it('locks the dialog during an async save and closes only after success', async () => {
    const pending = deferred<void>()
    const onSave = vi.fn(async () => pending.promise)
    const { onClose } = await renderDialog(onSave)
    const save = container?.querySelector<HTMLButtonElement>('button[data-profile-save="true"]')
    const close = container?.querySelector<HTMLButtonElement>('button[aria-label="关闭用户中心"]')

    await act(async () => { save?.click() })

    expect(onSave).toHaveBeenCalledOnce()
    expect(save?.disabled).toBe(true)
    expect(save?.textContent).toContain('保存中')
    expect(close?.disabled).toBe(true)
    await act(async () => { save?.click() })
    expect(onSave).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => pending.resolve())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the draft and shows an inline error after a retryable failure', async () => {
    const onSave = vi.fn(async () => { throw new Error('network unavailable') })
    await renderDialog(onSave)
    const input = container?.querySelector<HTMLInputElement>('input[name="player-profile-name"]')
    if (input === null || input === undefined) throw new Error('expected profile input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Morgan')
    await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })))

    const save = container?.querySelector<HTMLButtonElement>('button[data-profile-save="true"]')
    await act(async () => { save?.click() })

    expect(input.value).toBe('Morgan')
    expect(container?.querySelector('[role="alert"]')?.textContent)
      .toContain('保存资料失败，请重试')
  })

  it('keeps a disconnected draft editable but disables saving with a reason', async () => {
    await renderDialog(vi.fn(), { saveDisabledReason: '重新连接后才能修改资料。' })

    expect(container?.querySelector<HTMLInputElement>('input[name="player-profile-name"]')?.disabled)
      .toBe(false)
    expect(container?.querySelector<HTMLButtonElement>('button[data-profile-save="true"]')?.disabled)
      .toBe(true)
    expect(container?.textContent).toContain('重新连接后才能修改资料。')
  })
})
