import { FloatingDevTools } from './FloatingDevTools'

export function LobbyDevTools({
  enabled,
  error,
  onTokenChange,
  token,
}: {
  enabled: boolean
  error: string | null
  onTokenChange: (value: string) => void
  token: string
}) {
  return (
    <FloatingDevTools
      enabled={enabled}
      error={error}
      onTokenChange={onTokenChange}
      token={token}
    />
  )
}
