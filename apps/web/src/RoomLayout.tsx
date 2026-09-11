import type { ReactNode, Ref } from 'react'

export interface RoomLayoutProps {
  layoutRef?: Ref<HTMLElement>
  phasePanel: ReactNode
  phasePanelRef?: Ref<HTMLElement>
  stage: ReactNode
  stageRef?: Ref<HTMLDivElement>
  topBar: ReactNode
  topBarRef?: Ref<HTMLElement>
}

export function RoomLayout({
  layoutRef,
  phasePanel,
  phasePanelRef,
  stage,
  stageRef,
  topBar,
  topBarRef,
}: RoomLayoutProps) {
  return (
    <div className="avalon-room-layout-viewport">
      <section aria-label="房间基础布局" className="avalon-room-layout" ref={layoutRef}>
        <header className="avalon-room-layout__topbar" ref={topBarRef}>{topBar}</header>
        <main className="avalon-room-layout__stage-region">
          <div className="avalon-room-layout__stage-content" ref={stageRef}>{stage}</div>
        </main>
        <footer className="avalon-room-layout__phase-panel" ref={phasePanelRef}>{phasePanel}</footer>
      </section>
    </div>
  )
}
