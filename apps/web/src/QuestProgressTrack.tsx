import { getPlayerCountConfig, type AvalonPlayerView } from '@avalon/game'

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
        const requiresTwoFails = config.questFailThresholds[questIndex] === 2

        return (
          <li
            aria-label={`第 ${questIndex + 1} 次任务，${teamSize} 人${requiresTwoFails ? '，需 2 张失败牌才会失败' : ''}`}
            className="text-center"
            data-quest-index={questIndex}
            key={questIndex}
          >
            <div
              aria-current={isCurrent ? 'step' : undefined}
              className={`mx-auto grid size-7 place-items-center rounded-full border text-xs font-bold ${result
                ? result.succeeded
                  ? 'border-sky-200/70 bg-sky-400/25 text-sky-50'
                  : 'border-rose-200/70 bg-rose-500/25 text-rose-50'
                : isCurrent
                  ? 'border-amber-200/80 bg-amber-300/20 text-amber-50'
                  : 'border-white/15 bg-black/20 text-slate-300'}`}
            >
              {result ? (result.succeeded ? '✓' : '✕') : questIndex + 1}
            </div>
            <span className="quest-progress-team-size mt-1 block text-[0.625rem] font-semibold text-amber-50/80">
              {teamSize} 人
            </span>
            {requiresTwoFails && <span className="sr-only">第 4 次任务需 2 张失败牌才会失败</span>}
          </li>
        )
      })}
    </ol>
  )
}
