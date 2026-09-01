import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { HelpDialog } from '../src/HelpDialog'

describe('HelpDialog', () => {
  it('renders semantic tabs and prioritizes contextual roles without using artwork', () => {
    const html = renderToStaticMarkup(
      <HelpDialog
        activeTab="roles"
        focusRoles
        onActiveTabChange={vi.fn()}
        onRequestClose={vi.fn()}
        open
        requestID={1}
      />,
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-selected="true"')
    expect(html.indexOf('data-help-role="percival"')).toBeLessThan(
      html.indexOf('data-help-role="merlin"'),
    )
    expect(html).toContain('data-role-artwork-placeholder="percival"')
    expect(html).toContain('帕西维尔看到梅林与莫甘娜，但无法分辨两人')
    expect(html).not.toContain('data-role-avatar="percival"')
    expect(html).not.toContain('<img')
  })

  it('highlights the current player-count row without exposing enabled roles', () => {
    const html = renderToStaticMarkup(
      <HelpDialog
        activeTab="rules"
        focusRoles={false}
        onActiveTabChange={vi.fn()}
        onRequestClose={vi.fn()}
        open
        playerCount={7}
        requestID={1}
      />,
    )

    expect(html).toContain('aria-current="true"')
    expect(html).toMatch(/aria-current="true"[^>]*>[\s\S]*?>7</)
    expect(html).not.toContain('本局已启用')
  })
})
