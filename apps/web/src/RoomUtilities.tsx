import { CircleHelp, Eye, EyeOff } from 'lucide-react'

import { RoomLogControl } from './RoomLogControl'
import { RoomMoreMenu } from './RoomMoreMenu'
import { RoomToolbar, type RoomToolbarItem } from './RoomToolbar'
import type { RoomLogEntry } from './room-log'
import type { RoomUtilityModel } from './room-screen-model'

export interface RoomUtilityTools {
  connected: boolean
  onOpenHelp: () => void
  logEntries: readonly RoomLogEntry[]
  onRequestRoomExit: () => void
  roomExitBusy: boolean
  roomExitBlocked: boolean
  seatChangePending: boolean
  isOwner: boolean
  onToggleRoleKnowledge: () => void
}

export function RoomUtilities({ model, tools }: { model: RoomUtilityModel; tools: RoomUtilityTools }) {
  const helpItem: RoomToolbarItem = {
    icon: CircleHelp,
    id: 'help',
    label: '打开帮助说明',
    onActivate: tools.onOpenHelp,
  }
  if (model.variant === 'loading') return <RoomToolbar items={[helpItem]} />

  if (model.variant === 'lobby') {
    return (
      <RoomToolbar items={[helpItem]}>
        <RoomMoreMenu
          connected={tools.connected}
          entries={tools.logEntries}
          isOwner={tools.isOwner}
          onRequestRoomExit={tools.onRequestRoomExit}
          roomExitBlocked={tools.roomExitBlocked}
          roomExitBusy={tools.roomExitBusy}
          seatChangePending={tools.seatChangePending}
        />
      </RoomToolbar>
    )
  }

  return (
    <RoomToolbar items={[helpItem]}>
      <RoomLogControl entries={tools.logEntries} />
      {model.showIdentityKnowledge && (
        <button
          aria-label={model.roleKnowledgeOpen ? '隐藏我的身份与已知信息' : '查看我的身份与已知信息'}
          aria-pressed={model.roleKnowledgeOpen}
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border-0 bg-transparent p-0 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          data-room-toolbar-item="identity"
          onClick={tools.onToggleRoleKnowledge}
          type="button"
        >
          {model.roleKnowledgeOpen ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      )}
      {model.showRoomExit && (
        <RoomMoreMenu
          connected={tools.connected}
          entries={tools.logEntries}
          isOwner={tools.isOwner}
          onRequestRoomExit={tools.onRequestRoomExit}
          roomExitBlocked={tools.roomExitBlocked}
          roomExitBusy={tools.roomExitBusy}
          seatChangePending={tools.seatChangePending}
        />
      )}
    </RoomToolbar>
  )
}
