import type { ReactNode } from 'react'
import type { RoomPhaseModel, RoomScreenActions } from './room-screen-model'

function assertNever(value: never): never { void value; throw new Error('Unhandled room phase variant') }
const primaryClass = 'h-11 rounded-xl bg-amber-300 px-4 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40'
const voteOptionClass = 'h-11 rounded-xl border px-4 font-semibold transition disabled:cursor-not-allowed'
export type RoomPhasePanelSlots = Readonly<{ title: ReactNode; middle: ReactNode; action: ReactNode }>

export function RoomPhasePanelContent({ actions, model }: { actions: RoomScreenActions; model: RoomPhaseModel }): RoomPhasePanelSlots {
  const title = <h2 className="truncate text-base font-semibold text-amber-100">{model.title}</h2>
  switch (model.kind) {
    case 'loading': return { title, middle: <p role="status">{model.message}</p>, action: null }
    case 'lobby': {
      const remaining = model.total - model.occupied
      const middle = model.occupied === model.total
        ? model.isOwner ? '所有玩家已入座，可以开始游戏' : '所有玩家已入座'
        : model.isOwner ? `还差 ${remaining} 位玩家即可开始` : `还差 ${remaining} 位玩家`

      return {
        title,
        middle: <p className="text-sm text-slate-300">{middle}</p>,
        action: model.isOwner
          ? <button className={primaryClass} disabled={!model.canStart || model.startPending} onClick={actions.onStart} type="button">{model.startPending ? '正在开始…' : '开始游戏'}</button>
          : null,
      }
    }
    case 'connectionRecovery': return {
      title,
      middle: <p className="text-sm text-slate-300">正在尝试恢复与房间的连接</p>,
      action: model.manualReconnectAvailable ? <button className={primaryClass} onClick={actions.onReconnect} type="button">重新连接</button> : null,
    }
    case 'identityRecognition': return {
      title,
      middle: <p aria-live="polite" role="status">{model.confirmedCount} / {model.participantCount} 已确认</p>,
      action: model.isParticipant ? <button className={primaryClass} disabled={model.confirmed} onClick={actions.onConfirmIdentityRecognition} type="button">{model.confirmed ? '等待其他玩家确认' : model.confirmationLabel}</button> : <p className="text-center text-sm text-slate-300">等待参与玩家完成辨认</p>,
    }
    case 'teamProposal': return {
      title,
      middle: model.isLeader ? (
        <div className="space-y-1 text-sm text-slate-300">
          <p>请选择 <strong className="text-amber-200">{model.requiredTeamSize} 名玩家</strong></p>
          <p>已选 <strong className="text-cyan-200">{model.selectedCount} / {model.requiredTeamSize}</strong></p>
        </div>
      ) : <p className="text-sm text-slate-300">队长正在组建任务队伍</p>,
      action: model.isLeader ? (
        <button aria-label="确认队伍" className={primaryClass} disabled={!model.canSubmit} onClick={actions.onSubmitTeam} type="button">
          {model.isSubmitting ? '正在确认…' : '确认队伍'}
        </button>
      ) : null,
    }
    case 'teamVote': {
      const visibleVote = model.submittedVote ?? model.selectedVote
      const confirmed = model.submittedVote !== null
      return {
        title,
        middle: (
          <div className="grid grid-cols-2 gap-2">
            <button
              aria-label="同意任务队伍"
              aria-pressed={visibleVote === 'approve'}
              className={`${voteOptionClass} ${visibleVote === 'approve' ? 'border-emerald-200/70 bg-emerald-400/25 text-emerald-50' : 'border-white/10 bg-slate-900/70 text-slate-200'}`}
              disabled={!model.canVote}
              onClick={() => actions.onSelectTeamVote('approve')}
              type="button"
            >
              同意
            </button>
            <button
              aria-label="反对任务队伍"
              aria-pressed={visibleVote === 'reject'}
              className={`${voteOptionClass} ${visibleVote === 'reject' ? 'border-rose-200/70 bg-rose-500/25 text-rose-50' : 'border-white/10 bg-slate-900/70 text-slate-200'}`}
              disabled={!model.canVote}
              onClick={() => actions.onSelectTeamVote('reject')}
              type="button"
            >
              反对
            </button>
          </div>
        ),
        action: (
          <button
            aria-label="确认投票"
            className={primaryClass}
            disabled={!model.canVote || model.selectedVote === null}
            onClick={actions.onConfirmTeamVote}
            type="button"
          >
            {confirmed ? '已确认' : model.isSubmitting ? '正在确认…' : '确认投票'}
          </button>
        ),
      }
    }
    case 'quest': {
      if (!model.isOnTeam || model.submittedCard !== null) {
        const middle = model.submittedCard === null
          ? <p className="text-sm text-slate-300">任务队员正在秘密提交任务牌</p>
          : (
            <div className="space-y-1 text-sm text-slate-300" role="status">
              <p>你已提交<strong className={model.submittedCard === 'success' ? 'text-emerald-300' : 'text-rose-300'}>{model.submittedCard === 'success' ? '成功牌' : '失败牌'}</strong></p>
              <p>等待其他任务队员</p>
            </div>
          )
        return { title, middle, action: null }
      }

      const successSelected = model.selectedCard === 'success'
      const failSelected = model.selectedCard === 'fail'
      const middle = model.isEvil ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            aria-label="选择成功任务牌"
            aria-pressed={successSelected}
            className={`${voteOptionClass} ${successSelected ? 'border-emerald-200/70 bg-emerald-400/25 text-emerald-50' : 'border-white/10 bg-slate-900/70 text-slate-200'}`}
            data-quest-card="success"
            disabled={!model.canSelect}
            onClick={() => actions.onSelectQuestCard('success')}
            type="button"
          >成功</button>
          <button
            aria-label="选择失败任务牌"
            aria-pressed={failSelected}
            className={`${voteOptionClass} ${failSelected ? 'border-rose-200/70 bg-rose-500/25 text-rose-50' : 'border-white/10 bg-slate-900/70 text-slate-200'}`}
            data-quest-card="fail"
            disabled={!model.canSelect}
            onClick={() => actions.onSelectQuestCard('fail')}
            type="button"
          >失败</button>
        </div>
      ) : (
        <div className="grid h-11 place-items-center rounded-xl border border-emerald-200/70 bg-emerald-400/25 text-center text-emerald-50" data-quest-card="success">
          <strong className="text-sm leading-none">成功</strong>
          <span className="text-xs leading-none text-emerald-100/80">正义阵营只能提交成功牌</span>
        </div>
      )
      return {
        title,
        middle,
        action: (
          <button className={primaryClass} disabled={!model.canConfirm} onClick={actions.onConfirmQuestCard} type="button">
            {model.isSubmitting ? '正在确认…' : model.isEvil ? '确认任务牌' : '确认成功牌'}
          </button>
        ),
      }
    }
    case 'questResult': return {
      title,
      middle: (
        <div className="space-y-1 text-sm text-slate-300" role="status">
          <p className={`font-semibold ${model.succeeded ? 'text-emerald-300' : 'text-rose-300'}`}>
            {model.succeeded ? '任务成功' : '任务失败'}
          </p>
          <p>{model.successCount} 成功 / {model.failCount} 失败</p>
        </div>
      ),
      action: null,
    }
    case 'assassination': {
      const middle = model.perspective === 'assassin'
        ? model.targetName === null ? '选择你认为是梅林的玩家' : `目标：${model.targetName}`
        : model.perspective === 'evil' ? '协助刺客找出梅林' : '等待刺客选择目标'
      return {
        title,
        middle: <p className="text-sm text-slate-300">{middle}</p>,
        action: model.perspective === 'assassin'
          ? <button className={primaryClass} disabled={!model.canSubmit} onClick={actions.onAssassinate} type="button">{model.isSubmitting ? '正在确认…' : '确认刺杀'}</button>
          : null,
      }
    }
    case 'assassinationResult': return {
      title,
      middle: (
        <div className="space-y-1 text-sm text-slate-300" role="status">
          <p><strong className="text-slate-100">{model.targetName}</strong> · {model.targetRoleLabel}</p>
          <p className={model.winner === 'evil' ? 'text-rose-300' : 'text-emerald-300'}>
            {model.winner === 'evil' ? '邪恶阵营获胜' : '正义阵营获胜'}
          </p>
        </div>
      ),
      action: null,
    }
    case 'finished': return { title, middle: <p className="text-sm text-slate-300">{model.message}</p>, action: null }
    default: return assertNever(model)
  }
}
