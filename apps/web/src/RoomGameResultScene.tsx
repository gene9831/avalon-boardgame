import { RoomCenter } from './RoomCenter'
import { RoomSceneFrame } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomGameResultScene as RoomGameResultSceneData,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

export interface RoomGameResultSceneProps {
  actions: RoomActionsByKind['gameResult']
  geometry: RoomScreenGeometry
  scene: RoomGameResultSceneData
  slots: RoomScreenSlots
}

export function RoomGameResultScene({ actions, geometry, scene, slots }: RoomGameResultSceneProps) {
  void actions
  const winnerLabel = scene.winner === 'good' ? '正义阵营获胜' : '邪恶阵营获胜'
  const winnerClass = scene.winner === 'good' ? 'text-emerald-200' : 'text-rose-200'

  return (
    <RoomSceneFrame
      content={{
        title: '对局结束',
        center: (
          <RoomCenter>
            <strong className={`block text-xl font-semibold ${winnerClass}`} data-result-winner={scene.winner}>{winnerLabel}</strong>
            <p className="mt-1 text-sm text-slate-300">{scene.reason}</p>
            <p className="text-sm text-slate-400">{scene.questScore}</p>
          </RoomCenter>
        ),
        phaseMiddle: <p className="text-sm text-slate-300">所有玩家身份已公开，可查看对局记录。</p>,
        phaseAction: null,
      }}
      geometry={geometry}
      scene={scene}
      slots={slots}
    />
  )
}
