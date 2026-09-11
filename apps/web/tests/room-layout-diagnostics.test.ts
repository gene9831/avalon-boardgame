import { describe, expect, it } from 'vitest'

import {
  readRoomSafeAreaInsets,
  resolveRoomLayoutDiagnosticsMode,
  setRoomLayoutDiagnosticsMode,
} from '../src/room-layout-diagnostics'

describe('room layout diagnostic URL state', () => {
  it('resolves only development diagnostic values', () => {
    expect(resolveRoomLayoutDiagnosticsMode('?layoutDebug=1', true)).toBe('metrics')
    expect(resolveRoomLayoutDiagnosticsMode('?layoutDebug=geometry', true)).toBe('geometry')
    expect(resolveRoomLayoutDiagnosticsMode('?layoutDebug=0', true)).toBe('off')
    expect(resolveRoomLayoutDiagnosticsMode('?layoutDebug=geometry', false)).toBe('off')
  })

  it('updates only the diagnostic query parameter', () => {
    expect(setRoomLayoutDiagnosticsMode(new URL('https://example.test/rooms/a?x=1'), 'geometry').search)
      .toBe('?x=1&layoutDebug=geometry')
    expect(setRoomLayoutDiagnosticsMode(new URL('https://example.test/rooms/a?x=1&layoutDebug=1'), 'off').search)
      .toBe('?x=1')
  })

  it('reads decimal safe-area pixels and normalizes invalid values', () => {
    const values: Record<string, string> = {
      '--safe-area-top': '1.5px', '--safe-area-right': '', '--safe-area-bottom': '12.25px', '--safe-area-left': 'invalid',
    }
    const readStyles = () => ({ getPropertyValue: (name: string) => values[name] }) as CSSStyleDeclaration
    expect(readRoomSafeAreaInsets({} as HTMLElement, readStyles)).toEqual({ top: 1.5, right: 0, bottom: 12.25, left: 0 })
  })
})
