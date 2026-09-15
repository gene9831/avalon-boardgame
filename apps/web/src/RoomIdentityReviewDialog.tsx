import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { Role } from '@avalon/game'

import { RoomIdentityCardReading } from './RoomIdentityConfirmation'

export function RoomIdentityReviewDialog({
  onClose,
  role,
}: Readonly<{
  onClose: () => void
  role: Role
}>) {
  const dialog = (
    <section
      aria-label="我的身份详情"
      aria-modal="true"
      className="room-identity-review-dialog fixed inset-0 z-[100] min-h-0 overflow-hidden bg-slate-950/95 p-3"
      data-identity-review-dialog="true"
      role="dialog"
    >
      <button
        aria-label="收起身份卡"
        className="absolute right-3 top-3 z-[110] grid size-10 place-items-center rounded-full border border-white/20 bg-slate-950/90 text-slate-100 shadow-lg hover:border-amber-200/60 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
      <RoomIdentityCardReading role={role} view="revealed" />
    </section>
  )

  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body)
}
