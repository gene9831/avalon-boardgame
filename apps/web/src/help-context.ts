import { createContext, useContext } from 'react'

export type HelpTab = 'roles' | 'rules'

export interface OpenHelpIntent {
  focusRoles?: boolean
  playerCount?: number
  tab?: HelpTab
}

export interface HelpContextValue {
  closeHelp: () => void
  openHelp: (intent?: OpenHelpIntent) => void
}

export const HelpContext = createContext<HelpContextValue | null>(null)

export function useHelp() {
  const value = useContext(HelpContext)
  if (value === null) throw new Error('useHelp must be used within HelpProvider')
  return value
}
