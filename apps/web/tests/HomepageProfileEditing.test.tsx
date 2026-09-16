// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../src/App'
import { loadOrCreatePlayerProfile, savePlayerProfile } from '../src/player-profile'
import { loadRoomSession, saveRoomSession } from '../src/room-session'

vi.mock('../src/config', () => ({
  webConfig: {
    gameURL: 'http://localhost:8000',
    lobbyURL: 'http://localhost:8001',
    routerBasename: '/',
    socketPath: '/socket.io',
  },
}))

const waitingRoom = {
  authorityVersion: 1 as const,
  createdAt: 1,
  matchID: 'room-waiting',
  occupiedPlayerIDs: ['0'],
  ownerPlayerID: '0',
  players: [
    { id: 0, isConnected: true, name: 'Alice' },
    { id: 1, isConnected: false },
    { id: 2, isConnected: false },
    { id: 3, isConnected: false },
    { id: 4, isConnected: false },
  ],
  roleConfiguration: { percivalMorgana: true },
  status: 'lobby' as const,
  updatedAt: 1,
}

const storageValues = new Map<string, string>()
const storage: Storage = {
  clear: () => storageValues.clear(),
  getItem: (key) => storageValues.get(key) ?? null,
  key: (index) => Array.from(storageValues.keys())[index] ?? null,
  get length() { return storageValues.size },
  removeItem: (key) => storageValues.delete(key),
  setItem: (key, value) => storageValues.set(key, value),
}
Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })

let root: Root | null = null
let container: HTMLDivElement | null = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  storage.clear()
  vi.unstubAllGlobals()
})

describe('homepage waiting-room profile editing', () => {
  it('updates the waiting-room name and avatar from the homepage user entry', async () => {
    window.history.replaceState({}, '', '/')
    savePlayerProfile({ avatarID: 'merlin', name: 'Alice' })
    saveRoomSession({
      avatarID: 'merlin',
      credentials: 'credential',
      matchID: waitingRoom.matchID,
      playerID: '0',
      playerName: 'Alice',
      profileRevision: 1,
    })

    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/dev/status')) {
        return new Response(JSON.stringify({ enabled: false }), { status: 200 })
      }
      if (url.endsWith('/rooms/avalon')) {
        return new Response(JSON.stringify({ rooms: [waitingRoom] }), { status: 200 })
      }
      if (url.endsWith('/players/0/session')) {
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/players/0/profile')) {
        const request = JSON.parse(String(init?.body)) as {
          data: { avatarID: string }
          playerName: string
        }
        return new Response(JSON.stringify({ ...request, revision: 2 }), { status: 200 })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetcher)

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(<App />))
    await vi.waitFor(() => {
      expect(container?.textContent).toContain('继续游戏')
    })

    const createRoom = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === '创建房间')
    expect(createRoom?.disabled).toBe(true)

    const profileTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="打开用户中心"]',
    )
    await act(async () => profileTrigger?.click())

    const input = container.querySelector<HTMLInputElement>(
      'input[name="player-profile-name"]',
    )
    expect(input).not.toBeNull()
    expect(container.querySelectorAll('[data-avatar-option]')).toHaveLength(8)
    if (input === null) throw new Error('expected editable homepage profile')

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      'Morgan',
    )
    await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })))
    const avatar = container.querySelector<HTMLButtonElement>(
      '[data-avatar-option="percival"]',
    )
    await act(async () => avatar?.click())
    const save = container.querySelector<HTMLButtonElement>('[data-profile-save="true"]')
    await act(async () => save?.click())

    await vi.waitFor(() => {
      expect(loadRoomSession(waitingRoom.matchID)).toMatchObject({
        avatarID: 'percival',
        playerName: 'Morgan',
        profileRevision: 2,
      })
      expect(loadOrCreatePlayerProfile()).toEqual({
        avatarID: 'percival',
        name: 'Morgan',
      })
    })
    const profileRequest = fetcher.mock.calls.find(([request]) =>
      String(request).endsWith('/players/0/profile'))
    expect(JSON.parse(String(profileRequest?.[1]?.body))).toEqual({
      data: { avatarID: 'percival' },
      playerName: 'Morgan',
    })
  })
})
