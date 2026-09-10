import type { AvalonPlayerView } from '@avalon/game'

interface RoundTableQuestSummaryProps {
  game: AvalonPlayerView
}

export function RoundTableQuestSummary({ game }: RoundTableQuestSummaryProps) {
  const latestQuest = game.questHistory.at(-1)

  return (
    <section
      aria-label="任务计分板"
      className="round-table-quest-summary relative size-full overflow-hidden rounded-full border border-amber-200/35 bg-[linear-gradient(135deg,_rgba(38,61,48,0.98),_rgba(17,40,34,0.98)_52%,_rgba(43,31,20,0.98))] px-2 py-3 shadow-[0_16px_36px_rgba(0,0,0,0.45),inset_0_0_30px_rgba(245,158,11,0.08)]"
    >
      {latestQuest !== undefined && (
        <p className="truncate text-center text-[0.625rem] text-amber-50/80">
          第 {latestQuest.questIndex + 1} 次任务{latestQuest.succeeded ? '成功' : '失败'} · {latestQuest.successCount} 张成功 · {latestQuest.failCount} 张失败
        </p>
      )}

      <ol
        aria-label={`连续否决轨道，当前 ${game.consecutiveRejectedTeams} 次`}
        className="mt-2 flex items-center justify-center gap-1 border-t border-amber-100/10 pt-2"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const step = index + 1
          const reached = game.consecutiveRejectedTeams >= step
          return (
            <li
              className={`grid size-4 place-items-center rounded-full border text-[0.55rem] font-bold ${reached ? 'border-rose-200/70 bg-rose-500/30 text-rose-50' : 'border-white/15 bg-black/20 text-slate-400'}`}
              key={step}
            >
              {step}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
