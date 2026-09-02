import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { HelpDialog } from '../src/HelpDialog'

describe('HelpDialog', () => {
  it('uses shared Lucide disclosure icons for the rules sections', () => {
    const html = renderToStaticMarkup(
      <HelpDialog
        activeTab="rules"
        focusRoles={false}
        onActiveTabChange={vi.fn()}
        onRequestClose={vi.fn()}
        open
        requestID={1}
      />,
    )

    expect(html.match(/lucide-chevron-down/g)).toHaveLength(2)
  })

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

    const foregroundImages = html.match(/<img(?=[^>]*data-help-role-artwork=)[^>]*>/g) ?? []
    const backdropImages = html.match(/<img(?=[^>]*data-help-role-artwork-backdrop=)[^>]*>/g) ?? []

    expect(foregroundImages).toHaveLength(6)
    expect(backdropImages).toHaveLength(6)

    const artworkByRole = [
      { height: 1010, role: 'merlin', slug: 'merlin' },
      { height: 1010, role: 'percival', slug: 'percival' },
      { height: 1010, role: 'loyal_servant', slug: 'loyal-servant' },
      { height: 1051, role: 'assassin', slug: 'assassin' },
      { height: 1010, role: 'morgana', slug: 'morgana' },
      { height: 1010, role: 'minion', slug: 'minion' },
    ] as const
    for (const { height, role, slug } of artworkByRole) {
      const foregroundImage = foregroundImages.find((image) => image.includes(`data-help-role-artwork="${role}"`))
      const backdropImage = backdropImages.find((image) => image.includes(`data-help-role-artwork-backdrop="${role}"`))

      expect(foregroundImage).toBeDefined()
      expect(backdropImage).toBeDefined()
      if (foregroundImage === undefined || backdropImage === undefined) {
        throw new Error(`Missing responsive artwork layers for ${role}`)
      }
      for (const image of [foregroundImage, backdropImage]) {
        expect(image).toContain(`/images/roles/${slug}-320.webp 320w`)
        expect(image).toContain(`/images/roles/${slug}-480.webp 480w`)
        expect(image).toContain(`/images/roles/${slug}-674.webp 674w`)
        expect(image).toContain(`sizes="(min-width: 1024px) 18rem, (min-width: 640px) 42vw, 5.5rem"`)
        expect(image).toContain('width="674"')
        expect(image).toContain(`height="${height}"`)
        expect(image).toContain('loading="lazy"')
        expect(image).toContain('decoding="async"')
      }
      expect(backdropImage).toContain('alt=""')
      expect(backdropImage).toContain('aria-hidden="true"')
    }
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
