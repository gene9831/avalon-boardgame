import type { QuestCard } from '@avalon/game'

import { RoomActionButton, RoomChoiceButton } from './RoomActionButton'
import { RoomCenter } from './RoomCenter'
import { RoomSceneFrame, type RoomSceneContent } from './RoomSceneFrame'
import type {
  RoomActionsByKind,
  RoomQuestScene as RoomQuestSceneData,
  RoomQuestView,
  RoomScreenGeometry,
  RoomScreenSlots,
} from './room-screen-props'

export interface RoomQuestSceneProps {
  actions: RoomActionsByKind['quest']
  geometry: RoomScreenGeometry
  scene: RoomQuestSceneData
  slots: RoomScreenSlots
}

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled quest view')
}

function cardLabel(card: QuestCard): string {
  return card === 'success' ? '成功牌' : '失败牌'
}

function questPhaseContent(view: RoomQuestView, actions: RoomActionsByKind['quest']): Pick<RoomSceneContent, 'title' | 'phaseMiddle' | 'phaseAction'> {
  switch (view.kind) {
    case 'choosing': {
      const actionLabel = view.alignment === 'good' ? '提交成功牌' : '确认任务牌'
      const canConfirm = view.canChoose && (view.alignment === 'good' ? view.selectedCard === 'success' : view.selectedCard !== null)
      const successChoice = (
        <RoomChoiceButton
          aria-label="选择成功任务牌"
          data-quest-card="success"
          disabled={!view.canChoose}
          onClick={() => actions.onSelectCard('success')}
          requestState={view.submitRequestState}
          selected={view.selectedCard === 'success'}
          tone="positive"
        >
          成功
        </RoomChoiceButton>
      )

      return {
        title: '执行任务',
        phaseMiddle: view.alignment === 'good' ? (
          <p className="text-sm text-emerald-100/80">正义阵营只能提交成功牌</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {successChoice}
            <RoomChoiceButton
              aria-label="选择失败任务牌"
              data-quest-card="fail"
              disabled={!view.canChoose}
              onClick={() => actions.onSelectCard('fail')}
              requestState={view.submitRequestState}
              selected={view.selectedCard === 'fail'}
              tone="negative"
            >
              失败
            </RoomChoiceButton>
          </div>
        ),
        phaseAction: (
          <RoomActionButton
            disabled={!canConfirm}
            onClick={actions.onConfirmCard}
            requestState={view.submitRequestState}
          >
            {actionLabel}
          </RoomActionButton>
        ),
      }
    }
    case 'waiting':
      return {
        title: '等待任务结果',
        phaseMiddle: view.participation === 'observer' ? (
          <p className="text-sm text-slate-300">任务队员正在秘密提交任务牌</p>
        ) : (
          <div className="space-y-1 text-sm text-slate-300" role="status">
            <p>你已提交{view.submittedCard === null ? '任务牌' : <strong className={view.submittedCard === 'success' ? 'text-emerald-300' : 'text-rose-300'}>{cardLabel(view.submittedCard)}</strong>}</p>
            <p>等待其他任务队员</p>
          </div>
        ),
        phaseAction: null,
      }
    case 'result':
      return {
        title: '任务结算',
        phaseMiddle: (
          <div className="space-y-1 text-sm text-slate-300" role="status">
            <p className={`font-semibold ${view.succeeded ? 'text-emerald-300' : 'text-rose-300'}`}>
              {view.succeeded ? '任务成功' : '任务失败'}
            </p>
            <p>{view.successCount} 成功 / {view.failCount} 失败</p>
          </div>
        ),
        phaseAction: (
          <RoomActionButton onClick={actions.onContinue}>
            {view.continueIntent === 'assassination' ? '进入刺杀阶段' : view.continueIntent === 'gameResult' ? '查看对局结果' : '继续'}
          </RoomActionButton>
        ),
      }
    default:
      return assertNever(view)
  }
}

export function RoomQuestScene({ actions, geometry, scene, slots }: RoomQuestSceneProps) {
  const phase = questPhaseContent(scene.view, actions)
  const framedScene = {
    ...scene,
    players: scene.players.map((player) => ({ ...player, interaction: { kind: 'none' } as const })),
  }
  const center = scene.view.kind === 'result' ? (
    <RoomCenter density="compact">
      <strong className={`block text-lg font-semibold ${scene.view.succeeded ? 'text-emerald-300' : 'text-rose-300'}`}>
        {scene.view.succeeded ? '任务成功' : '任务失败'}
      </strong>
      <span className="mt-1 block text-sm text-slate-300">{scene.view.successCount} 成功 / {scene.view.failCount} 失败</span>
      {scene.failThreshold === 2 && <span className="block text-sm text-slate-300">需要 2 张失败牌</span>}
    </RoomCenter>
  ) : (
    <RoomCenter density="compact">
      <strong className="block text-lg font-semibold text-amber-200">第 {scene.questIndex + 1} 次任务</strong>
      <span className="mt-1 block text-sm text-slate-300">{scene.submittedCount} / {scene.requiredSubmissionCount} 已提交</span>
      {scene.failThreshold === 2 && <span className="block text-sm text-slate-300">需要 2 张失败牌</span>}
    </RoomCenter>
  )

  return (
    <RoomSceneFrame
      content={{ ...phase, center }}
      geometry={geometry}
      scene={framedScene}
      slots={slots}
    />
  )
}
