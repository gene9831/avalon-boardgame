import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { RoomSceneFrame } from './RoomSceneFrame'
import type {
  RoomConnectionRecoveryScene as RoomConnectionRecoverySceneData,
  RoomLoadingScene as RoomLoadingSceneData,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

type RoomLoadingSceneProps = Readonly<{
  geometry: RoomScreenGeometry
  slots: RoomScreenSlots
}> & (
  | Readonly<{ actions: null; scene: RoomLoadingSceneData }>
  | Readonly<{ actions: Readonly<{ onReconnect(): void }>; scene: RoomConnectionRecoverySceneData }>
)

export function RoomLoadingScene({ actions, geometry, scene, slots }: RoomLoadingSceneProps) {
  const title = scene.kind === 'connectionRecovery' ? '正在重新连接' : '正在加载房间'
  const message = scene.kind === 'connectionRecovery'
    ? '正在恢复与房间的连接。'
    : scene.message
  const reconnectAction = scene.kind === 'connectionRecovery' && scene.manualReconnectAvailable && actions !== null
    ? <RoomActionButton onClick={actions.onReconnect}>重新连接</RoomActionButton>
    : null

  return (
    <RoomSceneFrame
      content={{
        title,
        center: <RoomCenter density="compact"><p role="status">{message}</p></RoomCenter>,
        phaseMiddle: <p className="text-sm text-slate-300">{message}</p>,
        phaseAction: reconnectAction,
      }}
      geometry={geometry}
      scene={scene}
      slots={slots}
    />
  )
}
