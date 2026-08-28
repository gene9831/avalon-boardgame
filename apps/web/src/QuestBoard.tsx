import { getPlayerCountConfig, type AvalonPlayerView } from '@avalon/game'
import type { ReactNode } from 'react'

interface QuestBoardProps {
  children?: ReactNode
  game: AvalonPlayerView
  numPlayers: number
}

export function QuestBoard({ children, game, numPlayers }: QuestBoardProps) {
  const config = getPlayerCountConfig(numPlayers)
  const latestQuest = game.questHistory.at(-1)

  return (
    <section
      aria-label="任务计分板"
      className="quest-board relative w-full max-w-[32rem] overflow-hidden rounded-[clamp(0.8rem,3vw,1.75rem)] border border-amber-200/35 bg-[linear-gradient(135deg,_rgba(38,61,48,0.98),_rgba(17,40,34,0.98)_52%,_rgba(43,31,20,0.98))] px-[clamp(0.45rem,1.6vw,1.25rem)] py-[clamp(0.45rem,1.4vw,1rem)] shadow-[0_22px_55px_rgba(0,0,0,0.5),inset_0_0_45px_rgba(245,158,11,0.08)]"
    >
      <div className="pointer-events-none absolute inset-1 rounded-[clamp(0.6rem,2.5vw,1.35rem)] border border-amber-100/10 sm:inset-2" />
      <div className="relative">
        <div className="quest-board-decoration flex items-start justify-center">
          <h2 className="hidden font-serif text-lg font-semibold text-amber-50 sm:block sm:text-xl">阿瓦隆 · {numPlayers}人局</h2>
        </div>

        <ol className="quest-progress mt-[clamp(0.35rem,1.5vw,0.75rem)] grid grid-cols-5 gap-[clamp(0.15rem,0.7vw,0.375rem)]" aria-label="五次任务进度">
          {config.questTeamSizes.map((teamSize, index) => {
            const result = game.questHistory.find(({ questIndex }) => questIndex === index)
            const isCurrent = game.status !== 'finished' && game.questIndex === index
            const markerClass = result
              ? result.succeeded
                ? 'border-sky-200/70 bg-sky-400/25 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                : 'border-rose-200/70 bg-rose-500/25 text-rose-50 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
              : isCurrent
                ? 'border-amber-200/80 bg-amber-300/20 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.22)]'
                : 'border-white/15 bg-black/20 text-slate-300'

            return (
              <li className="text-center" key={index}>
                <div aria-current={isCurrent ? 'step' : undefined} className={`mx-auto grid aspect-square w-full max-w-14 place-items-center rounded-full border ${markerClass}`}>
                  <span className="font-serif text-[clamp(0.65rem,2.5vw,1.125rem)] font-bold">{result ? (result.succeeded ? '✓' : '✕') : index + 1}</span>
                </div>
                <p className="quest-team-size mt-1 hidden text-xs font-semibold text-amber-50/85 sm:block">{teamSize} 人</p>
                {config.questFailThresholds[index] === 2 && <p className="quest-team-size hidden text-[0.65rem] text-rose-200 sm:block">需 2 败</p>}
                {result !== undefined && <p className={`mt-0.5 text-[0.45rem] sm:hidden ${result.succeeded ? 'text-sky-100' : 'text-rose-100'}`}>{result.successCount}/{result.failCount}</p>}
              </li>
            )
          })}
        </ol>

        {latestQuest !== undefined && (
          <p className={`quest-latest-result mt-2 hidden rounded-lg border px-2 py-1 text-center text-[0.65rem] sm:block ${latestQuest.succeeded ? 'border-sky-200/15 bg-sky-300/10 text-sky-100' : 'border-rose-200/15 bg-rose-300/10 text-rose-100'}`}>
            第 {latestQuest.questIndex + 1} 次任务{latestQuest.succeeded ? '成功' : '失败'} · {latestQuest.successCount} 张成功 · {latestQuest.failCount} 张失败
          </p>
        )}

        <div className="quest-rejection-track mt-[clamp(0.3rem,1.2vw,0.75rem)] flex items-center gap-1 border-t border-amber-100/10 pt-[clamp(0.3rem,1vw,0.625rem)] sm:gap-2">
          <span className="quest-rejection-label hidden shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-100/60 sm:inline">连续否决</span>
          <ol className="flex flex-1 items-center justify-between" aria-label="连续否决轨道">
            {Array.from({ length: 5 }, (_, index) => {
              const step = index + 1
              const reached = game.consecutiveRejectedTeams >= step
              return (
                <li className={`grid size-[clamp(0.85rem,3vw,1.25rem)] place-items-center rounded-full border text-[clamp(0.42rem,1.4vw,0.6rem)] font-bold ${reached ? 'border-rose-200/70 bg-rose-500/30 text-rose-50' : 'border-white/15 bg-black/20 text-slate-400'}`} key={step}>
                  {step}
                </li>
              )
            })}
          </ol>
        </div>

        {children !== undefined && <div className="quest-action mt-[clamp(0.35rem,1.4vw,0.75rem)] border-t border-amber-100/10 pt-[clamp(0.35rem,1.4vw,0.75rem)]">{children}</div>}
      </div>
    </section>
  )
}
