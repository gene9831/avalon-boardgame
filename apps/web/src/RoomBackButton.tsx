import { ChevronLeft } from 'lucide-react'

export function RoomBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      aria-label="返回主页"
      className="grid min-h-11 min-w-11 place-items-center rounded-lg border-0 bg-transparent p-0 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      onClick={onBack}
      type="button"
    >
      <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={2} />
    </button>
  )
}
