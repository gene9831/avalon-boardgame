import type { TeamVote } from '@avalon/game'

import { RoomActionButton, RoomChoiceButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { RoomSceneFrame, type RoomSceneContent } from './RoomSceneFrame'
import { RoomTeamTokens } from './RoomTeamTokens'
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
    case 'result':
      return {
        phaseMiddle: (
          <div className="space-y-1 text-sm text-slate-300" role="status">
            <p className={view.approved ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
              {view.approved ? '队伍通过' : '队伍被否决'}
            </p>
            <p>{view.approvalCount} 同意 / {view.rejectionCount} 反对</p>
          </div>
        ),
        phaseAction: (
          <RoomActionButton onClick={actions.onContinue}>
            {view.continueIntent === 'gameResult' ? '查看对局结果' : '继续'}
          </RoomActionButton>
        ),
      }
    default:
      return assertNever(view)
  }
}

export function RoomTeamVoteScene({ actions, geometry, scene, slots }: RoomTeamVoteSceneProps) {
  const phase = phaseContent(scene.view, actions)
  const finalVote = scene.view.kind !== 'result' && scene.consecutiveRejectedTeams === 4
  const teamTokens = scene.teamTokens ?? []
  const framedScene = {
    ...scene,
    players: scene.players.map((player) => ({ ...player, interaction: { kind: 'none' } as const })),
  }

  return (
    <RoomSceneFrame
      content={{
        title: scene.view.kind === 'result' ? '队伍表决结果' : finalVote ? '最终表决 · 否决即邪恶获胜' : '表决任务队伍 · 过半通过',
        center: (
          <RoomCenter density="compact">
            <strong className={`block text-lg font-semibold ${scene.view.kind === 'result' ? scene.view.approved ? 'text-emerald-300' : 'text-rose-300' : 'text-amber-200'}`}>
              {scene.view.kind === 'result' ? scene.view.approved ? '队伍通过' : '队伍被否决' : `第 ${scene.questIndex + 1} 次任务`}
            </strong>
            {scene.view.kind !== 'result' && (
              <span className="mt-1 block text-sm text-slate-300">
                已投票 {scene.submittedCount} / {scene.participantCount}
              </span>
            )}
            <div className={`${scene.view.kind === 'result' ? 'mt-2' : 'mt-1'} flex justify-center`}>
              <RoomTeamTokens requiredTeamSize={teamTokens.length} state="confirmed" tokens={teamTokens} />
            </div>
            {scene.view.kind === 'result' && (
              <span className="mt-1 block text-sm text-slate-300">
                {scene.view.approvalCount} 同意 / {scene.view.rejectionCount} 反对
              </span>
            )}
            {scene.view.kind !== 'result' && scene.consecutiveRejectedTeams > 0 && (
              <span
                className="mt-1 block text-sm text-slate-400"
                data-critical-rejection-warning={finalVote || undefined}
              >
                {finalVote && <span aria-label="最终否决风险" role="img">⚠️ </span>}
                连续否决 {scene.consecutiveRejectedTeams} / 5
              </span>
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
