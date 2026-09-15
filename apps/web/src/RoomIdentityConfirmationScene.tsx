import {
  RoomIdentityConfirmationCenterSurface,
  RoomIdentityConfirmationPhaseContentSurface,
  RoomIdentityConfirmationStageSurface,
} from './RoomIdentityConfirmation'
import { RoomSceneFrame } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomIdentityConfirmationScene as RoomIdentityConfirmationSceneData,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

export interface RoomIdentityConfirmationSceneProps {
  actions: RoomActionsByKind['identityConfirmation']
  geometry: RoomScreenGeometry
  scene: RoomIdentityConfirmationSceneData
  slots: RoomScreenSlots
}

export function RoomIdentityConfirmationScene({
  actions,
  geometry,
  scene,
  slots,
}: RoomIdentityConfirmationSceneProps) {
  const phase = RoomIdentityConfirmationPhaseContentSurface({ actions, scene })
  const presentedScene = {
    ...scene,
    players: scene.players.map((player) => ({
      ...player,
      interaction: { kind: 'none' } as const,
    })),
  }

  return (
    <div className="size-full" data-identity-confirmation-state={scene.view}>
      <RoomSceneFrame
        content={{
          title: phase.title,
          center: <RoomIdentityConfirmationCenterSurface scene={scene} />,
          phaseMiddle: phase.middle,
          phaseAction: phase.action,
          stageAtmosphere: <RoomIdentityConfirmationStageSurface actions={actions} scene={scene} />,
        }}
        geometry={geometry}
        scene={presentedScene}
        slots={slots}
      />
    </div>
  )
}
