import { RoleCard } from './RoleCard'
import type { RoomStageOverlayModel } from './room-screen-model'

type IdentityRecognitionOverlay = Extract<RoomStageOverlayModel, { kind: 'identityRecognition' }>

export function IdentityRecognitionLayer({ overlay }: { overlay: IdentityRecognitionOverlay }) {
  if (overlay.curtainState === 'closed') {
    return (
      <section aria-label="身份辨认幕布" className="identity-curtain identity-curtain--closed absolute inset-0 z-[30] grid place-items-center overflow-hidden px-5 text-center" data-curtain-state="closed" data-identity-step={overlay.step}>
        <CurtainDecoration />
        <h2 className="relative z-10 font-serif text-2xl font-semibold text-amber-50">{overlay.title}</h2>
      </section>
    )
  }

  if (overlay.curtainState === 'lowered') {
    return (
      <section aria-label="身份辨认" className="pointer-events-none absolute inset-0 z-[30] overflow-hidden" data-curtain-state="lowered" data-identity-step={overlay.step} data-table-visibility="hidden">
        <div aria-hidden="true" className="identity-curtain identity-curtain--lowering absolute inset-0"><CurtainDecoration /></div>
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 p-3">
          <h2 className="font-serif text-xl font-semibold text-amber-50">{overlay.title}</h2>
          {overlay.role !== null && <RoleCard role={overlay.role} />}
        </div>
      </section>
    )
  }

  return (
    <section aria-label="身份辨认" className="pointer-events-none absolute inset-0 z-[30]" data-curtain-state="raised" data-identity-step={overlay.step}>
      <div aria-hidden="true" className="identity-curtain identity-curtain--raising absolute inset-0"><CurtainDecoration /></div>
      <h2 className="sr-only">{overlay.title}</h2>
    </section>
  )
}

function CurtainDecoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(56,45,24,0.3),_transparent_34%),linear-gradient(180deg,_#0b1728,_#030812)]">
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-black/55 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-[18%] bg-gradient-to-l from-black/55 to-transparent" />
    </div>
  )
}
