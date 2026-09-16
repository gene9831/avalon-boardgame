// @vitest-environment happy-dom
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomTeamTokens, type RoomTeamToken } from '../src/RoomTeamTokens'

const tokens: readonly RoomTeamToken[] = [
  { playerID: '0', seatNumber: 1, name: 'Alice' },
  { playerID: '2', seatNumber: 3, name: 'Caro' },
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
  it('shows each member seat number and name without repeating the player avatar', () => {
    const html = renderToStaticMarkup(
      <RoomTeamTokens requiredTeamSize={2} state="confirmed" tokens={tokens} />,
    )

    expect(html).toContain('data-team-member-seat="true">1</span>')
    expect(html.match(/data-numeric-text="true"/g)).toHaveLength(2)
    expect(html).toContain('data-team-member-name="true">Alice</span>')
    expect(html).toContain('data-team-member-seat="true">3</span>')
    expect(html).toContain('data-team-member-name="true">Caro</span>')
    expect(html).toContain('aria-label="1 号座位：Alice"')
    expect(html).toContain('title="1 号座位：Alice"')
    expect(html).not.toContain('data-player-avatar')
  })

  it('exposes every confirmed read-only member identity without making tokens interactive', () => {
    const html = renderToStaticMarkup(
      <RoomTeamTokens requiredTeamSize={2} state="confirmed" tokens={tokens} />,
    )

    expect(html).toContain('aria-label="1 号座位：Alice"')
    expect(html).toContain('aria-label="3 号座位：Caro"')
    expect(html).toContain('role="list"')
    expect(html.match(/role="listitem"/g)).toHaveLength(2)
    expect(html).not.toContain('<button')
  })

  it('keeps five members in one vertical list with separately truncatable names', () => {
    const selected: readonly RoomTeamToken[] = [
      ...tokens,
      { playerID: '3', seatNumber: 4, name: 'A very long player name that needs truncating' },
      { playerID: '4', seatNumber: 5, name: 'Dara' },
      { playerID: '5', seatNumber: 6, name: 'Evan' },
    ]
    const html = renderToStaticMarkup(
      <RoomTeamTokens requiredTeamSize={5} state="confirmed" tokens={selected} />,
    )

    expect(html).toContain('data-team-token-layout="vertical"')
    expect(html.match(/data-team-token-row="true"/g)).toHaveLength(5)
    expect(html).toContain('data-team-member-name="true">A very long player name that needs truncating</span>')
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
    expect(preview.match(/>待选择</g)).toHaveLength(2)
    expect(confirmed).not.toContain('data-team-token-placeholder="true"')
  })

  it('lets the leader remove a preview member from the readable row', async () => {
    const onActivatePlayer = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(
      <RoomTeamTokens requiredTeamSize={2} state="preview" tokens={tokens} onActivatePlayer={onActivatePlayer} />,
    ))

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="取消选择 1 号座位：Alice"]')!
    expect(button.textContent).toContain('1')
    expect(button.textContent).toContain('Alice')
    expect(button.textContent).toContain('×')
    await act(async () => button.click())
    expect(onActivatePlayer).toHaveBeenCalledWith('0')
  })

  it('does not activate a disabled filled token', async () => {
    const onActivatePlayer = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(
      <RoomTeamTokens disabled requiredTeamSize={2} state="preview" tokens={tokens} onActivatePlayer={onActivatePlayer} />,
    ))

    const button = container.querySelector('button')!
    expect(button.disabled).toBe(true)
    await act(async () => button.click())
    expect(onActivatePlayer).not.toHaveBeenCalled()
  })
})
