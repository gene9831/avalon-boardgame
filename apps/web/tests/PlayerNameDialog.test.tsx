import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { PlayerNameDialog } from '../src/PlayerNameDialog'

function renderDialog(
  action: 'create' | 'join',
  overrides: Partial<Parameters<typeof PlayerNameDialog>[0]> = {},
) {
  return renderToStaticMarkup(
    <PlayerNameDialog
      action={action}
      busy={false}
      error={null}
      onCancel={vi.fn()}
      onChange={vi.fn()}
      onSubmit={vi.fn()}
      open
      value="Guinevere"
      {...overrides}
    />,
  )
}

describe('PlayerNameDialog', () => {
  it('uses create-specific copy and the saved name as its editable default', () => {
    const html = renderDialog('create')

    expect(html).toContain('创建房间前确认名称')
    expect(html).toContain('value="Guinevere"')
    expect(html).toContain('>确认创建</button>')
  })

  it('uses join-specific copy', () => {
    const html = renderDialog('join')

    expect(html).toContain('加入房间前确认名称')
    expect(html).toContain('>确认加入</button>')
  })

  it('disables every editable action while the request is in flight', () => {
    const html = renderDialog('join', { busy: true })

    expect(html).toMatch(/<input[^>]*disabled=""/)
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2)
    expect(html).toContain('>加入中…</button>')
  })
})
