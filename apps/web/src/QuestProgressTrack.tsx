import { getPlayerCountConfig, type AvalonPlayerView } from '@avalon/game'
import { Check, CircleX, UsersRound, X } from 'lucide-react'

interface QuestProgressTrackProps {
  game: AvalonPlayerView
  numPlayers: number
}

export function QuestProgressTrack({ game, numPlayers }: QuestProgressTrackProps) {
  const config = getPlayerCountConfig(numPlayers)

  return (
    <ol
      aria-label="五次任务进度"
      className="quest-progress-track grid grid-cols-5 gap-1"
    >
      {config.questTeamSizes.map((teamSize, questIndex) => {
        const result = game.questHistory.find((quest) => quest.questIndex === questIndex)
        const isCurrent = game.status !== 'finished' && game.questIndex === questIndex
        const failThreshold = config.questFailThresholds[questIndex]

        return (
          <li
            aria-label={`第 ${questIndex + 1} 次任务，${teamSize} 人，需 ${failThreshold} 张失败牌才会失败`}
            className="text-center"
            data-quest-index={questIndex}
            key={questIndex}
          >
            <div
              aria-current={isCurrent ? 'step' : undefined}
              className={`quest-progress-node mx-auto grid place-items-center rounded-full border text-xs font-bold ${result
                ? result.succeeded
                  ? 'border-sky-200/70 bg-sky-400/25 text-sky-50'
                  : 'border-rose-200/70 bg-rose-500/25 text-rose-50'
                : isCurrent
                  ? 'border-amber-200/80 bg-amber-300/20 text-amber-50'
                  : 'border-white/15 bg-black/20 text-slate-300'}`}
            >
              {result
                ? result.succeeded
                  ? <Check aria-hidden="true" className="size-1/2" strokeWidth={2.6} />
                  : <X aria-hidden="true" className="size-1/2" strokeWidth={2.6} />
                : questIndex + 1}
            </div>
            <span aria-hidden="true" className="quest-progress-meta mt-0.5 flex items-center justify-center gap-1 text-[0.55rem] font-semibold text-amber-50/75">
              <UsersRound className="size-2.5" strokeWidth={2.2} />
              <span>{teamSize}</span>
              <CircleX className="size-2.5 text-rose-200/80" strokeWidth={2.2} />
              <span>{failThreshold}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
