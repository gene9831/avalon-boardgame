import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PlayerAvatar } from '../src/player-avatars'
import { getSeatAvatarID } from '../src/seat-avatar'

describe('player avatars', () => {
  it('uses a valid public avatar ID and a deterministic fallback for legacy seats', () => {
    expect(getSeatAvatarID({ avatarID: 'morgana' }, 2)).toBe('morgana')
    expect(getSeatAvatarID({ avatarID: 'unknown' }, 2)).toBe('merlin')
    expect(getSeatAvatarID(undefined, 9)).toBe('loyal-servant')
  })

  it('renders the selected cosmetic avatar without a role label', () => {
    const html = renderToStaticMarkup(
      <PlayerAvatar avatarID="oberon" className="avatar" />,
    )

    expect(html).toContain('data-player-avatar="oberon"')
    expect(html).toContain('alt=""')
    expect(html).not.toContain('奥伯伦')
  })
})
