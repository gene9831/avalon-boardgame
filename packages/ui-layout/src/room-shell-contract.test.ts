import { describe, expect, it } from 'vitest'

import {
  getRoomShellStyleVariables,
  resolveRoomShellMetrics,
  ROOM_SHELL_CLASSES,
} from './index'

describe('room shell structure contract', () => {
  it('publishes stable slot class names and serialized metric variables', () => {
    expect(new Set(Object.values(ROOM_SHELL_CLASSES)).size).toBe(
      Object.values(ROOM_SHELL_CLASSES).length,
    )
    expect(
      getRoomShellStyleVariables(
        resolveRoomShellMetrics({ width: 667, height: 375 }),
      ),
    ).toMatchObject({
      '--room-topbar-height': '0px',
      '--round-table-stage-margin': '8px',
      '--task-rail-width': '56px',
      '--phase-sidebar-width': '192px',
      '--phase-header-height': '48px',
      '--phase-middle-height': '56px',
      '--phase-action-height': '56px',
    })
  })
})
