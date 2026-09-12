import { RoomActionButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { RoomSceneFrame } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomPlayerPresentation,
  RoomScreenGeometry,
  RoomScreenSlots,
  RoomTeamProposalScene as RoomTeamProposalSceneData,
} from './room-screen-props'

export interface RoomTeamProposalSceneProps {
  actions: RoomActionsByKind['teamProposal']
  geometry: RoomScreenGeometry
  scene: RoomTeamProposalSceneData
  slots: RoomScreenSlots
}

function proposalPlayers(scene: RoomTeamProposalSceneData): readonly RoomPlayerPresentation[] {
  return scene.players.map((player) => {
    if (scene.perspective !== 'leader' || player.interaction.kind !== 'selectTeam') {
      return { ...player, interaction: { kind: 'none' } }
    }

    return {
      ...player,
      interaction: {
        ...player.interaction,
        disabled: player.interaction.disabled || scene.submitRequestState === 'pending',
      },
    }
  })
}

export function RoomTeamProposalScene({ actions, geometry, scene, slots }: RoomTeamProposalSceneProps) {
  const leader = scene.perspective === 'leader'
  const framedScene = { ...scene, players: proposalPlayers(scene) }

  return (
    <RoomSceneFrame
      content={{
        title: leader ? '组建任务队伍' : '等待队长组队',
        center: (
          <RoomCenter density="compact">
            <strong className="block text-lg font-semibold text-amber-200">第 {scene.questIndex + 1} 次任务</strong>
            <span className="mt-1 block text-sm text-slate-300">需要 {scene.requiredTeamSize} 名队员</span>
            {scene.consecutiveRejectedTeams > 0 && (
              <span className="mt-1 block text-xs text-slate-400">连续否决 {scene.consecutiveRejectedTeams} / 5</span>
            )}
          </RoomCenter>
        ),
        phaseMiddle: leader ? (
          <div className="space-y-1 text-sm text-slate-300">
            <p>请选择 <strong className="text-amber-200">{scene.requiredTeamSize} 名玩家</strong></p>
            <p>已选 <strong className="text-cyan-200">{scene.selectedCount} / {scene.requiredTeamSize}</strong></p>
          </div>
        ) : <p className="text-sm text-slate-300">队长正在组建任务队伍</p>,
        phaseAction: leader ? (
          <RoomActionButton
            aria-label="确认队伍"
            disabled={!scene.canSubmit}
            onClick={actions.onSubmitTeam}
            requestState={scene.submitRequestState}
          >
            确认队伍
          </RoomActionButton>
        ) : null,
      }}
      geometry={geometry}
      onActivatePlayer={leader ? actions.onActivatePlayer : undefined}
      scene={framedScene}
      slots={slots}
    />
  )
}
