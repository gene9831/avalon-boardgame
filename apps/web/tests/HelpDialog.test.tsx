import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { HelpDialog } from '../src/HelpDialog'

describe('HelpDialog', () => {
  it('renders semantic tabs and prioritizes contextual roles', () => {
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
    expect(html).toContain('帕西维尔看到梅林与莫甘娜，但无法分辨两人')
  })

  it('renders responsive artwork for every base role', () => {
    const html = renderToStaticMarkup(
      <HelpDialog
        activeTab="roles"
        focusRoles={false}
        onActiveTabChange={vi.fn()}
        onRequestClose={vi.fn()}
        open
        requestID={1}
      />,
    )

    expect(html.match(/data-help-role-artwork=/g) ?? []).toHaveLength(6)
    expect(html).toContain('data-help-role-artwork="merlin"')
    expect(html).toContain('/images/roles/merlin-320.webp 320w')
    expect(html).toContain('/images/roles/merlin-480.webp 480w')
    expect(html).toContain('/images/roles/merlin-674.webp 674w')
    expect(html).toContain('/images/roles/loyal-servant-320.webp 320w')
    expect(html).toContain('/images/roles/loyal-servant-480.webp 480w')
    expect(html).toContain('/images/roles/loyal-servant-674.webp 674w')
    expect(html).toContain('/images/roles/minion-320.webp 320w')
    expect(html).toContain('/images/roles/minion-480.webp 480w')
    expect(html).toContain('/images/roles/minion-674.webp 674w')
    expect(html).toContain('sizes="(min-width: 1024px) 18rem, (min-width: 640px) 42vw, 5.5rem"')
    expect(html).toMatch(/<img(?=[^>]*data-help-role-artwork="merlin")(?=[^>]*width="674")(?=[^>]*height="1010")[^>]*>/)
    expect(html).toMatch(/<img(?=[^>]*data-help-role-artwork="assassin")(?=[^>]*width="674")(?=[^>]*height="1051")[^>]*>/)
    expect(html).toMatch(/<img(?=[^>]*data-help-role-artwork="loyal_servant")(?=[^>]*width="674")(?=[^>]*height="1010")[^>]*>/)
    expect(html).toMatch(/<img(?=[^>]*data-help-role-artwork="minion")(?=[^>]*width="674")(?=[^>]*height="1010")[^>]*>/)
    expect(html).not.toContain('data-role-artwork-placeholder=')
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
