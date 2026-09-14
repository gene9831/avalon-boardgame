// @vitest-environment happy-dom
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomTeamTokens, type RoomTeamToken } from '../src/RoomTeamTokens'

const tokens: readonly RoomTeamToken[] = [
  { playerID: '0', seatNumber: 1, name: 'Alice', avatarID: 'merlin' },
  { playerID: '2', seatNumber: 3, name: 'Caro', avatarID: 'assassin' },
]

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('RoomTeamTokens', () => {
  it('shows only avatars and numeric badges while exposing the full identity to assistive technology', () => {
    const html = renderToStaticMarkup(
      <RoomTeamTokens requiredTeamSize={2} state="confirmed" tokens={tokens} onActivatePlayer={vi.fn()} />,
    )

    expect(html).toContain('data-player-avatar="merlin"')
    expect(html).toContain('data-team-token-seat-number="true"')
    expect(html).toContain('aria-label="1 号座位：Alice"')
    expect(html).toContain('title="1 号座位：Alice"')
    expect(html).not.toMatch(/>Alice</)
  })

  it.each([
    [2, 'single-row'],
    [3, 'single-row'],
    [4, 'three-two'],
    [5, 'three-two'],
  ] as const)('uses the stable %s layout for %s selected members', (count, layout) => {
    const selected = Array.from({ length: count }, (_, index) => ({
      playerID: String(index), seatNumber: index + 1, name: `Player ${index + 1}`, avatarID: 'merlin' as const,
    }))
    const html = renderToStaticMarkup(
      <RoomTeamTokens requiredTeamSize={count} state="confirmed" tokens={selected} />,
    )

    expect(html).toContain(`data-team-token-layout="${layout}"`)
  })

  it('adds noninteractive plus placeholders only while previewing an incomplete team', () => {
    const preview = renderToStaticMarkup(
      <RoomTeamTokens requiredTeamSize={4} state="preview" tokens={tokens} />,
    )
    const confirmed = renderToStaticMarkup(
      <RoomTeamTokens requiredTeamSize={4} state="confirmed" tokens={tokens} />,
    )

    expect(preview.match(/data-team-token-placeholder="true"/g)).toHaveLength(2)
    expect(preview).not.toContain('data-team-token-placeholder="true" role="button"')
    expect(confirmed).not.toContain('data-team-token-placeholder="true"')
  })

  it('does not activate a disabled filled token', async () => {
    const onActivatePlayer = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(
      <RoomTeamTokens disabled requiredTeamSize={2} state="confirmed" tokens={tokens} onActivatePlayer={onActivatePlayer} />,
    ))

    const button = container.querySelector('button')!
    expect(button.disabled).toBe(true)
    await act(async () => button.click())
    expect(onActivatePlayer).not.toHaveBeenCalled()
  })
})
