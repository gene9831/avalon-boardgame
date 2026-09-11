import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RoomScreen } from '../src/RoomScreen'

describe('RoomScreen', () => {
  it('renders one measuring shell with one instance of every business slot', () => {
    const html = renderToStaticMarkup(
      <RoomScreen
        back={<button>返回</button>}
        diagnosticsMode="off"
        mode="lobby"
        phaseAction={<button>开始</button>}
        phaseMiddle={<span>等待</span>}
        phaseTitle={<h2>等待大厅</h2>}
        phaseTools={<span>工具</span>}
        playerCount={5}
        questProgress={<span>任务</span>}
        roomStatus={<span>房间 ABC1234</span>}
        stage={() => <span>舞台</span>}
        utilities={<span>帮助</span>}
      />,
    )

    expect(html.match(/data-room-screen="true"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="stage"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-middle"/g)).toHaveLength(1)
    expect(html.match(/data-room-slot="phase-action"/g)).toHaveLength(1)
    expect(html).toContain('data-room-mode="lobby"')
    expect(html).toContain('data-room-layout-mode="measuring"')
  })
})
