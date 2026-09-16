import type { PlayerID } from '@avalon/game'

export type RoomTeamToken = Readonly<{
  playerID: PlayerID
  seatNumber: number
  name: string
}>

export interface RoomTeamTokensProps {
  tokens: readonly RoomTeamToken[]
  requiredTeamSize: number
  state: 'preview' | 'confirmed'
  disabled?: boolean
  onActivatePlayer?: (playerID: PlayerID) => void
}

function tokenLabel(token: RoomTeamToken) {
  return `${token.seatNumber} 号座位：${token.name}`
}

export function RoomTeamTokens({
  tokens,
  requiredTeamSize,
  state,
  disabled = false,
  onActivatePlayer,
}: RoomTeamTokensProps) {
  const placeholderCount = state === 'preview'
    ? Math.max(0, requiredTeamSize - tokens.length)
    : 0
  const interactive = state === 'preview' && onActivatePlayer !== undefined
  const tokenElements = tokens.map((token) => {
    const label = tokenLabel(token)
    const content = (
      <>
        <span aria-hidden="true" className="room-team-token__seat" data-team-member-seat="true">
          {token.seatNumber}
        </span>
        <span className="room-team-token__name" data-team-member-name="true">
          {token.name}
        </span>
        {interactive && <span aria-hidden="true" className="room-team-token__remove">×</span>}
      </>
    )

    return interactive ? (
      <button
        aria-label={`取消选择 ${label}`}
        className="room-team-token"
        data-team-token="filled"
        data-team-token-row="true"
        disabled={disabled}
        key={token.playerID}
        onClick={() => onActivatePlayer(token.playerID)}
        title={label}
        type="button"
      >
        {content}
      </button>
    ) : (
      <span
        aria-label={label}
        className="room-team-token"
        data-team-token="filled"
        data-team-token-row="true"
        key={token.playerID}
        role="listitem"
        title={label}
      >
        {content}
      </span>
    )
  })
  const placeholderElements = Array.from({ length: placeholderCount }, (_, index) => (
    <span
      aria-hidden="true"
      className="room-team-token room-team-token--placeholder"
      data-team-token-placeholder="true"
      data-team-token-row="true"
      key={`placeholder-${index}`}
    >
      <span aria-hidden="true" className="room-team-token__seat">+</span>
      <span className="room-team-token__name">待选择</span>
    </span>
  ))
  const elements = [...tokenElements, ...placeholderElements]

  return (
    <div
      aria-label={`任务队伍：${tokens.length} / ${requiredTeamSize}`}
      className="room-team-tokens"
      data-team-token-layout="vertical"
      data-team-token-state={state}
      role={interactive ? 'group' : 'list'}
    >
      {elements}
    </div>
  )
}
