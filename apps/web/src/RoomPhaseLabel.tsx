import type { ReactNode } from 'react'

export function RoomPhaseLabel({ phase }: { phase: ReactNode }) {
  return <p className="font-avalon-serif truncate text-base font-semibold text-amber-100">{phase}</p>
}
