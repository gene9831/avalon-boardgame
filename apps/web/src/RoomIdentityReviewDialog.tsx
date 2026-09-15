import { createPortal } from 'react-dom'
import type { Role } from '@avalon/game'

import { RoomActionButton } from './RoomActionButton'
import { RoomIdentityCardReading } from './RoomIdentityConfirmation'

export function RoomIdentityReviewDialog({
  onClose,
  portalHost,
  role,
}: Readonly<{
  onClose: () => void
  portalHost: HTMLElement | null
  role: Role
}>) {
  const dialog = (
    <section
      aria-label="我的身份详情"
      aria-modal="true"
      className="room-identity-review-dialog absolute inset-0 z-[100] grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden bg-slate-950/95 p-3"
      data-identity-review-dialog="true"
      role="dialog"
    >
      <div className="relative min-h-0 overflow-hidden">
        <RoomIdentityCardReading role={role} view="revealed" />
      </div>
      <div className="mx-auto w-full max-w-[760px]">
        <RoomActionButton
          data-identity-review-close="true"
          onClick={onClose}
          tone="secondary"
        >
          收起身份卡
        </RoomActionButton>
      </div>
    </section>
  )

  return typeof document === 'undefined'
    ? dialog
    : createPortal(dialog, portalHost ?? document.body)
}
