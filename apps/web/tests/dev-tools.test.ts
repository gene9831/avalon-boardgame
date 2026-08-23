import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { createDevToolsClient, DevToolsHttpError } from '../src/dev-tools'
import { LobbyDevTools } from '../src/LobbyDevTools'

describe('development tools client', () => {
  it('renders the homepage development tools as a floating debug trigger only when enabled', () => {
    const props = {
      enabled: false,
      error: null,
      onTokenChange: vi.fn(),
      token: '',
    }

    expect(renderToStaticMarkup(createElement(LobbyDevTools, props))).toBe('')
    const enabledMarkup = renderToStaticMarkup(createElement(LobbyDevTools, {
      ...props,
      enabled: true,
    }))

    expect(enabledMarkup).toContain('aria-label="打开开发控制"')
    expect(enabledMarkup).toContain('aria-expanded="false"')
    expect(enabledMarkup).not.toContain('<details')
  })

  it('sends the development Bearer token when deleting a room', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createDevToolsClient('http://localhost:8001', fetcher)

    await client.deleteRoom('room-1', 'local-dev-token')

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8001/dev/rooms/room-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      }),
    )
  })

  it('surfaces a missing mutation endpoint as an error', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))

    await expect(
      createDevToolsClient('http://localhost:8001', fetcher).deleteRoom(
        'room-1',
        'local-dev-token',
      ),
    ).rejects.toEqual(new DevToolsHttpError(404))

    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('sends a kick request for a seat with the Bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ matchID: 'room-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = createDevToolsClient('http://localhost:8001', fetcher)

    await client.kickPlayer('room-1', '0', 'local-dev-token')

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8001/dev/rooms/room-1/players/0',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer local-dev-token' },
      }),
    )
  })
})
