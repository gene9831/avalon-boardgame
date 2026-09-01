import { useEffect, useRef, type ReactNode } from 'react'

export interface ModalDialogProps {
  ariaLabelledBy: string
  children: ReactNode
  closeDisabled: boolean
  onAfterOpen?: () => void
  onRequestClose: () => void
  open: boolean
  size?: 'default' | 'wide'
  tone?: 'default' | 'danger'
}

export function ModalDialog({
  ariaLabelledBy,
  children,
  closeDisabled,
  onAfterOpen,
  onRequestClose,
  open,
  size = 'default',
  tone = 'default',
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const toneClasses = tone === 'danger'
    ? 'border-rose-300/20 backdrop:bg-slate-950/75'
    : 'border-white/15 backdrop:bg-slate-950/70'
  const sizeClasses = size === 'wide' ? 'max-w-5xl' : 'max-w-md'

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    if (open && !dialog.open) {
      dialog.showModal()
      onAfterOpen?.()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [onAfterOpen, open])

  return (
    <dialog
      aria-labelledby={ariaLabelledBy}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border bg-slate-900 p-0 text-slate-200 shadow-2xl shadow-black/40 ${sizeClasses} ${toneClasses}`}
      onCancel={(event) => {
        event.preventDefault()
        if (!closeDisabled) onRequestClose()
      }}
      ref={dialogRef}
    >
      {children}
    </dialog>
  )
}
