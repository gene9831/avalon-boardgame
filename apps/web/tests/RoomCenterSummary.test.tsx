import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RoomCenterSummary } from '../src/RoomCenterSummary'
import type { RoomCenterModel } from '../src/room-screen-model'

function renderCenter(model: RoomCenterModel) {
  return renderToStaticMarkup(<RoomCenterSummary model={model} />)
}

describe('RoomCenterSummary', () => {
  it('renders a seated-player count while the lobby is filling', () => {
    const html = renderCenter({ kind: 'lobbySummary', occupied: 3, total: 5, ready: false })

    expect(html).toContain('<strong')
    expect(html).toContain('3 / 5')
    expect(html).toContain('已入座')
  })

  it('tells full lobbies to wait for the owner to start', () => {
    const html = renderCenter({ kind: 'lobbySummary', occupied: 5, total: 5, ready: true })

    expect(html).toContain('等待房主')
    expect(html).toContain('开始游戏')
  })

  it('reveals the rejection streak only after a rejection and emphasizes four of five', () => {
    const noRejections = renderCenter({
      kind: 'questSummary', questIndex: 0, status: '等待队长选择任务队员',
      consecutiveRejectedTeams: 0,
    })
    const oneRejection = renderCenter({
      kind: 'questSummary', questIndex: 0, status: '等待队长选择任务队员',
      consecutiveRejectedTeams: 1,
    })
    const finalWarning = renderCenter({
      kind: 'questSummary', questIndex: 0, status: '等待队长选择任务队员',
      consecutiveRejectedTeams: 4,
    })

    expect(noRejections).toContain('class="text-lg font-semibold text-amber-200">第 1 次任务')
    expect(noRejections).toContain('等待队长选择任务队员')
    expect(noRejections).not.toContain('正义 0 · 邪恶 0')
    expect(noRejections).not.toContain('连续否决')
    expect(oneRejection).toContain('data-rejection-state="active"')
    expect(oneRejection).toContain('连续否决 1 / 5')
    expect(finalWarning).toContain('data-rejection-state="danger"')
    expect(finalWarning).toContain('连续否决 4 / 5')
  })

  it('renders team size and voting status as separate secondary lines', () => {
    const html = renderCenter({
      kind: 'questSummary',
      questIndex: 2,
      status: '已确定 3 名任务队员',
      detail: '等待所有玩家投票',
      consecutiveRejectedTeams: 0,
    })

    expect(html).toMatch(/第 3 次任务.*已确定 3 名任务队员.*等待所有玩家投票/s)
  })

  it('renders approved-vote context and anonymous quest-card progress', () => {
    const html = renderCenter({
      kind: 'questSummary', questIndex: 0,
      status: '队伍表决通过 · 4 同意 / 1 反对',
      detail: '任务牌 1 / 2', rule: null, statusTone: 'neutral',
      consecutiveRejectedTeams: 0,
    })

    expect(html).toMatch(/第 1 次任务.*队伍表决通过 · 4 同意 \/ 1 反对.*任务牌 1 \/ 2/s)
  })

  it('uses semantic result emphasis and shows the special two-Fail rule', () => {
    const html = renderCenter({
      kind: 'questSummary', questIndex: 3,
      status: '任务成功', detail: '3 成功 / 1 失败',
      rule: '任务失败需满 2 张失败牌', statusTone: 'success',
      consecutiveRejectedTeams: 0,
    })

    expect(html).toContain('data-quest-summary-tone="success"')
    expect(html).toContain('text-emerald-300')
    expect(html).toContain('任务失败需满 2 张失败牌')
  })

  it('renders assassination stakes and a semantic settled outcome', () => {
    const active = renderCenter({
      kind: 'assassinationSummary', title: '刺杀梅林',
      status: '正义阵营已完成 3 次任务',
      detail: '刺客命中梅林，邪恶阵营即可逆转',
      statusTone: 'neutral',
    })
    const settled = renderCenter({
      kind: 'assassinationSummary', title: '刺杀梅林',
      status: '刺杀未命中', detail: '正义阵营获胜', statusTone: 'success',
    })

    expect(active).toMatch(/刺杀梅林.*正义阵营已完成 3 次任务.*刺客命中梅林，邪恶阵营即可逆转/s)
    expect(settled).toContain('data-assassination-summary-tone="success"')
    expect(settled).toContain('text-emerald-300')
    expect(settled).toMatch(/刺杀未命中.*正义阵营获胜/s)
  })

  it.each([
    ['good', '正义阵营获胜', 'text-emerald-200'],
    ['evil', '邪恶阵营获胜', 'text-rose-200'],
  ] as const)('renders the %s final result hierarchy and quest score', (winner, title, toneClass) => {
    const html = renderCenter({
      kind: 'resultSummary',
      winner,
      reason: winner === 'good' ? '刺杀未命中：Bob' : '破坏 3 次任务',
      questScore: '任务 3 成功 / 1 失败',
    })

    expect(html).toContain(title)
    expect(html).toContain(toneClass)
    expect(html).toContain('任务 3 成功 / 1 失败')
  })
})
