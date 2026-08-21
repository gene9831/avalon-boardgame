import type { CSSProperties } from 'react'

import type { LobbyPlayer } from './lobby'

export interface RoundTableSeat {
  playerID: string
  seatNumber: number
  name: string
  occupied: boolean
  connected: boolean
  isCurrentPlayer: boolean
  left: number
  top: number
}

export interface RoomLobbyPanelProps {
  canStart: boolean
  connected: boolean
  currentPlayerID: string
  matchID: string
  numPlayers: number
  occupiedPlayerIDs: readonly string[]
  onBackHome: () => void
  onReconnect: () => void
  onRequestRoomExit: () => void
  onStart: () => void
  players: readonly LobbyPlayer[]
  roomExitBusy: boolean
}

// oxlint-disable-next-line react/only-export-components
export function buildRoundTableSeats(
  players: readonly LobbyPlayer[],
  numPlayers: number,
  viewerPlayerID: string,
): RoundTableSeat[] {
  const viewerIndex = Number(viewerPlayerID)

  return Array.from({ length: numPlayers }, (_, index) => {
    const player = players.find(({ id }) => id === index)
    const occupied = player?.name !== undefined && player.name !== null
    const relativeIndex = (index - viewerIndex + numPlayers) % numPlayers
    const angle = (90 + relativeIndex * (360 / numPlayers)) * Math.PI / 180

    return {
      playerID: String(index),
      seatNumber: index + 1,
      name: occupied ? player.name! : '等待玩家加入',
      occupied,
      connected: occupied && player?.isConnected === true,
      isCurrentPlayer: String(index) === viewerPlayerID,
      left: Math.round((50 + 43 * Math.cos(angle)) * 100) / 100,
      top: Math.round((50 + 40 * Math.sin(angle)) * 100) / 100,
    }
  })
}

export function RoomLobbyPanel({
  canStart,
  connected,
  currentPlayerID,
  matchID,
  numPlayers,
  occupiedPlayerIDs,
  onBackHome,
  onReconnect,
  onRequestRoomExit,
  onStart,
  players,
  roomExitBusy,
}: RoomLobbyPanelProps) {
  const seats = buildRoundTableSeats(players, numPlayers, currentPlayerID)
  const isFull = occupiedPlayerIDs.length === numPlayers
  const isHost = currentPlayerID === '0'
  const actionLabel = !isFull
    ? `还差 ${numPlayers - occupiedPlayerIDs.length} 人`
    : isHost
      ? '开始游戏'
      : '等待房主开始'

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/20 backdrop-blur sm:p-4 lg:p-5">
      <div className="flex shrink-0 items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="lobby-kicker text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Round table lobby</p>
          <h1 className="mt-1 truncate text-lg font-semibold text-white sm:text-2xl">围坐圆桌，等待开局</h1>
          <p className="mt-0.5 truncate font-mono text-xs text-slate-400 sm:text-sm">房间 {matchID}</p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            aria-label="返回主页"
            className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-300/60 hover:text-white"
            onClick={onBackHome}
            type="button"
          >
            <span aria-hidden="true" className="sm:hidden">←</span>
            <span className="hidden sm:inline">返回主页</span>
          </button>
          <ConnectionBadge connected={connected} />
        </div>
      </div>

      <div className="mt-3 hidden min-h-0 flex-1 lg:block">
        <div className="relative h-full overflow-hidden rounded-3xl border border-amber-300/15 bg-slate-950/35">
          <div className="absolute left-1/2 top-1/2 h-[60%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-amber-300/25 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.2),_rgba(15,23,42,0.72)_70%)] shadow-[0_0_70px_rgba(245,158,11,0.12)]" />
          <div className="absolute left-1/2 top-1/2 z-10 w-60 -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="text-sm font-semibold text-amber-200">圆桌已就绪</p>
            <p className="mt-2 text-3xl font-semibold text-white">{occupiedPlayerIDs.length} / {numPlayers}</p>
            <p className="mt-1 text-sm text-slate-400">位玩家已入席</p>
          </div>
          <div className="absolute inset-x-24 inset-y-0 z-20">
            {seats.map((seat) => <SeatCard className="absolute w-44" key={seat.playerID} seat={seat} style={{ left: `${seat.left}%`, top: `${seat.top}%`, transform: 'translate(-50%, -50%)' }} />)}
          </div>
        </div>
      </div>

      <div
        className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2 lg:hidden"
        style={{ gridTemplateRows: `repeat(${Math.ceil(numPlayers / 2)}, minmax(0, 1fr))` }}
      >
        {seats.map((seat) => <SeatCard className="h-full min-h-0 overflow-hidden" compact key={seat.playerID} seat={seat} />)}
      </div>

      <section className="mt-3 shrink-0 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-100">{occupiedPlayerIDs.length} / {numPlayers} 位玩家已入席</p>
            <p className="lobby-action-copy mt-0.5 truncate text-xs text-slate-300 sm:text-sm">{isFull ? (isHost ? '所有人已到齐，由你开始游戏。' : '所有人已到齐，等待房主开始。') : '请其他玩家打开局域网主页，选择此房间加入。'}</p>
          </div>
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:w-auto">
            <button
              className="min-h-11 rounded-xl bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
              disabled={!canStart || roomExitBusy}
              onClick={onStart}
              type="button"
            >
              {actionLabel}
            </button>
            <button className="min-h-11 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={roomExitBusy} onClick={onReconnect} type="button">重连</button>
            <button className="min-h-11 rounded-xl border border-rose-300/30 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300/70 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={roomExitBusy} onClick={onRequestRoomExit} type="button">
              {roomExitBusy ? (isHost ? '正在解散…' : '正在退出…') : isHost ? '解散房间' : '退出房间'}
            </button>
          </div>
        </div>
      </section>
    </section>
  )
}

function SeatCard({
  className,
  compact = false,
  seat,
  style,
}: {
  className: string
  compact?: boolean
  seat: RoundTableSeat
  style?: CSSProperties
}) {
  return (
    <div className={`${className} rounded-2xl border ${compact ? 'p-2 sm:p-3' : 'p-3'} ${seat.isCurrentPlayer ? 'border-amber-300/70 bg-amber-300/15' : seat.occupied ? 'border-white/10 bg-slate-950/70' : 'border-dashed border-white/15 bg-slate-950/30'}`} style={style}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-slate-500">座位 {seat.seatNumber}</span>
        {seat.isCurrentPlayer && <span className="text-xs font-semibold text-amber-300">这是你</span>}
      </div>
      <p className={`${compact ? 'mt-1 text-sm' : 'mt-2'} truncate font-medium text-white`}>{seat.name}</p>
      <p className="lobby-seat-status mt-0.5 text-xs text-slate-400">{seat.connected ? '已连接' : seat.occupied ? '等待连接' : '空座位'}</p>
    </div>
  )
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${connected ? 'bg-cyan-300/15 text-cyan-200' : 'bg-rose-300/15 text-rose-200'}`}>
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-cyan-300' : 'bg-rose-300'}`} />
      {connected ? '已连接' : '连接中断'}
    </span>
  )
}
