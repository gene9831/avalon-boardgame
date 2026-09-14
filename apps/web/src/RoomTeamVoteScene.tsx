import type { TeamVote } from '@avalon/game'

import { RoomActionButton, RoomChoiceButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { RoomSceneFrame, type RoomSceneContent } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomScreenGeometry,
  RoomScreenSlots,
  RoomTeamVoteScene as RoomTeamVoteSceneData,
  RoomTeamVoteView,
} from './room-screen-props'

export interface RoomTeamVoteSceneProps {
  actions: RoomActionsByKind['teamVote']
  geometry: RoomScreenGeometry
  scene: RoomTeamVoteSceneData
  slots: RoomScreenSlots
}

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled team vote view')
}

function voteLabel(vote: TeamVote): string {
  return vote === 'approve' ? '同意票' : '反对票'
}

function phaseContent(view: RoomTeamVoteView, actions: RoomActionsByKind['teamVote']): Pick<RoomSceneContent, 'phaseMiddle' | 'phaseAction'> {
  switch (view.kind) {
    case 'choosing':
      return {
        phaseMiddle: (
          <div className="grid grid-cols-2 gap-2">
            <RoomChoiceButton
              aria-label="同意任务队伍"
              disabled={!view.canChoose}
              onClick={() => actions.onSelectVote('approve')}
              requestState={view.submitRequestState}
              selected={view.selectedVote === 'approve'}
              tone="positive"
            >
              同意
            </RoomChoiceButton>
            <RoomChoiceButton
              aria-label="反对任务队伍"
              disabled={!view.canChoose}
              onClick={() => actions.onSelectVote('reject')}
              requestState={view.submitRequestState}
              selected={view.selectedVote === 'reject'}
              tone="negative"
            >
              反对
            </RoomChoiceButton>
          </div>
        ),
        phaseAction: (
          <RoomActionButton
            aria-label="确认投票"
            disabled={!view.canChoose || view.selectedVote === null}
            onClick={actions.onConfirmVote}
            requestState={view.submitRequestState}
          >
            确认投票
          </RoomActionButton>
        ),
      }
    case 'waiting':
      return {
        phaseMiddle: (
          <div className="space-y-1 text-sm text-slate-300" role="status">
            <p>你已提交<strong className={view.submittedVote === 'approve' ? 'text-emerald-300' : 'text-rose-300'}>{voteLabel(view.submittedVote)}</strong></p>
            <p>等待其他玩家投票</p>
          </div>
        ),
        phaseAction: null,
      }
    default:
      return assertNever(view)
  }
}

export function RoomTeamVoteScene({ actions, geometry, scene, slots }: RoomTeamVoteSceneProps) {
  const phase = phaseContent(scene.view, actions)
  const framedScene = {
    ...scene,
    players: scene.players.map((player) => ({ ...player, interaction: { kind: 'none' } as const })),
  }

  return (
    <RoomSceneFrame
      content={{
        title: scene.view.kind === 'waiting' ? '等待投票结果' : '表决任务队伍',
        center: (
          <RoomCenter density="compact">
            <strong className="block text-lg font-semibold text-amber-200">第 {scene.questIndex + 1} 次任务</strong>
            <span className="mt-1 block text-sm text-slate-300">{scene.submittedCount} / {scene.participantCount} 已投票</span>
            {scene.consecutiveRejectedTeams > 0 && (
              <span className="mt-1 block text-sm text-slate-400">连续否决 {scene.consecutiveRejectedTeams} / 5</span>
            )}
          </RoomCenter>
        ),
        ...phase,
      }}
      geometry={geometry}
      scene={framedScene}
      slots={slots}
    />
  )
}
