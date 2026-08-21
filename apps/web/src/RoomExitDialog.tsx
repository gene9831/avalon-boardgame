export interface RoomExitDialogProps {
  busy: boolean
  error: string | null
  isHost: boolean
  onCancel: () => void
  onConfirm: () => void
  open: boolean
}

export function RoomExitDialog({
  busy,
  error,
  isHost,
  onCancel,
  onConfirm,
  open,
}: RoomExitDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const title = isHost ? '确认解散房间' : '确认退出房间'
  const actionLabel = isHost ? '解散房间' : '退出房间'
  const busyLabel = isHost ? '正在解散…' : '正在退出…'
  const description = isHost
    ? '解散后，所有玩家都会返回主页，且本房间无法恢复。'
    : '退出后将释放座位，重新进入需要再次选择座位。'

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      aria-labelledby="room-exit-dialog-title"
      className="w-[calc(100%-2rem)] max-w-md rounded-3xl border border-rose-300/20 bg-slate-900 p-0 text-slate-200 shadow-2xl shadow-black/40 backdrop:bg-slate-950/75"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      ref={dialogRef}
    >
      <form
        className="p-6 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
      >
        <h2 className="text-2xl font-semibold text-white" id="room-exit-dialog-title">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        {error !== null && (
          <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            autoFocus
            className="min-h-11 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="min-h-11 rounded-xl bg-rose-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy}
            type="submit"
          >
            {busy ? busyLabel : actionLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
import { useEffect, useRef } from 'react'
