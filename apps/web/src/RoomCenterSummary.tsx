import type { RoomCenterModel } from './room-screen-model'

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled room center variant')
}

export function RoomCenterSummary({ model }: { model: RoomCenterModel }) {
  switch (model.kind) {
    case 'loadingSummary':
      return <div className="font-avalon-serif room-center-summary" role="status">{model.message}</div>
    case 'lobbySummary':
      return model.ready ? (
        <div className="font-avalon-serif room-center-summary text-center">
          <strong className="block text-lg text-white">等待房主</strong>
          <span className="mt-1 block text-sm text-slate-300">开始游戏</span>
        </div>
      ) : (
        <div className="font-avalon-serif room-center-summary text-center">
          <strong className="block text-2xl text-white">{model.occupied} / {model.total}</strong>
          <span className="mt-1 block text-xs text-slate-400">已入座</span>
        </div>
      )
    case 'questSummary': {
      const statusToneClass = model.statusTone === 'success'
        ? 'font-semibold text-emerald-300'
        : model.statusTone === 'failure'
          ? 'font-semibold text-rose-300'
          : 'text-slate-300'
      return (
        <div className="font-avalon-serif room-center-summary w-[152px] shrink-0 text-center">
          <p className="text-lg font-semibold text-amber-200">第 {model.questIndex + 1} 次任务</p>
          {model.status !== null && <p className={`mt-1 whitespace-nowrap text-sm ${statusToneClass}`} data-quest-summary-tone={model.statusTone ?? 'neutral'}>{model.status}</p>}
          {model.detail != null && <p className="whitespace-nowrap text-sm text-slate-300">{model.detail}</p>}
          {model.rule != null && <p className="whitespace-nowrap text-sm text-amber-300">{model.rule}</p>}
          {model.consecutiveRejectedTeams > 0 && (
            <p
              className={`whitespace-nowrap text-sm ${model.consecutiveRejectedTeams >= 4 ? 'font-semibold text-rose-300' : 'text-slate-400'}`}
              data-rejection-state={model.consecutiveRejectedTeams >= 4 ? 'danger' : 'active'}
            >
              连续否决 {model.consecutiveRejectedTeams} / 5
            </p>
          )}
        </div>
      )
    }
    case 'assassinationSummary': {
      const statusToneClass = model.statusTone === 'success'
        ? 'font-semibold text-emerald-300'
        : model.statusTone === 'failure'
          ? 'font-semibold text-rose-300'
          : 'text-slate-300'
      return (
        <div className="font-avalon-serif room-center-summary w-[168px] shrink-0 text-center">
          <p className="text-lg font-semibold text-amber-200">{model.title}</p>
          <p className={`mt-1 text-sm ${statusToneClass}`} data-assassination-summary-tone={model.statusTone}>{model.status}</p>
          <p className="text-sm text-slate-300">{model.detail}</p>
        </div>
      )
    }
    case 'resultSummary': {
      const winnerClass = model.winner === 'good' ? 'text-emerald-200' : 'text-rose-200'
      return (
        <div className="font-avalon-serif room-center-summary w-[168px] shrink-0 text-center">
          <strong className={`block text-xl font-semibold ${winnerClass}`} data-result-winner={model.winner}>
            {model.winner === 'good' ? '正义阵营获胜' : '邪恶阵营获胜'}
          </strong>
          <p className="mt-1 text-sm text-slate-300">{model.reason}</p>
          <p className="text-sm text-slate-400">{model.questScore}</p>
        </div>
      )
    }
    default:
      return assertNever(model)
  }
}
