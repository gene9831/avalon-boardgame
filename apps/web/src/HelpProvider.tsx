import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { HelpContext, type HelpTab, type OpenHelpIntent } from './help-context'
import { HelpDialog } from './HelpDialog'

interface HelpRequest {
  activeTab: HelpTab
  focusRoles: boolean
  open: boolean
  playerCount?: number
  requestID: number
}

const initialRequest: HelpRequest = {
  activeTab: 'rules',
  focusRoles: false,
  open: false,
  requestID: 0,
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<HelpRequest>(initialRequest)
  const closeHelp = useCallback(() => {
    setRequest((current) => ({ ...current, open: false }))
  }, [])
  const openHelp = useCallback((intent: OpenHelpIntent = {}) => {
    setRequest((current) => ({
      activeTab: intent.tab ?? 'rules',
      focusRoles: intent.focusRoles ?? false,
      open: true,
      ...(intent.playerCount === undefined
        ? {}
        : { playerCount: intent.playerCount }),
      requestID: current.requestID + 1,
    }))
  }, [])
  const value = useMemo(
    () => ({ closeHelp, openHelp }),
    [closeHelp, openHelp],
  )

  return (
    <HelpContext.Provider value={value}>
      {children}
      <HelpDialog
        activeTab={request.activeTab}
        focusRoles={request.focusRoles}
        onActiveTabChange={(activeTab) => {
          setRequest((current) => ({ ...current, activeTab }))
        }}
        onRequestClose={closeHelp}
        open={request.open}
        {...(request.playerCount === undefined
          ? {}
          : { playerCount: request.playerCount })}
        requestID={request.requestID}
      />
    </HelpContext.Provider>
  )
}
