import type { CSSProperties, ReactNode } from 'react'
import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Crosshair,
  Crown,
  HelpCircle,
  House,
  LoaderCircle,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import { loyaltyForRole, type Role, type TeamVote } from '@avalon/game'
import type { PlayerSeatLayout, Rect } from '@avalon/ui-layout'

import { PlayerAvatar } from './player-avatars'
import { RoleAvatar } from './RoleCard'
import { ROLE_LABELS } from './room-game'
import type {
  RoomPlayerCaption,
  RoomPlayerInteraction,
  RoomPlayerMarker,
  RoomPlayerPortrait,
  RoomPlayerPresentation,
} from './room-screen-props'

const SHORT_ROLE_LABELS: Readonly<Record<Role, string>> = {
  assassin: '刺客', loyal_servant: '忠臣', merlin: '梅林', minion: '爪牙',
  morgana: '莫甘娜', percival: '帕西维尔',
}

export interface RoomPlayerSeatProps {
  layout: PlayerSeatLayout
  player: RoomPlayerPresentation
  onActivate: () => void
}

function assertNever(value: never): never {
  throw new Error(`Unexpected room player variant: ${JSON.stringify(value)}`)
}

function localRectStyle(rect: Rect, bounds: Rect): CSSProperties {
  return {
    left: rect.x - bounds.x,
    top: rect.y - bounds.y,
    width: rect.width,
    height: rect.height,
  }
}

type NameplateSize = 'short' | 'medium' | 'max'

function nameplateSize(label: string, hasOwnerIcon: boolean, seatNumber: number | null): NameplateSize {
  const visualLength = Array.from(label.replace(/\s/g, '')).length +
    (hasOwnerIcon ? 1 : 0) +
    (seatNumber === null ? 0 : String(seatNumber).length)
  if (visualLength <= 4) return 'short'
  if (visualLength <= 7) return 'medium'
  return 'max'
}

function localNameStyle(rect: Rect, bounds: Rect, size: NameplateSize): CSSProperties {
  const targetWidth = size === 'short' ? 64 : size === 'medium' ? 88 : rect.width
  const width = Math.min(targetWidth, rect.width)
  return {
    left: rect.x - bounds.x + (rect.width - width) / 2,
    top: rect.y - bounds.y,
    width,
    height: rect.height,
  }
}

function localRoleStyle(rect: Rect, bounds: Rect): CSSProperties {
  return {
    left: rect.x - bounds.x + rect.width / 2,
    top: rect.y - bounds.y + rect.height + 2,
    maxWidth: rect.width,
  }
}

function VoteStatusIcon({ status }: { status: 'pending' | TeamVote }) {
  if (status === 'approve') return <CircleCheck />
  if (status === 'reject') return <CircleX />
  return <BadgeCheck />
}

function RoomOwnerIcon() {
  return (
    <span aria-hidden="true" className="room-seat__owner-icon" data-seat-decoration="owner">
      <House />
    </span>
  )
}

function markerStatus(marker: RoomPlayerMarker): string {
  switch (marker.kind) {
    case 'owner': return '房间拥有者'
    case 'leader': return '队长'
    case 'questMember': return '任务队员'
    case 'vote':
      return marker.status === 'approve' ? '赞成' : marker.status === 'reject' ? '反对' : '已投票'
    case 'knownEvil': return '已知阵营信息：邪恶'
    case 'assassinationTarget': return '刺杀目标'
    case 'merlinCandidate': return '梅林候选'
    default: return assertNever(marker)
  }
}

function markerDecoration(marker: RoomPlayerMarker, index: number): ReactNode {
  switch (marker.kind) {
    case 'owner':
      return null
    case 'leader':
      return (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="leader" key={`${marker.kind}-${index}`}>
          <Crown fill="currentColor" stroke="#f8fafc" strokeWidth={1.5} />
        </span>
      )
    case 'questMember':
      return (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="quest-member" key={`${marker.kind}-${index}`}>
          <UserRound />
        </span>
      )
    case 'vote':
      return (
        <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="vote" key={`${marker.kind}-${index}`}>
          <VoteStatusIcon status={marker.status} />
        </span>
      )
    case 'knownEvil':
      return (
        <span aria-label="已知邪恶阵营" className="room-seat__decoration" data-known-player-info="evil" data-seat-decoration="known-evil" key={`${marker.kind}-${index}`}>
          <ShieldAlert />
        </span>
      )
    case 'assassinationTarget':
      return (
        <span aria-label="刺杀目标" className="room-seat__decoration" data-seat-decoration="assassination-target" key={`${marker.kind}-${index}`}>
          <Crosshair />
        </span>
      )
    case 'merlinCandidate':
      return (
        <span aria-label="Merlin 候选" className="room-seat__decoration" data-known-player-info="merlin-candidate" data-seat-decoration="merlin-candidate" key={`${marker.kind}-${index}`}>
          <HelpCircle />
        </span>
      )
    default:
      return assertNever(marker)
  }
}

function interactionPresentation(
  interaction: RoomPlayerInteraction,
  player: RoomPlayerPresentation,
): Readonly<{
  actionLabel: string
  canActivate: boolean
  pending: boolean
  pressed: boolean | undefined
}> {
  const name = player.name || `${player.seatNumber} 号空座位`
  switch (interaction.kind) {
    case 'none':
      return {
        actionLabel: `${player.seatNumber}. ${name}`,
        canActivate: false,
        pending: false,
        pressed: undefined,
      }
    case 'changeSeat':
      return {
        actionLabel: player.occupied
          ? `${player.seatNumber}. ${name}`
          : interaction.pending ? `正在移至 ${name}` : `移至 ${name}`,
        canActivate: !interaction.disabled,
        pending: interaction.pending,
        pressed: undefined,
      }
    case 'selectTeam':
      return {
        actionLabel: interaction.selected
          ? `取消选择 ${name}`
          : `选择 ${name} 加入任务队伍`,
        canActivate: !interaction.disabled,
        pending: false,
        pressed: interaction.selected,
      }
    case 'selectAssassinationTarget':
      return {
        actionLabel: `选择 ${name} 作为刺杀目标`,
        canActivate: !interaction.disabled,
        pending: false,
        pressed: interaction.selected,
      }
    default:
      return assertNever(interaction)
  }
}

function portraitContent(portrait: RoomPlayerPortrait): ReactNode {
  switch (portrait.kind) {
    case 'playerAvatar':
      return <PlayerAvatar avatarID={portrait.avatarID} className="size-full object-contain p-[12%]" />
    case 'roleArtwork':
      return <RoleAvatar className="size-full object-cover" role={portrait.role} />
    default:
      return assertNever(portrait)
  }
}

function captionContent(caption: RoomPlayerCaption, style: CSSProperties): ReactNode {
  switch (caption.kind) {
    case 'none':
      return null
    case 'role': {
      const loyalty = loyaltyForRole(caption.role)
      return (
        <span
          className="room-seat__role-label"
          data-room-role-revealed="true"
          data-role-loyalty={loyalty}
          style={style}
        >
          {SHORT_ROLE_LABELS[caption.role]}
        </span>
      )
    }
    case 'recognition':
      return (
        <span
          className="room-seat__recognition-label"
          data-identity-recognition-label="true"
          data-recognition-tone={caption.tone}
          style={style}
        >
          {caption.label}
        </span>
      )
    default:
      return assertNever(caption)
  }
}

function avatarState(player: RoomPlayerPresentation): string {
  if (player.caption.kind === 'role') {
    return `revealed-${loyaltyForRole(player.caption.role)}`
  }
  switch (player.emphasis) {
    case 'target': return 'target'
    case 'selected': return 'selected'
    case 'questMember': return 'quest-member'
    case 'knownEvil': return 'known-evil'
    case 'default':
    case 'dimmed':
      return 'default'
    default:
      return assertNever(player.emphasis)
  }
}

function portraitRole(portrait: RoomPlayerPortrait): Role | null {
  switch (portrait.kind) {
    case 'playerAvatar': return null
    case 'roleArtwork': return portrait.role
    default: return assertNever(portrait)
  }
}

export function RoomPlayerSeat({ layout, player, onActivate }: RoomPlayerSeatProps) {
  const interaction = interactionPresentation(player.interaction, player)
  const avatarStyle = localRectStyle(layout.avatarRect, layout.playerSeatBounds)
  const visibleName = player.occupied ? player.name : interaction.pending ? '换座中' : '空位'
  const owner = player.markers.some((marker) => marker.kind === 'owner')
  const nameSize = nameplateSize(visibleName, owner, player.occupied ? player.seatNumber : null)
  const nameStyle = localNameStyle(layout.nameRect, layout.playerSeatBounds, nameSize)
  const roleStyle = localRoleStyle(layout.nameRect, layout.playerSeatBounds)
  const role = portraitRole(player.portrait)
  const connected = player.portrait.kind === 'playerAvatar' && player.portrait.connected
  const recognitionState = player.emphasis === 'dimmed'
    ? 'dimmed'
    : player.caption.kind === 'recognition'
      ? player.caption.tone === 'self' ? 'self' : 'target'
      : undefined
  const selected = player.interaction.kind === 'selectTeam' && player.interaction.selected
  const statuses = [
    ...player.markers.map(markerStatus),
    player.isCurrentPlayer ? '当前玩家' : null,
    player.occupied && player.portrait.kind === 'playerAvatar' && !player.portrait.connected ? '已断线' : null,
    role === null ? null : ROLE_LABELS[role],
    player.caption.kind === 'recognition' ? player.caption.label : null,
  ].filter((status): status is string => status !== null)
  const accessibleLabel = [interaction.actionLabel, ...statuses].join('，')
  const content: ReactNode = (
    <>
      {player.occupied ? (
        <span
          className="room-seat__avatar absolute"
          data-avatar-state={avatarState(player)}
          data-room-role-revealed={player.caption.kind === 'role' ? 'true' : undefined}
          data-round-table-avatar="true"
          data-seat-pointer-target="avatar"
          data-seat-state="occupied"
          id={player.isCurrentPlayer ? 'current-player-avatar' : undefined}
          style={avatarStyle}
        >
          <span
            className="room-seat__portrait"
            data-seat-portrait-connected={player.portrait.kind === 'playerAvatar' ? connected : undefined}
          >
            {portraitContent(player.portrait)}
          </span>
          {player.portrait.kind === 'playerAvatar' && !player.portrait.connected && (
            <span className="room-seat__disconnected" data-seat-disconnected-badge="true">掉线</span>
          )}
        </span>
      ) : (
        <span
          className="room-seat__avatar room-seat__avatar--empty absolute"
          data-round-table-avatar="true"
          data-seat-pointer-target="avatar"
          data-seat-state={interaction.pending ? 'pending' : 'empty'}
          style={avatarStyle}
        >
          {interaction.pending
            ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
            : player.seatNumber}
        </span>
      )}
      <span
        className="room-seat__name absolute"
        data-nameplate-emphasis={player.emphasis === 'selected' || player.emphasis === 'questMember' ? 'cyan' : undefined}
        data-nameplate-size={nameSize}
        data-round-table-nameplate="true"
        data-seat-pointer-target="name"
        style={nameStyle}
        title={player.occupied ? player.name : `${player.seatNumber} 号空座位`}
      >
        {player.occupied && (
          <span aria-hidden="true" className="room-seat__seat-number" data-seat-number="true">
            {player.seatNumber}
          </span>
        )}
        {owner && <RoomOwnerIcon />}
        <span className="min-w-0 truncate">{visibleName}</span>
      </span>
      {captionContent(player.caption, roleStyle)}
      <span className="room-seat__decorations absolute" style={avatarStyle}>
        {selected && (
          <span aria-hidden="true" className="room-seat__decoration" data-seat-decoration="selected">
            <CircleCheck fill="#0f172a" />
          </span>
        )}
        {player.markers.map(markerDecoration)}
      </span>
    </>
  )
  const commonProps = {
    'aria-label': accessibleLabel,
    className: 'room-seat relative size-full border-0 bg-transparent p-0 text-center',
    'data-player-id': player.playerID,
    'data-recognition-seat-state': recognitionState,
    'data-recognition-tone': player.caption.kind === 'recognition' ? player.caption.tone : undefined,
    'data-round-table-player': 'true',
  } as const

  return interaction.canActivate ? (
    <button
      {...commonProps}
      aria-pressed={interaction.pressed}
      onClick={onActivate}
      type="button"
    >
      {content}
    </button>
  ) : (
    <div {...commonProps} role="group">{content}</div>
  )
}
