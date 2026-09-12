import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { RoomSceneFrame } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomLobbyScene as RoomLobbySceneData,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

export interface RoomLobbySceneProps {
  actions: RoomActionsByKind['lobby']
  geometry: RoomScreenGeometry
  scene: RoomLobbySceneData
  slots: RoomScreenSlots
}

export function RoomLobbyScene({ actions, geometry, scene, slots }: RoomLobbySceneProps) {
  const isFull = scene.occupiedCount === scene.seatCount
  const ownerMessage = isFull ? '所有玩家已入座，可以开始游戏。' : '等待所有玩家入座后开始游戏。'
  const playerMessage = isFull ? '所有玩家已入座，等待房主开始游戏。' : '等待其他玩家入座。'
  const message = scene.viewer === 'owner' ? ownerMessage : playerMessage

  return (
    <RoomSceneFrame
      content={{
        title: '等待玩家',
        center: (
          <RoomCenter>
            <strong className="block text-2xl text-white">{scene.occupiedCount} / {scene.seatCount}</strong>
            <span className="mt-1 block text-xs text-slate-400">已入座</span>
          </RoomCenter>
        ),
        phaseMiddle: <p className="text-sm text-slate-300">{message}</p>,
        phaseAction: scene.viewer === 'owner'
          ? <RoomActionButton disabled={!scene.canStart} onClick={actions.onStart} requestState={scene.startRequestState}>开始游戏</RoomActionButton>
          : null,
      }}
      geometry={geometry}
      onActivatePlayer={actions.onActivatePlayer}
      scene={scene}
      slots={slots}
    />
  )
}
