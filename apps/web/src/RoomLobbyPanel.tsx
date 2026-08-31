import { useState } from 'react'

import { ConnectionRecoveryControl } from './ConnectionRecoveryControl'
import type { LobbyPlayer } from './lobby'
import { PlayerAvatar } from './player-avatars'
import { PlayerProfileControl } from './PlayerProfileControl'
import type { PlayerProfile } from './player-profile'
import { RoomLogControl } from './RoomLogControl'
import type { RoomLogEntry } from './room-log'
import { buildRoundTableSeats, RoundTable, type RoundTableSeat } from './RoundTable'

export interface RoomLobbyPanelProps {
  canStart: boolean
  connected: boolean
  currentPlayerID: string
  manualReconnectAvailable: boolean
  logEntries: readonly RoomLogEntry[]
  matchID: string
  numPlayers: number
  occupiedPlayerIDs: readonly string[]
  ownerPlayerID: string | null
  onBackHome: () => void
  onChangeSeat: (targetPlayerID: string) => void
  onReconnect: () => void
  onRequestRoomExit: () => void
  onStart: () => void
  onSaveProfile: (profile: PlayerProfile) => void
  players: readonly LobbyPlayer[]
  profile: PlayerProfile
  roomExitBusy: boolean
  seatChangePending: boolean
}

export function RoomLobbyPanel({
  canStart,
  connected,
  currentPlayerID,
  manualReconnectAvailable,
  logEntries,
  matchID,
  numPlayers,
  occupiedPlayerIDs,
  ownerPlayerID,
  onBackHome,
  onChangeSeat,
  onReconnect,
  onRequestRoomExit,
  onStart,
  onSaveProfile,
  players,
  profile,
  roomExitBusy,
  seatChangePending,
}: RoomLobbyPanelProps) {
  const seats = buildRoundTableSeats(players, numPlayers, currentPlayerID, ownerPlayerID)
  const [roomMenuOpen, setRoomMenuOpen] = useState(false)
  const isFull = occupiedPlayerIDs.length === numPlayers
  const isOwner = currentPlayerID === ownerPlayerID

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-2.5 shadow-2xl shadow-black/20 backdrop-blur sm:p-3 lg:p-4">
      <header className="round-table-header flex shrink-0 items-center justify-between gap-2 px-1 pb-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            aria-label="返回主页"
            className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-white/15 text-lg font-medium text-slate-200 transition hover:border-amber-300/60 hover:text-white"
            onClick={onBackHome}
            type="button"
          >
            <span aria-hidden="true">←</span>
          </button>
          <div className="min-w-0">
            <p className="round-table-header-decoration text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-300 sm:text-xs">等待玩家</p>
            <h1 className="truncate text-sm font-semibold text-white sm:mt-0.5 sm:text-xl">房间 {matchID}</h1>
          </div>
        </div>
        <div className="mr-12 flex shrink-0 items-center gap-2">
          <ConnectionRecoveryControl connected={connected} manualReconnectAvailable={manualReconnectAvailable} onReconnect={onReconnect} />
          <RoomLogControl entries={logEntries} />
          <PlayerProfileControl locked onSave={onSaveProfile} profile={profile} />
          {connected && <div className="relative">
            <button
              aria-expanded={roomMenuOpen}
              aria-label="房间操作"
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/15 text-xl leading-none text-slate-200 transition hover:border-amber-300/60 hover:text-white"
              onClick={() => setRoomMenuOpen((open) => !open)}
              type="button"
            >
              <span aria-hidden="true">⋯</span>
            </button>
            <div className={`${roomMenuOpen ? 'block' : 'hidden'} absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-32 rounded-xl border border-white/15 bg-slate-950/95 p-1.5 shadow-2xl`}>
              <button className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={roomExitBusy || seatChangePending} onClick={onRequestRoomExit} type="button">
                {roomExitBusy ? (isOwner ? '正在解散…' : '正在退出…') : isOwner ? '解散房间' : '退出房间'}
              </button>
            </div>
          </div>}
        </div>
      </header>

      <div className="round-table-stage flex min-h-0 flex-1 items-center justify-center py-1">
        <RoundTable
          ariaLabel={`${numPlayers} 人玩家圆桌`}
          center={(
            <div className="flex flex-col items-center text-center">
              <p className="lobby-center-decoration text-[clamp(0.65rem,2vw,0.9rem)] font-semibold text-amber-200">圆桌已就绪</p>
              <p className="lobby-center-count mt-1 text-[clamp(1.35rem,6vw,3rem)] font-semibold text-white">{occupiedPlayerIDs.length} / {numPlayers}</p>
              <p className="lobby-center-decoration text-[clamp(0.6rem,1.7vw,0.8rem)] text-slate-400">位玩家已入席</p>
              {!isFull && <p className="lobby-center-action mt-2 text-[clamp(0.65rem,2vw,0.85rem)] font-semibold text-amber-100"><span className="lobby-center-full-label">还差 {numPlayers - occupiedPlayerIDs.length} 人</span><span className="lobby-center-compact-label">差 {numPlayers - occupiedPlayerIDs.length} 人</span></p>}
              {isFull && isOwner && (
                <button
                  className="lobby-center-action mt-2 min-h-11 rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canStart || roomExitBusy}
                  onClick={onStart}
                  type="button"
                >
                  开始游戏
                </button>
              )}
              {isFull && !isOwner && (
                <p aria-label="等待房间创建者开始游戏" className="lobby-center-action mt-2 text-[clamp(0.65rem,2vw,0.85rem)] font-semibold text-amber-100" role="status">
                  <span aria-hidden="true" className="lobby-center-full-label">等待房间创建者开始游戏</span>
                  <span aria-hidden="true" className="lobby-center-compact-label">等待创建者</span>
                </p>
              )}
            </div>
          )}
          renderSeat={(seat) => <SeatCard dense={numPlayers >= 7} onChangeSeat={onChangeSeat} seat={seat} seatChangePending={seatChangePending} />}
          seats={seats}
        />
      </div>
    </section>
  )
}

function SeatCard({
  dense,
  onChangeSeat,
  seat,
  seatChangePending,
}: {
  dense: boolean
  onChangeSeat: (targetPlayerID: string) => void
  seat: RoundTableSeat
  seatChangePending: boolean
}) {
  const seatStates = [
    seat.isCurrentPlayer ? '这是你' : null,
    seat.occupied && !seat.connected ? '已断线' : null,
  ].filter((state): state is string => state !== null)
  if (!seat.occupied) {
    return (
      <button
        aria-label={`移至 ${seat.seatNumber} 号空座位`}
        className={`seat seat--empty pointer-events-auto flex min-h-11 min-w-11 flex-col items-center ${dense ? 'w-[clamp(3.1rem,14vw,6.5rem)]' : 'w-[clamp(4.2rem,17vw,8rem)]'}`}
        data-player-id={seat.playerID}
        disabled={seatChangePending || seat.isCurrentPlayer}
        onClick={() => onChangeSeat(seat.playerID)}
        type="button"
      >
        <span aria-hidden="true" className={`${dense ? 'size-[clamp(2.5rem,9.5vw,4.5rem)]' : 'size-[clamp(3rem,12vw,5.5rem)]'} grid shrink-0 place-items-center rounded-full border-2 border-dashed border-slate-500/70 bg-slate-950/70 text-[clamp(0.9rem,4vw,1.8rem)] font-semibold text-slate-500`} data-round-table-avatar>空座位</span>
        <span className="mt-1 w-full rounded-md border border-dashed border-white/20 bg-slate-950/75 px-1.5 py-0.5 text-center text-[clamp(0.58rem,2.4vw,0.8rem)] font-medium text-white" data-label-placement={seat.labelPlacement} data-round-table-nameplate> {seat.seatNumber}. 空座位</span>
      </button>
    )
  }

  const accessibleName = `${seat.seatNumber}. ${seat.name}${seatStates.length > 0 ? `，${seatStates.join('，')}` : ''}`

  return (
    <div aria-label={accessibleName} className={`pointer-events-auto flex flex-col items-center ${dense ? 'w-[clamp(3.1rem,14vw,6.5rem)]' : 'w-[clamp(4.2rem,17vw,8rem)]'}`} data-player-id={seat.playerID} data-round-table-player role="group">
      <div className="relative"
      >
      {seat.isOwner && <OwnerBadge />}
      <div
        aria-hidden="true"
        className={`${dense ? 'size-[clamp(2.5rem,9.5vw,4.5rem)]' : 'size-[clamp(3rem,12vw,5.5rem)]'} grid shrink-0 place-items-center overflow-hidden rounded-full border-2 text-[clamp(0.9rem,4vw,1.8rem)] font-semibold shadow-lg ${seat.isCurrentPlayer ? 'border-amber-200 bg-[#efe3c6] text-amber-50 shadow-amber-300/20' : seat.occupied ? 'border-[#d8c69f]/70 bg-[#efe3c6] text-slate-900' : 'border-dashed border-slate-500/70 bg-slate-950/70 text-slate-500'} ${seat.occupied && !seat.connected ? 'grayscale opacity-45' : ''}`}
        data-round-table-avatar
      >
        {seat.occupied ? (
          <PlayerAvatar avatarID={seat.avatarID} className="size-full object-contain p-[12%]" />
        ) : seat.seatNumber}
      </div></div>
      <div className={`mt-1 w-full rounded-md border px-1.5 py-0.5 text-center shadow-lg ${seat.isCurrentPlayer ? 'border-amber-200/70 bg-amber-950/90' : seat.occupied ? 'border-white/15 bg-slate-950/90' : 'border-dashed border-white/20 bg-slate-950/75'}`} data-label-placement={seat.labelPlacement} data-round-table-nameplate title={`${seat.seatNumber}. ${seat.name}`}>
        <p className="truncate text-[clamp(0.58rem,2.4vw,0.8rem)] font-medium text-white">
          {seat.seatNumber}. {seat.name}
        </p>
      </div>
    </div>
  )
}

function OwnerBadge() {
  return <span aria-label="房间拥有者" className="seat-owner-badge absolute -left-1 -top-1 z-20 grid size-5 place-items-center rounded-full bg-amber-300 text-xs text-slate-950 shadow-lg">⌂</span>
}
