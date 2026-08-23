import { useCallback, useRef } from 'react'

import { ModalDialog } from './ModalDialog'

export interface PlayerNameDialogProps {
  action: 'create' | 'join'
  busy: boolean
  error: string | null
  onCancel: () => void
  onChange: (value: string) => void
  onSubmit: () => void
  open: boolean
  value: string
}

export function PlayerNameDialog({
  action,
  busy,
  error,
  onCancel,
  onChange,
  onSubmit,
  open,
  value,
}: PlayerNameDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isCreate = action === 'create'
  const focusNameInput = useCallback(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <ModalDialog
      ariaLabelledBy="player-name-dialog-title"
      closeDisabled={busy}
      onAfterOpen={focusNameInput}
      onRequestClose={onCancel}
      open={open}
    >
      <form
        className="p-6 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <h2 className="text-2xl font-semibold text-white" id="player-name-dialog-title">
          {isCreate ? '创建房间前确认名称' : '加入房间前确认名称'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {isCreate
            ? '创建房间前，可以确认或修改本次使用的玩家名称。'
            : '加入所选座位前，可以确认或修改本次使用的玩家名称。'}
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-200" htmlFor="dialog-player-name">
          玩家名称
        </label>
        <input
          autoFocus
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-wait disabled:opacity-60"
          disabled={busy}
          id="dialog-player-name"
          maxLength={24}
          onChange={(event) => onChange(event.target.value)}
          placeholder="例如：亚瑟"
          ref={inputRef}
          value={value}
        />
        {error !== null && (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-white/15 px-4 py-3 font-semibold text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy
              ? (isCreate ? '创建中…' : '加入中…')
              : (isCreate ? '确认创建' : '确认加入')}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}
