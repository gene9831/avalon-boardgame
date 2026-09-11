import type { ReactNode } from 'react'
import type { RoomPhaseModel, RoomScreenActions } from './room-screen-model'

function assertNever(value: never): never { void value; throw new Error('Unhandled room phase variant') }
const primaryClass = 'h-11 rounded-xl bg-amber-300 px-4 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40'
const secondaryClass = 'h-11 rounded-xl bg-slate-800 px-4 font-semibold text-slate-100 disabled:opacity-40'
export type RoomPhasePanelSlots = Readonly<{ title: ReactNode; middle: ReactNode; action: ReactNode }>

export function RoomPhasePanelContent({ actions, model }: { actions: RoomScreenActions; model: RoomPhaseModel }): RoomPhasePanelSlots {
  const title = <h2 className="truncate text-sm font-semibold text-amber-100">{model.title}</h2>
  switch (model.kind) {
    case 'loading': return { title, middle: <p role="status">{model.message}</p>, action: null }
    case 'lobby': return {
      title,
      middle: <p className="text-sm text-slate-300">{model.occupied} / {model.total} 位玩家已入席</p>,
      action: model.isOwner ? <button className={primaryClass} disabled={!model.canStart || model.busy} onClick={actions.onStart} type="button">开始游戏</button> : <p className="text-center text-sm text-slate-300" role="status">等待房间创建者开始游戏</p>,
    }
    case 'identityRecognition': return {
      title,
      middle: <p aria-live="polite" role="status">{model.confirmedCount} / {model.participantCount} 已确认</p>,
      action: model.isParticipant ? <button className={primaryClass} disabled={model.confirmed} onClick={actions.onConfirmIdentityRecognition} type="button">{model.confirmed ? '等待其他玩家确认' : model.confirmationLabel}</button> : <p className="text-center text-sm text-slate-300">等待参与玩家完成辨认</p>,
    }
    case 'teamProposal': return {
      title,
      middle: <p className="text-sm text-slate-300">{model.leaderName} 组队 · 已选 {model.selectedCount} / {model.requiredTeamSize}</p>,
      action: <button aria-label={`确认队伍 ${model.selectedCount}/${model.requiredTeamSize}`} className={primaryClass} disabled={!model.canSubmit} onClick={actions.onSubmitTeam} type="button">确认队伍 {model.selectedCount}/{model.requiredTeamSize}</button>,
    }
    case 'teamVote': return {
      title,
      middle: <p className="truncate text-sm text-slate-300">{model.proposedTeamNames.join('、')} · {model.submittedCount}/{model.total} 已投票</p>,
      action: model.canVote ? <div className="grid grid-cols-2 gap-2"><button aria-label="赞成队伍" className={primaryClass} onClick={() => actions.onCastTeamVote('approve')} type="button">赞成</button><button aria-label="反对队伍" className={secondaryClass} onClick={() => actions.onCastTeamVote('reject')} type="button">反对</button></div> : <p className="text-center text-sm text-slate-300" role="status">{model.submittedVote === null ? '等待其他玩家投票' : `你已选择：${model.submittedVote === 'approve' ? '赞成' : '反对'}`}</p>,
    }
    case 'quest': return {
      title,
      middle: <p className="text-sm text-slate-300">{model.status}</p>,
      action: model.canPlaySuccess ? <div className={`grid gap-2 ${model.canPlayFail ? 'grid-cols-2' : 'grid-cols-1'}`}><button aria-label="让任务成功" className={primaryClass} onClick={() => actions.onPlayQuestCard('success')} type="button">成功</button>{model.canPlayFail && <button aria-label="让任务失败" className={secondaryClass} onClick={() => actions.onPlayQuestCard('fail')} type="button">失败</button>}</div> : <p className="text-center text-sm text-slate-300" role="status">{model.submittedCard === null ? '等待任务结算' : `你已提交${model.submittedCard === 'success' ? '成功' : '失败'}，等待任务结算。`}</p>,
    }
    case 'assassination': return {
      title,
      middle: <p className="text-sm text-slate-300">{model.isAssassin ? model.targetName === null ? '选择一名正义阵营玩家' : `目标：${model.targetName}` : '等待刺客选择目标'}</p>,
      action: model.isAssassin ? <button className={primaryClass} disabled={!model.canSubmit} onClick={actions.onAssassinate} type="button">确认目标</button> : null,
    }
    case 'finished': return { title, middle: <p className="text-sm text-slate-300">{model.summary}</p>, action: null }
    default: return assertNever(model)
  }
}
