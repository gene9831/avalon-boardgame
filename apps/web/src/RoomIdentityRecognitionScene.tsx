import {
  RoomIdentityRecognitionCenterSurface,
  RoomIdentityRecognitionPhaseContentSurface,
  RoomIdentityRecognitionStageSurface,
} from './RoomIdentityRecognition'
import { applyRoomIdentityRecognitionSeat } from './room-identity-recognition-seat'
import { RoomSceneFrame } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomIdentityRecognitionScene as RoomIdentityRecognitionSceneData,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

export interface RoomIdentityRecognitionSceneProps {
  actions: RoomActionsByKind['identityRecognition']
  geometry: RoomScreenGeometry
  scene: RoomIdentityRecognitionSceneData
  slots: RoomScreenSlots
}

export function RoomIdentityRecognitionScene({
  actions,
  geometry,
  scene,
  slots,
}: RoomIdentityRecognitionSceneProps) {
  const phase = RoomIdentityRecognitionPhaseContentSurface({ actions, scene })
  const presentedScene = {
    ...scene,
    players: scene.players.map((player) => applyRoomIdentityRecognitionSeat(scene, player)),
  }

  return (
    <div className="size-full" data-identity-recognition-state={scene.view}>
      <RoomSceneFrame
        content={{
          title: phase.title,
          center: <RoomIdentityRecognitionCenterSurface scene={scene} />,
          phaseMiddle: phase.middle,
          phaseAction: phase.action,
          stageAtmosphere: <RoomIdentityRecognitionStageSurface actions={actions} scene={scene} />,
        }}
        geometry={geometry}
        scene={presentedScene}
        slots={slots}
      />
    </div>
  )
}
