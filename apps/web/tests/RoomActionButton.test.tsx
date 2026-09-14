import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  RoomActionButton,
  RoomChoiceButton,
} from '../src/RoomActionButton'

describe('RoomActionButton', () => {
  it('keeps the original action label and disables the action while pending', () => {
    const html = renderToStaticMarkup(
      <RoomActionButton requestState="pending">
        确认队伍
      </RoomActionButton>,
    )

    expect(html).toContain('>确认队伍<')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('正在确认')
  })

  it('provides consistent primary and secondary actions', () => {
    const primary = renderToStaticMarkup(
      <RoomActionButton>开始游戏</RoomActionButton>,
    )
    const secondary = renderToStaticMarkup(
      <RoomActionButton tone="secondary">暂时隐藏</RoomActionButton>,
    )

    expect(primary).toContain('min-h-11')
    expect(primary).toContain('bg-amber-300/85')
    expect(secondary).toContain('min-h-11')
    expect(secondary).toContain('bg-slate-900/75')
  })
})

describe('RoomChoiceButton', () => {
  it('exposes the selected choice and locks it while pending', () => {
    const html = renderToStaticMarkup(
      <RoomChoiceButton requestState="pending" selected tone="positive">
        同意
      </RoomChoiceButton>,
    )

    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('>同意<')
  })
})
