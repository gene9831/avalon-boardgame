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
    expect(recovering).toContain('class="hidden sm:inline">正在重连</span>')
    expect(manual).toContain('min-w-11')
    expect(manual).toContain('class="hidden sm:inline">重连</span>')
  })
})
