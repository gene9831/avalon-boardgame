import { CircleHelp, Eye, EyeOff } from 'lucide-react'

import { RoomMoreMenu } from './RoomMoreMenu'
import { RoomToolbar, type RoomToolbarItem } from './RoomToolbar'
import type { RoomLogEntry } from './room-log'

export type RoomUtilitiesModel = Readonly<{
  variant: 'loading' | 'lobby' | 'game'
  showRoomExit: boolean
  showIdentityKnowledge: boolean
  roleKnowledgeOpen: boolean
}>

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

export function RoomUtilities({ model, tools }: { model: RoomUtilitiesModel; tools: RoomUtilityTools }) {
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

  const items: RoomToolbarItem[] = model.showIdentityKnowledge ? [{
    icon: model.roleKnowledgeOpen ? EyeOff : Eye,
    id: 'identity',
    label: model.roleKnowledgeOpen ? '隐藏我的身份与已知信息' : '查看我的身份与已知信息',
    onActivate: tools.onToggleRoleKnowledge,
    pressed: model.roleKnowledgeOpen,
  }, helpItem] : [helpItem]

  return (
    <RoomToolbar items={items}>
      <RoomMoreMenu
        connected={tools.connected}
        entries={tools.logEntries}
        isOwner={tools.isOwner}
        onRequestRoomExit={tools.onRequestRoomExit}
        roomExitBlocked={tools.roomExitBlocked}
        roomExitBusy={tools.roomExitBusy}
        seatChangePending={tools.seatChangePending}
        showRoomExit={model.showRoomExit}
      />
    </RoomToolbar>
  )
}
