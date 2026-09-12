import type { ReactNode, Ref } from 'react'

export interface RoomLayoutChromeSlots {
  back: ReactNode
  phase: ReactNode
  questProgress: ReactNode
  roomNumber: ReactNode
  toolbar: ReactNode
}

export interface RoomLayoutProps {
  chrome: RoomLayoutChromeSlots
  layoutRef?: Ref<HTMLElement>
  phasePanel: ReactNode
  phasePanelRef?: Ref<HTMLDivElement>
  stage: ReactNode
  stageAccessory?: ReactNode
  stageRef?: Ref<HTMLDivElement>
  topBarRef?: Ref<HTMLDivElement>
}

export function RoomLayout({
  chrome,
  layoutRef,
  phasePanel,
  phasePanelRef,
  stage,
  stageAccessory,
  stageRef,
  topBarRef,
}: RoomLayoutProps) {
  return (
    <div className="avalon-room-layout-viewport">
      <section aria-label="房间基础布局" className="avalon-room-layout" ref={layoutRef}>
        <div aria-hidden="true" className="avalon-room-layout__topbar" ref={topBarRef} />
        <header className="avalon-room-layout__primary-chrome">
          <div className="avalon-room-layout__back">{chrome.back}</div>
          <div className="avalon-room-layout__quest-progress">{chrome.questProgress}</div>
        </header>
        <div className="avalon-room-layout__room-number">{chrome.roomNumber}</div>
        <main className="avalon-room-layout__stage-region" data-room-slot="stage">
          {stageAccessory !== undefined && (
            <div className="avalon-room-layout__stage-accessory" data-room-slot="stage-accessory">
              {stageAccessory}
            </div>
          )}
          <div className="avalon-room-layout__stage-content" ref={stageRef}>{stage}</div>
        </main>
        <footer className="avalon-room-layout__phase-region">
          <div className="avalon-room-layout__phase">{chrome.phase}</div>
          <div className="avalon-room-layout__toolbar">{chrome.toolbar}</div>
          <div className="avalon-room-layout__phase-panel" ref={phasePanelRef}>{phasePanel}</div>
        </footer>
      </section>
    </div>
  )
}
