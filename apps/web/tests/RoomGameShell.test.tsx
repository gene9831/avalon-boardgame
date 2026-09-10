import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { resolveRoomShellMetrics } from '@avalon/ui-layout'

import { RoomGameShell } from '../src/RoomGameShell'

describe('RoomGameShell', () => {
  it.each([
    [{ width: 375, height: 667 }, 'vertical'],
    [{ width: 667, height: 375 }, 'compact-landscape'],
    [{ width: 1024, height: 768 }, 'normal-landscape'],
  ] as const)('maps a measured %o canvas onto the %s shell without duplicating slots', (size, mode) => {
    const html = renderToStaticMarkup(
      <RoomGameShell
        backAction={<button type="button">返回</button>}
        canvasRef={vi.fn()}
        layoutMetrics={resolveRoomShellMetrics(size)}
        phaseAction={<button type="button">操作</button>}
        phaseMiddle="阶段内容"
        phaseTitle="阶段"
        phaseTools={<button type="button">身份</button>}
        questProgress={<ol><li>任务</li></ol>}
        roomStatus="房间"
        stage="舞台"
        stageRef={vi.fn()}
        utilityActions={<button type="button">帮助</button>}
      />,
    )

    expect(html).toContain(`data-room-layout-mode="${mode}"`)
    expect(html.match(/data-room-game-slot="stage"/g)).toHaveLength(1)
    expect(html.match(/data-room-game-slot="phase-middle"/g)).toHaveLength(1)
    expect(html.match(/data-room-game-slot="phase-action"/g)).toHaveLength(1)
  })
})
