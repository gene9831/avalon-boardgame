import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { PlayerProfilePanel } from '../src/PlayerProfileControl'

describe('PlayerProfilePanel', () => {
  it('offers name and avatar editing outside a room with source attribution', () => {
    const html = renderToStaticMarkup(
      <PlayerProfilePanel
        draft={{ avatarID: 'merlin', name: '银月骑士' }}
        error={null}
        locked={false}
        onAvatarChange={vi.fn()}
        onClose={vi.fn()}
        onNameChange={vi.fn()}
        onRandomize={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(html).toContain('value="银月骑士"')
    expect(html.match(/data-avatar-option=/g)).toHaveLength(8)
    expect(html).toContain('重新随机')
    expect(html).toContain('保存资料')
    expect(html).toContain('ImperialOctopus/avalon-printable')
    expect(html).toContain('>素材与许可<')
    expect(html).toContain('CC BY 4.0')
  })

  it('shows the room lock instead of edit controls after the player joins', () => {
    const html = renderToStaticMarkup(
      <PlayerProfilePanel
        draft={{ avatarID: 'merlin', name: '银月骑士' }}
        error={null}
        locked
        onAvatarChange={vi.fn()}
        onClose={vi.fn()}
        onNameChange={vi.fn()}
        onRandomize={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(html).toContain('退出房间后可修改名称和头像')
    expect(html).not.toContain('name="player-profile-name"')
    expect(html).not.toContain('保存资料')
  })
})
