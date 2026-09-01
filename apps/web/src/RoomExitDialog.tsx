import { ModalDialog } from './ModalDialog'

export interface RoomExitDialogProps {
  busy: boolean
  isOwner: boolean
  onCancel: () => void
  onConfirm: () => void
  open: boolean
}

export function RoomExitDialog({
  busy,
  isOwner,
  onCancel,
  onConfirm,
  open,
}: RoomExitDialogProps) {
  const title = isOwner ? '确认解散房间' : '确认退出房间'
  const actionLabel = isOwner ? '解散房间' : '退出房间'
  const busyLabel = isOwner ? '正在解散…' : '正在退出…'
  const description = isOwner
    ? '解散后，所有玩家都会返回房间列表，这个房间无法恢复。'
    : '退出后将释放你的座位。再次加入时会自动分配空座位。'

  return (
    <ModalDialog
      ariaLabelledBy="room-exit-dialog-title"
      closeDisabled={busy}
      onRequestClose={onCancel}
      open={open}
      tone="danger"
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
    </ModalDialog>
  )
}
