import { describe, expect, it } from 'vitest'

import { parseLabState, serializeLabState } from './url-state'

describe('layout lab URL state', () => {
  it('parses device mode and all supported controls', () => {
    expect(parseLabState('?viewport=device&width=390&height=844&players=10&gap=6.5&maxAvatarSize=52&avatarSizeStep=4&geometry=1'))
      .toEqual({
        viewportMode: 'device',
        simulatedWidth: 390,
        simulatedHeight: 844,
        playerCount: 10,
        gap: 6.5,
        maxAvatarSize: 52,
        avatarSizeStep: 4,
        showGeometry: true,
      })
  })

  it('falls back when numeric values are invalid', () => {
    expect(parseLabState('?viewport=unknown&width=-1&height=nope&players=11&geometry=4'))
      .toEqual({
        viewportMode: 'simulated',
        simulatedWidth: 390,
        simulatedHeight: 844,
        playerCount: 10,
        gap: 8,
        maxAvatarSize: 56,
        avatarSizeStep: 8,
        showGeometry: false,
      })
  })

  it('preserves simulated dimensions while device mode is active', () => {
    const query = serializeLabState({
      viewportMode: 'device',
      simulatedWidth: 430,
      simulatedHeight: 932,
      playerCount: 8,
      gap: 6,
      maxAvatarSize: 52,
      avatarSizeStep: 4,
      showGeometry: true,
    })

    expect(query).toBe('?viewport=device&width=430&height=932&players=8&gap=6&maxAvatarSize=52&avatarSizeStep=4&geometry=1')
    expect(query).not.toContain('orientation')
    expect(query).not.toContain('preset')
  })
})
