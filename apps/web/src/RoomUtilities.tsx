import { useState } from 'react'
import { Ellipsis, Eye, EyeOff } from 'lucide-react'

import { ConnectionRecoveryControl } from './ConnectionRecoveryControl'
import { HelpTrigger } from './HelpTrigger'
import { PlayerProfileControl } from './PlayerProfileControl'
import type { PlayerProfile } from './player-profile'
import { RoomLogControl } from './RoomLogControl'
import type { RoomLogEntry } from './room-log'
import type { RoomUtilityModel } from './room-screen-model'

export interface RoomUtilityTools {
  connected: boolean
  manualReconnectAvailable: boolean
  onReconnect: () => void
  onOpenHelp: () => void
  logEntries: readonly RoomLogEntry[]
  profile: PlayerProfile
  onSaveProfile: (profile: PlayerProfile) => void
  onRequestRoomExit: () => void
  roomExitBusy: boolean
  roomExitBlocked: boolean
  seatChangePending: boolean
  isOwner: boolean
  onToggleRoleKnowledge: () => void
}

export function RoomUtilities({
  model,
  tools,
}: {
  model: RoomUtilityModel
  tools: RoomUtilityTools
}) {
  const [roomMenuOpen, setRoomMenuOpen] = useState(false)
  return (
    <nav aria-label="房间工具" className="room-utilities flex items-center justify-end gap-1">
      <ConnectionRecoveryControl connected={tools.connected} manualReconnectAvailable={tools.manualReconnectAvailable} onReconnect={tools.onReconnect} />
      <HelpTrigger onOpen={tools.onOpenHelp} variant="icon" />
      <RoomLogControl entries={tools.logEntries} />
      {model.showIdentityKnowledge && (
        <button aria-label={model.roleKnowledgeOpen ? '隐藏我的身份与已知信息' : '查看我的身份与已知信息'} aria-pressed={model.roleKnowledgeOpen} className="room-utility-button" onClick={tools.onToggleRoleKnowledge} type="button">
          {model.roleKnowledgeOpen ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      )}
      {model.showProfile && <PlayerProfileControl locked onSave={tools.onSaveProfile} profile={tools.profile} />}
      {model.showRoomExit && tools.connected && (
        <div className="relative">
          <button aria-expanded={roomMenuOpen} aria-label="房间操作" className="room-utility-button" onClick={() => setRoomMenuOpen((open) => !open)} type="button"><Ellipsis aria-hidden="true" /></button>
          <div className={`${roomMenuOpen ? 'block' : 'hidden'} absolute right-0 top-full z-50 min-w-32 bg-slate-950 p-1.5 shadow-2xl`}>
            <button className="min-h-11 w-full px-3 text-left text-sm font-semibold text-rose-200 disabled:opacity-40" disabled={tools.roomExitBusy || tools.seatChangePending || tools.roomExitBlocked} onClick={tools.onRequestRoomExit} type="button">
              {tools.roomExitBusy ? (tools.isOwner ? '正在解散…' : '正在退出…') : tools.isOwner ? '解散房间' : '退出房间'}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
