import { Check, CircleX, UserRound, X } from 'lucide-react'
import '@fontsource/almendra/700.css'

import type { QuestProgressNodeModel } from './room-screen-model'

interface QuestProgressTrackProps {
  nodes: readonly QuestProgressNodeModel[]
}

const questNumerals = ['I', 'II', 'III', 'IV', 'V'] as const

export function QuestProgressTrack({ nodes }: QuestProgressTrackProps) {
  return (
    <ol
      aria-label="五次任务进度"
      className="quest-progress-track grid w-full grid-cols-5 gap-1"
    >
      {nodes.map((node) => {
        const stateContent = node.state === 'success'
          ? <Check aria-hidden="true" className="size-5" strokeWidth={2.6} />
          : node.state === 'failure'
            ? <X aria-hidden="true" className="size-5" strokeWidth={2.6} />
            : questNumerals[node.questIndex]
        const requirements = node.teamSize === null || node.failThreshold === null
            ? null
            : (
              <span aria-hidden="true" className="quest-progress-meta absolute inset-x-0 bottom-0 flex min-h-3 items-center justify-center gap-0.5 whitespace-nowrap text-xs font-semibold leading-3 text-amber-50/85">
                <span className="flex items-center"><UserRound aria-hidden="true" className="size-3" strokeWidth={2.2} />{node.teamSize}</span>
                {node.failThreshold > 1 && (
                  <span className="flex items-center"><CircleX aria-hidden="true" className="size-3 text-rose-200/90" strokeWidth={2.2} />{node.failThreshold}</span>
                )}
              </span>
            )
        const stateLabel = node.state === 'current'
          ? '，当前任务'
          : node.state === 'success'
            ? '，任务成功'
            : node.state === 'failure'
              ? '，任务失败'
              : ''
        const requirementLabel = node.teamSize === null || node.failThreshold === null
          ? ''
          : `，${node.teamSize} 人，需 ${node.failThreshold} 张失败牌才会失败`

        return (
          <li
            aria-label={`第 ${node.questIndex + 1} 次任务${requirementLabel}${stateLabel}`}
            className="min-w-0 text-center"
            data-quest-index={node.questIndex}
            key={node.questIndex}
          >
            <div
              aria-current={node.state === 'current' ? 'step' : undefined}
              className={`quest-progress-node relative mx-auto grid size-[var(--quest-progress-node-size)] place-items-center rounded-full border text-xs font-bold ${node.state === 'success'
                ? 'border-sky-200/70 bg-sky-400/25 text-sky-50'
                : node.state === 'failure'
                  ? 'border-rose-200/70 bg-rose-500/25 text-rose-50'
                  : node.state === 'current'
                    ? 'border-amber-200/80 bg-amber-300/20 text-amber-50'
                    : 'border-white/15 bg-black/20 text-slate-300'}`}
            >
              <span className="quest-progress-state absolute inset-0 grid place-items-center font-['Almendra'] text-sm">{stateContent}</span>
              {requirements}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
