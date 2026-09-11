import type { ReactNode } from 'react'

export interface RoomPhasePanelProps {
  middle: ReactNode
  action: ReactNode
}

export function RoomPhasePanel({ middle, action }: RoomPhasePanelProps) {
  return (
    <div className="font-avalon-serif grid size-full min-h-0 grid-rows-[minmax(0,1fr)_3.5rem]">
      <div className="min-h-0 overflow-y-auto px-4 py-2" data-room-slot="phase-middle">{middle}</div>
      <div className="grid min-h-14 items-center px-4 py-1.5" data-room-slot="phase-action">{action}</div>
    </div>
  )
}
