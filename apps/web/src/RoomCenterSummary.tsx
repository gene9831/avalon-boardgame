import type { RoomCenterModel } from './room-screen-model'

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled room center variant')
}

export function RoomCenterSummary({ model }: { model: RoomCenterModel }) {
  switch (model.kind) {
    case 'loadingSummary':
      return <div className="room-center-summary" role="status">{model.message}</div>
    case 'lobbySummary':
      return model.ready ? (
        <div className="room-center-summary text-center">
          <strong className="block text-lg text-white">等待房主</strong>
          <span className="mt-1 block text-sm text-slate-300">开始游戏</span>
        </div>
      ) : (
        <div className="room-center-summary text-center">
          <strong className="block text-2xl text-white">{model.occupied} / {model.total}</strong>
          <span className="mt-1 block text-xs text-slate-400">已入座</span>
        </div>
      )
    case 'questSummary':
      return <div className="room-center-summary text-center"><p className="text-xs font-semibold text-amber-200">第 {model.questIndex + 1} 次任务</p><strong className="mt-1 block text-sm text-white">正义 {model.goodSuccesses} · 邪恶 {model.evilFailures}</strong><p className="text-xs text-slate-400">连续否决 {model.consecutiveRejectedTeams} / 5</p></div>
    case 'resultSummary':
      return <div className="room-center-summary text-center"><strong className="text-lg text-white">{model.winner === 'good' ? '正义阵营获胜' : '邪恶阵营获胜'}</strong><p className="mt-1 text-xs text-slate-300">{model.reason}</p></div>
    default:
      return assertNever(model)
  }
}
