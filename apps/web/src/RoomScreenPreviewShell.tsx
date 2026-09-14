import { CircleHelp, Eye, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useHelp } from './help-context'
import { ObservedRoomScreen } from './ObservedRoomScreen'
import { RoomBackButton } from './RoomBackButton'
import { RoomMoreMenu } from './RoomMoreMenu'
import { RoomToolbar, type RoomToolbarItem } from './RoomToolbar'
import { resolveRoomLayoutDiagnosticsMode } from './room-layout-diagnostics'
import type { RoomScreenProps, RoomScreenSlots } from './room-screen-props'

/** Distributive omit preserves the scene/actions discriminated pair. */
type WithoutObservedShell<Props> = Props extends unknown ? Omit<Props, 'geometry' | 'slots'> : never

export type RoomScreenPreviewShellProps = WithoutObservedShell<RoomScreenProps> & Readonly<{
  controls: ReactNode
}>

function renderObserved(
  props: RoomScreenPreviewShellProps,
  diagnosticsMode: ReturnType<typeof resolveRoomLayoutDiagnosticsMode>,
  slots: RoomScreenSlots,
) {
  return <ObservedRoomScreen {...props} diagnosticsMode={diagnosticsMode} slots={slots} />
}

/**
 * Preview-only integration boundary. Production RoomScreen receives only its
 * two chrome slots; diagnostics and developer controls stay outside that API.
 */
export function RoomScreenPreviewShell(props: RoomScreenPreviewShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { openHelp } = useHelp()
  const [controlsOpen, setControlsOpen] = useState(false)
  const [lastTool, setLastTool] = useState('')
  const diagnosticsMode = resolveRoomLayoutDiagnosticsMode(location.search, import.meta.env.DEV)
  const tools: readonly RoomToolbarItem[] = [
    { id: 'identity', icon: Eye, label: '身份信息', onActivate: () => setLastTool('身份信息') },
    { id: 'help', icon: CircleHelp, label: '帮助', onActivate: () => openHelp({ playerCount: props.scene.playerCount ?? 5 }) },
  ]
  const slots: RoomScreenSlots = {
    back: <RoomBackButton onBack={() => navigate('/dev/room-layout')} />,
    toolbar: (
      <>
        <RoomToolbar items={tools}>
          <RoomMoreMenu
            connected
            entries={[]}
            isOwner={false}
            onRequestRoomExit={() => undefined}
            roomExitBlocked
            roomExitBusy={false}
            seatChangePending={false}
            showRoomExit={false}
          />
        </RoomToolbar>
        <span aria-live="polite" className="sr-only font-sans">
          {lastTool === '' ? '' : `已触发${lastTool}`}
        </span>
      </>
    ),
  }

  return (
    <div className="room-lobby-preview" data-room-preview-shell="true">
      {renderObserved(props, diagnosticsMode, slots)}
      {!controlsOpen && (
        <button
          aria-expanded={false}
          aria-label="打开开发预览控制"
          className="room-lobby-preview__controls-trigger font-sans"
          onClick={() => setControlsOpen(true)}
          type="button"
        >
          <Info aria-hidden="true" size={20} />
        </button>
      )}
      {controlsOpen && (
        <aside aria-label="开发预览控制" className="room-lobby-preview__controls font-sans" id="room-screen-preview-controls">
          <button
            aria-controls="room-screen-preview-controls"
            aria-expanded
            aria-label="关闭开发预览控制"
            className="room-lobby-preview__controls-close"
            onClick={() => setControlsOpen(false)}
            type="button"
          >
            ×
          </button>
          {props.controls}
        </aside>
      )}
    </div>
  )
}
