import { getPlayerCountConfig } from '@avalon/game'

import { ModalDialog } from './ModalDialog'

export interface CreateGameDialogProps {
  busy: boolean
  numPlayers: number
  onCancel: () => void
  onConfirm: () => void
  onPlayerCountChange: (value: number) => void
  open: boolean
}

const PLAYER_COUNTS = [5, 6, 7, 8, 9, 10] as const

export function CreateGameDialog({
  busy,
  numPlayers,
  onCancel,
  onConfirm,
  onPlayerCountChange,
  open,
}: CreateGameDialogProps) {
  const config = getPlayerCountConfig(numPlayers)

  return (
    <ModalDialog
      ariaLabelledBy="create-game-dialog-title"
      closeDisabled={busy}
      onRequestClose={onCancel}
      open={open}
    >
      <div className="p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
          Create room
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white" id="create-game-dialog-title">
          创建一局阿瓦隆
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          选择本局固定人数。房间坐满后，创建者才能开始游戏。
        </p>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-slate-200">玩家人数</legend>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PLAYER_COUNTS.map((count) => {
              const selected = count === numPlayers
              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-11 rounded-xl border px-3 py-2 font-semibold transition ${selected ? 'border-amber-200 bg-amber-300 text-slate-950 shadow-lg shadow-amber-300/15' : 'border-white/15 bg-slate-950/50 text-slate-200 hover:border-amber-200/50 hover:text-white'}`}
                  disabled={busy}
                  key={count}
                  onClick={() => onPlayerCountChange(count)}
                  type="button"
                >
                  {count}
                </button>
              )
            })}
          </div>
        </fieldset>

        <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-label={`${numPlayers} 人规则摘要`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-400">阵营构成</span>
            <span className="font-semibold text-slate-100">
              {config.good} 名正义 · {config.evil} 名邪恶
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-400">五次任务人数</span>
            <span className="font-semibold tracking-[0.12em] text-amber-100">
              {config.questTeamSizes.join(' · ')}
            </span>
          </div>
        </section>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            className="min-h-11 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="min-h-11 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? '正在创建…' : '创建房间'}
          </button>
        </div>
      </div>
    </ModalDialog>
  )
}
