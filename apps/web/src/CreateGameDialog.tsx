import { getPlayerCountConfig, type AvalonRoleConfiguration } from '@avalon/game'

import { ModalDialog } from './ModalDialog'

export interface CreateGameDialogProps {
  busy: boolean
  numPlayers: number
  onCancel: () => void
  onConfirm: () => void
  onPlayerCountChange: (value: number) => void
  onRoleConfigurationChange: (value: AvalonRoleConfiguration) => void
  open: boolean
  roleConfiguration: AvalonRoleConfiguration
}

const PLAYER_COUNTS = [5, 6, 7, 8, 9, 10] as const

export function CreateGameDialog({
  busy,
  numPlayers,
  onCancel,
  onConfirm,
  onPlayerCountChange,
  onRoleConfigurationChange,
  open,
  roleConfiguration,
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
          创建房间
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white" id="create-game-dialog-title">
          创建一局阿瓦隆
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          选择本局人数。所有座位坐满后，房间创建者即可开始游戏。
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">身份与秘密选择只会显示给应该知道的玩家。</p>

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

        <label className="role-configuration-toggle mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
          <input
            checked={roleConfiguration.percivalMorgana}
            className="mt-0.5 size-5 accent-amber-300"
            disabled={busy}
            onChange={(event) => onRoleConfigurationChange({ percivalMorgana: event.target.checked })}
            role="switch"
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-slate-100">帕西维尔与莫甘娜</span>
            <small className="mt-1 block leading-5 text-slate-400">帕西维尔会看到梅林与莫甘娜两名候选人。</small>
          </span>
        </label>

        <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-label={`${numPlayers} 人规则摘要`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-400">阵营人数</span>
            <span className="font-semibold text-slate-100">
              {config.good} 人正义阵营 · {config.evil} 人邪恶阵营
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-400">五次任务所需人数</span>
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
