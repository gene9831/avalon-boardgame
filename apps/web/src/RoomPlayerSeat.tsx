import type { CSSProperties, ReactNode } from 'react'
import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Crown,
  HelpCircle,
  House,
  ShieldAlert,
  UsersRound,
} from 'lucide-react'
import type { PlayerID, TeamVote } from '@avalon/game'
import type { PlayerSeatLayout, Rect } from '@avalon/ui-layout'

import { PlayerAvatar } from './player-avatars'
import { RoleAvatar } from './RoleCard'
import { ROLE_LABELS } from './room-game'
import type {
  RoomPlayerInteractionMode,
  RoomPlayerModel,
} from './room-screen-model'

export interface RoomPlayerSeatProps {
  interactionMode: RoomPlayerInteractionMode
  layout: PlayerSeatLayout
  player: RoomPlayerModel
  disabled: boolean
  onActivate: (playerID: PlayerID) => void
}

function localRectStyle(rect: Rect, bounds: Rect): CSSProperties {
  return {
    left: rect.x - bounds.x,
    top: rect.y - bounds.y,
    width: rect.width,
    height: rect.height,
  }
}

function VoteStatusIcon({ status }: { status: 'pending' | TeamVote }) {
  if (status === 'approve') return <CircleCheck />
  if (status === 'reject') return <CircleX />
  return <BadgeCheck />
}

function RoomSeatDecorations({ player }: { player: RoomPlayerModel }) {
  return (
    <>
      {player.isOwner && (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="owner">
          <House />
        </span>
      )}
      {player.isLeader && (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="leader">
          <Crown />
        </span>
      )}
      {player.isQuestMember && (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="quest-member">
          <UsersRound />
        </span>
      )}
      {player.voteStatus !== null && (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="vote">
          <VoteStatusIcon status={player.voteStatus} />
        </span>
      )}
      {player.knownEvil && (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="known-evil">
          <ShieldAlert />
        </span>
      )}
      {player.knownMerlinCandidate && (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="merlin-candidate">
          <HelpCircle />
        </span>
      )}
    </>
  )
}

function actionLabel(
  interactionMode: RoomPlayerInteractionMode,
  player: RoomPlayerModel,
): string {
  const name = player.name || `${player.seatNumber} 号空座位`
  if (interactionMode === 'changeSeat') {
    return player.occupied ? `${player.seatNumber}. ${name}` : `移至 ${name}`
  }
  if (interactionMode === 'selectTeam') return `选择 ${name} 加入任务队伍`
  if (interactionMode === 'selectAssassinationTarget') {
    return `选择 ${name} 作为刺杀目标`
  }
  return `${player.seatNumber}. ${name}`
}

function playerStatuses(player: RoomPlayerModel): string[] {
  const voteStatus = player.voteStatus === 'approve'
    ? '赞成'
    : player.voteStatus === 'reject'
      ? '反对'
      : player.voteStatus === 'pending'
        ? '已投票'
        : null

  return [
    player.isLeader ? '队长' : null,
    player.isQuestMember ? '任务队员' : null,
    player.isOwner ? '房间拥有者' : null,
    player.occupied && !player.connected ? '已断线' : null,
    player.knownEvil ? '已知阵营信息：邪恶' : null,
    player.knownMerlinCandidate ? '梅林候选' : null,
    player.visibleRole === null ? null : ROLE_LABELS[player.visibleRole],
    voteStatus,
  ].filter((status): status is string => status !== null)
}

export function RoomPlayerSeat({
  interactionMode,
  layout,
  player,
  disabled,
  onActivate,
}: RoomPlayerSeatProps) {
  const interactive = interactionMode !== 'none'
  const accessibleLabel = [
    actionLabel(interactionMode, player),
    ...playerStatuses(player),
  ].join('，')
  const avatarStyle = localRectStyle(layout.avatarRect, layout.playerSeatBounds)
  const nameStyle = localRectStyle(layout.nameRect, layout.playerSeatBounds)
  const avatarState = player.isSelectedTarget
    ? 'target'
    : player.isSelected
      ? 'selected'
      : player.isQuestMember
        ? 'quest-member'
        : player.knownEvil
          ? 'known-evil'
          : player.isCurrentPlayer
            ? 'current-player'
            : 'default'
  const content: ReactNode = (
    <>
      <span
        className="room-seat__avatar absolute"
        data-avatar-state={avatarState}
        data-connected={player.connected}
        data-seat-pointer-target="avatar"
        id={player.isCurrentPlayer ? 'current-player-avatar' : undefined}
        style={avatarStyle}
      >
        {player.visibleRole === null
          ? <PlayerAvatar avatarID={player.avatarID} className="size-full object-contain p-[12%]" />
          : <RoleAvatar className="size-full object-cover" role={player.visibleRole} />}
      </span>
      <span
        className="room-seat__name absolute truncate"
        data-seat-pointer-target="name"
        style={nameStyle}
        title={`${player.seatNumber}. ${player.name || '空座位'}`}
      >
        {player.seatNumber}. {player.name || '空座位'}
      </span>
      <RoomSeatDecorations player={player} />
    </>
  )
  const commonProps = {
    'aria-label': accessibleLabel,
    className: 'room-seat relative size-full border-0 bg-transparent p-0 text-center',
    'data-player-id': player.playerID,
    'data-round-table-player': 'true',
  } as const

  return interactive ? (
    <button
      {...commonProps}
      aria-pressed={interactionMode === 'selectTeam'
        ? player.isSelected
        : interactionMode === 'selectAssassinationTarget'
          ? player.isSelectedTarget
          : undefined}
      disabled={disabled}
      onClick={() => onActivate(player.playerID)}
      type="button"
    >
      {content}
    </button>
  ) : (
    <div {...commonProps} role="group">{content}</div>
  )
}
