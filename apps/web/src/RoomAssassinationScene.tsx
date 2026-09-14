import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { ROLE_LABELS } from './room-game'
import { RoomSceneFrame, type RoomSceneContent } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomAssassinationScene as RoomAssassinationSceneData,
  RoomAssassinationView,
  RoomPlayerPresentation,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

export interface RoomAssassinationSceneProps {
  actions: RoomActionsByKind['assassination']
  geometry: RoomScreenGeometry
  scene: RoomAssassinationSceneData
  slots: RoomScreenSlots
}

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled assassination view')
}

function playerName(scene: RoomAssassinationSceneData, playerID: string): string {
  return scene.players.find((player) => player.playerID === playerID)?.name || `${Number(playerID) + 1} 号玩家`
}

function assassinationPlayers(scene: RoomAssassinationSceneData): readonly RoomPlayerPresentation[] {
  return scene.players.map((player) => {
    if (scene.view.kind !== 'selecting' || player.interaction.kind !== 'selectAssassinationTarget') {
      return { ...player, interaction: { kind: 'none' } }
    }

    return {
      ...player,
      interaction: {
        ...player.interaction,
        disabled: player.interaction.disabled || scene.view.submitRequestState === 'pending',
      },
    }
  })
}

function phaseContent(scene: RoomAssassinationSceneData, actions: RoomActionsByKind['assassination']): Pick<RoomSceneContent, 'title' | 'phaseMiddle' | 'phaseAction'> {
  const view: RoomAssassinationView = scene.view
  switch (view.kind) {
    case 'selecting':
      return {
        title: '刺杀梅林',
        phaseMiddle: (
          <p className="text-sm text-slate-300">
            {view.targetPlayerID === null ? '选择你认为是梅林的玩家' : `目标：${playerName(scene, view.targetPlayerID)}`}
          </p>
        ),
        phaseAction: (
          <RoomActionButton
            aria-label="确认刺杀"
            disabled={!view.canSubmit || view.targetPlayerID === null}
            onClick={actions.onAssassinate}
            requestState={view.submitRequestState}
          >
            确认刺杀
          </RoomActionButton>
        ),
      }
    case 'observing':
      return {
        title: view.perspective === 'evil' ? '协助刺杀' : '等待刺杀',
        phaseMiddle: <p className="text-sm text-slate-300">{view.perspective === 'evil' ? '协助刺客找出梅林' : '等待刺客选择目标'}</p>,
        phaseAction: null,
      }
    case 'result':
      return {
        title: '刺杀结果',
        phaseMiddle: (
          <div className="space-y-1 text-sm text-slate-300" role="status">
            <p><strong className="text-slate-100">{playerName(scene, view.targetPlayerID)}</strong> · {ROLE_LABELS[view.targetRole]}</p>
            <p className={view.hit ? 'text-rose-300' : 'text-emerald-300'}>{view.hit ? '刺杀命中' : '刺杀未命中'}</p>
            <p className={view.winner === 'evil' ? 'text-rose-300' : 'text-emerald-300'}>
              {view.winner === 'evil' ? '邪恶阵营获胜' : '正义阵营获胜'}
            </p>
          </div>
        ),
        phaseAction: actions.onContinue === undefined ? null : (
          <RoomActionButton onClick={actions.onContinue}>查看对局结果</RoomActionButton>
        ),
      }
    default:
      return assertNever(view)
  }
}

export function RoomAssassinationScene({ actions, geometry, scene, slots }: RoomAssassinationSceneProps) {
  const phase = phaseContent(scene, actions)
  const framedScene = { ...scene, players: assassinationPlayers(scene) }
  const center = scene.view.kind === 'result' ? (
    <RoomCenter>
      <strong className={`block text-lg font-semibold ${scene.view.winner === 'evil' ? 'text-rose-300' : 'text-emerald-300'}`}>
        {scene.view.winner === 'evil' ? '邪恶阵营获胜' : '正义阵营获胜'}
      </strong>
      <span className={`mt-1 block text-sm ${scene.view.hit ? 'text-rose-300' : 'text-emerald-300'}`}>{scene.view.hit ? '刺杀命中' : '刺杀未命中'}</span>
      <span className="block text-sm text-slate-300">{playerName(scene, scene.view.targetPlayerID)} · {ROLE_LABELS[scene.view.targetRole]}</span>
    </RoomCenter>
  ) : (
    <RoomCenter>
      <strong className="block text-lg font-semibold text-amber-200">刺杀梅林</strong>
      <span className="mt-1 block text-sm text-slate-300">等待刺客选择目标</span>
    </RoomCenter>
  )

  return (
    <RoomSceneFrame
      content={{ ...phase, center }}
      geometry={geometry}
      onActivatePlayer={scene.view.kind === 'selecting' ? actions.onActivatePlayer : undefined}
      scene={framedScene}
      slots={slots}
    />
  )
}
