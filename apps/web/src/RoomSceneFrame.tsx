import type { ReactNode } from 'react'

import { QuestProgressTrack } from './QuestProgressTrack'
import { RoomLayout } from './RoomLayout'
import { RoomNumber } from './RoomNumber'
import { RoomPhaseLabel } from './RoomPhaseLabel'
import { RoomPhasePanel } from './RoomPhasePanel'
import { RoomPlayerSeat } from './RoomPlayerSeat'
import { RoomStage } from './RoomStage'
import type {
  RoomPlayerPresentation,
  RoomScene,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

export interface RoomSceneContent {
  title: ReactNode
  center: ReactNode
  phaseMiddle: ReactNode
  phaseAction: ReactNode
  stageAtmosphere?: ReactNode
}

type RoomSceneFrameScene = Pick<
  RoomScene,
  'kind' | 'matchID' | 'playerCount' | 'players' | 'questProgress'
>

export interface RoomSceneFrameProps {
  content: RoomSceneContent
  geometry: RoomScreenGeometry
  onActivatePlayer?: (playerID: RoomPlayerPresentation['playerID']) => void
  scene: RoomSceneFrameScene
  slots: RoomScreenSlots
}

export function RoomSceneFrame({
  content,
  geometry,
  onActivatePlayer,
  scene,
  slots,
}: RoomSceneFrameProps) {
  const stage = scene.playerCount === null ? (
    <section
      aria-label="房间加载舞台"
      className="room-stage grid size-full place-items-center"
      data-room-stage="true"
      data-stage-layout-status="measuring"
    >
      {content.center}
    </section>
  ) : (
    <RoomStage
      ariaLabel={`${scene.playerCount} 人游戏圆桌`}
      center={content.center}
      layout={geometry.stageLayout}
      players={scene.players}
      renderPlayer={(player, layout) => (
        <RoomPlayerSeat
          layout={layout}
          onActivate={() => onActivatePlayer?.(player.playerID)}
          player={player}
        />
      )}
    />
  )

  return (
    <div className="size-full" data-room-scene={scene.kind}>
      <RoomLayout
        chrome={{
          back: slots.back,
          phase: <RoomPhaseLabel phase={content.title} />,
          questProgress: <QuestProgressTrack nodes={scene.questProgress} />,
          roomNumber: <RoomNumber matchID={scene.matchID} />,
          toolbar: slots.toolbar,
        }}
        layoutRef={geometry.layoutRef}
        phasePanel={<RoomPhasePanel action={content.phaseAction} middle={content.phaseMiddle} />}
        stage={stage}
        stageAccessory={content.stageAtmosphere}
        stageRef={geometry.stageRef}
      />
    </div>
  )
}
