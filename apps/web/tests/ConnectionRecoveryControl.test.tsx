import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ConnectionRecoveryControl } from '../src/ConnectionRecoveryControl'

describe('ConnectionRecoveryControl', () => {
  it('keeps automatic and manual recovery controls compact on narrow room headers', () => {
    const recovering = renderToStaticMarkup(
      <ConnectionRecoveryControl
        connected={false}
        manualReconnectAvailable={false}
        onReconnect={vi.fn()}
      />,
    )
    const manual = renderToStaticMarkup(
      <ConnectionRecoveryControl
        connected={false}
        manualReconnectAvailable
        onReconnect={vi.fn()}
      />,
    )

    expect(recovering).toContain('min-w-11')
    expect(recovering).toContain('aria-label="正在重新连接"')
    expect(recovering).toContain('class="hidden sm:inline">正在重新连接</span>')
    expect(manual).toContain('min-w-11')
    expect(manual).toContain('aria-label="重新连接房间"')
    expect(manual).toContain('title="重新连接房间"')
    expect(manual).toContain('class="hidden sm:inline">重新连接房间</span>')
  })
})
