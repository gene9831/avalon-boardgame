import type { PlayerID } from '@avalon/game'

import { PlayerAvatar } from './player-avatars'
import { RoomSeatNumberBadge } from './RoomSeatNumberBadge'
import type { PlayerAvatarID } from './player-profile'

export type RoomTeamToken = Readonly<{
  playerID: PlayerID
  seatNumber: number
  name: string
  avatarID: PlayerAvatarID
}>

export interface RoomTeamTokensProps {
  tokens: readonly RoomTeamToken[]
  requiredTeamSize: number
  state: 'preview' | 'confirmed'
  disabled?: boolean
  onActivatePlayer?: (playerID: PlayerID) => void
}

function layoutForTokenCount(count: number): 'single-row' | 'three-two' {
  return count <= 3 ? 'single-row' : 'three-two'
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
  const layout = layoutForTokenCount(tokens.length + placeholderCount)
  const tokenElements = tokens.map((token) => {
    const label = tokenLabel(token)
    const content = (
      <>
        <span className="room-team-token__avatar" aria-hidden="true">
          <PlayerAvatar avatarID={token.avatarID} className="size-full object-contain p-[12%]" />
        </span>
        <RoomSeatNumberBadge seatNumber={token.seatNumber} />
      </>
    )

    return onActivatePlayer === undefined ? (
      <span
        aria-label={label}
        className="room-team-token"
        data-team-token="filled"
        key={token.playerID}
        role="listitem"
        title={label}
      >
        {content}
      </span>
    ) : (
      <button
        aria-label={label}
        className="room-team-token"
        data-team-token="filled"
        disabled={disabled}
        key={token.playerID}
        onClick={() => onActivatePlayer(token.playerID)}
        title={label}
        type="button"
      >
        {content}
      </button>
    )
  })
  const placeholderElements = Array.from({ length: placeholderCount }, (_, index) => (
    <span
      aria-hidden="true"
      className="room-team-token room-team-token--placeholder"
      data-team-token-placeholder="true"
      key={`placeholder-${index}`}
    >
      +
    </span>
  ))
  const elements = [...tokenElements, ...placeholderElements]
  const rows = layout === 'single-row'
    ? [elements]
    : [elements.slice(0, 3), elements.slice(3)]

  return (
    <div
      aria-label={`任务队伍：${tokens.length} / ${requiredTeamSize}`}
      className="room-team-tokens"
      data-team-token-layout={layout}
      data-team-token-state={state}
      role={onActivatePlayer === undefined ? 'list' : 'group'}
    >
      {rows.map((row, index) => (
        <div
          className="room-team-token-row"
          data-team-token-row-size={row.length}
          key={`row-${index}`}
          role="presentation"
        >
          {row}
        </div>
      ))}
    </div>
  )
}
