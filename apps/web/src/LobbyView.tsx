import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import type {
  AvalonRoomStatus,
  AvalonRoomSummary,
} from '@avalon/game'

import { LobbyDevTools } from './LobbyDevTools'
import { PlayerProfileControl } from './PlayerProfileControl'
import type { PlayerProfile } from './player-profile'
import type { RoomSession } from './room-session'
import {
  canJoinRoom,
  getOccupiedRoomPlayerIDs,
  getRoomPlayerCount,
  paginateRooms,
} from './room-directory'

export interface LobbyViewProps {
  activeRoomSessions: RoomSession[]
  busy: boolean
  devToken: string
  devToolsEnabled: boolean
  devToolsError: string | null
  matches: AvalonRoomSummary[]
  onCreate: () => void
  onDeleteRoom: (matchID: string) => Promise<void>
  onDevTokenChange: (value: string) => void
  onEnterRoom: (matchID: string) => void
  onJoin: (matchID: string, playerID: string) => void
  onRefresh: () => void
  onSaveProfile: (profile: PlayerProfile) => void
  profile: PlayerProfile
  roomAccessLocked: boolean
  roomAccessPending: boolean
  roomAccessUnavailable: boolean
  selectedSeats: Record<string, string>
  setSelectedSeats: Dispatch<SetStateAction<Record<string, string>>>
}

type RoomSectionKey = 'active' | 'finished'

interface RoomSection {
  key: RoomSectionKey
  statuses: AvalonRoomStatus[]
  title: string
  empty: string
}

const sections: RoomSection[] = [
  {
    key: 'active',
    statuses: ['lobby', 'playing'],
    title: '进行中的圆桌',
    empty: '当前没有进行中的房间。你可以先创建一局。',
  },
  {
    key: 'finished',
    statuses: ['finished'],
    title: '已结束的对局',
    empty: '当前没有已结束的房间。',
  },
]

const lobbyButtonBase = 'inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40'
const createButton = `${lobbyButtonBase} bg-amber-300 text-slate-950 hover:bg-amber-200 focus-visible:ring-amber-300`
const joinButton = `${lobbyButtonBase} bg-cyan-300 text-slate-950 hover:bg-cyan-200 focus-visible:ring-cyan-300`
const enterButton = `${lobbyButtonBase} bg-emerald-300 text-slate-950 hover:bg-emerald-200 focus-visible:ring-emerald-300`
const neutralButton = `${lobbyButtonBase} border border-white/15 bg-slate-900/40 text-slate-200 hover:border-slate-300/50 hover:bg-slate-800/70 hover:text-white focus-visible:ring-slate-300`
const neutralIconButton = 'grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-slate-900/40 text-slate-200 transition-colors hover:border-slate-300/50 hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'

function roomStatusLabel(status: AvalonRoomStatus) {
  if (status === 'lobby') return '等待中'
  if (status === 'playing') return '进行中'
  return '已结束'
}

export function LobbyView({
  activeRoomSessions,
  busy,
  devToken,
  devToolsEnabled,
  devToolsError,
  matches,
  onCreate,
  onDeleteRoom,
  onDevTokenChange,
  onEnterRoom,
  onJoin,
  onRefresh,
  onSaveProfile,
  profile,
  roomAccessLocked,
  roomAccessPending,
  roomAccessUnavailable,
  selectedSeats,
  setSelectedSeats,
}: LobbyViewProps) {
  const activeRoomMatchIDs = new Set(activeRoomSessions.map(({ matchID }) => matchID))
  const roomAccessMessage = roomAccessPending
    ? '正在确认房间状态'
    : roomAccessUnavailable
      ? '暂时无法确认房间状态'
      : '请先完成当前房间'
  const [pages, setPages] = useState<Record<RoomSectionKey, number>>({
    active: 1,
    finished: 1,
  })

  useEffect(() => {
    setPages((current) => {
      const next = { ...current }
      for (const section of sections) {
        const count = matches.filter((room) => section.statuses.includes(room.status)).length
        next[section.key] = paginateRooms(
          Array.from({ length: count }),
          current[section.key],
        ).page
      }
      return next
    })
  }, [matches])

  const renderRoom = (room: AvalonRoomSummary) => {
    const activeSession = activeRoomSessions.find(({ matchID }) => matchID === room.matchID)
    const occupiedPlayerIDs = getOccupiedRoomPlayerIDs(room)
    const occupied = occupiedPlayerIDs.length
    const playerCount = getRoomPlayerCount(room)
    const availableSeats = Array.from({ length: playerCount }, (_, index) => String(index))
      .filter((playerID) => !occupiedPlayerIDs.includes(playerID))
    const selectedSeat = selectedSeats[room.matchID] ?? availableSeats[0] ?? ''

    return (
      <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5" key={room.matchID}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-mono text-sm font-semibold text-slate-100">房间 {room.matchID}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${room.status === 'lobby' ? 'bg-amber-300/15 text-amber-200' : room.status === 'playing' ? 'bg-cyan-300/15 text-cyan-200' : 'bg-slate-700/70 text-slate-300'}`}>
                {roomStatusLabel(room.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{roomStatusLabel(room.status)} · {occupied} / {playerCount} 人已入座</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeSession !== undefined ? (
              <button className={enterButton} onClick={() => onEnterRoom(room.matchID)} type="button">进入</button>
            ) : canJoinRoom(room) && roomAccessLocked ? (
              <span className="rounded-full bg-slate-700/70 px-3 py-2 text-xs text-slate-300">{roomAccessMessage}</span>
            ) : canJoinRoom(room) && (availableSeats.length === 0 ? (
              <span className="rounded-full bg-slate-700/70 px-3 py-2 text-xs text-slate-300">已满</span>
            ) : (
              <>
                <select
                  aria-label={`选择 ${room.matchID} 的座位`}
                  className="min-h-11 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
                  onChange={(event) => setSelectedSeats((previous) => ({ ...previous, [room.matchID]: event.target.value }))}
                  value={selectedSeat}
                >
                  {availableSeats.map((seatID) => <option key={seatID} value={seatID}>座位 {Number(seatID) + 1}</option>)}
                </select>
                <button className={joinButton} disabled={busy || selectedSeat === ''} onClick={() => onJoin(room.matchID, selectedSeat)} type="button">加入</button>
              </>
            ))}
            {room.status === 'finished' && <button className={neutralButton} disabled type="button">回放（即将支持）</button>}
            {devToolsEnabled && devToken.length > 0 && <button className="rounded-xl border border-rose-300/40 px-4 py-2.5 text-sm text-rose-200 transition hover:border-rose-300 hover:bg-rose-300/10" onClick={() => void onDeleteRoom(room.matchID)} type="button">删除</button>}
          </div>
        </div>
      </article>
    )
  }

  const renderSection = (
    section: RoomSection,
    { secondary = false, showHeading = true } = {},
  ) => {
    const sectionRooms = matches
      .filter((room) => section.statuses.includes(room.status))
      .sort((left, right) => Number(activeRoomMatchIDs.has(right.matchID)) - Number(activeRoomMatchIDs.has(left.matchID)))
    const page = paginateRooms(sectionRooms, pages[section.key])
    return (
      <section className={secondary ? 'border-t border-white/10 pt-7' : ''} key={section.key}>
        {showHeading && <h2 className={secondary ? 'text-lg font-semibold text-slate-300' : 'text-2xl font-semibold text-white'}>{section.title}</h2>}
        {sectionRooms.length === 0 ? <div className={`${showHeading ? 'mt-4' : ''} rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-400`}>{section.empty}</div> : <>
          <div className={`${showHeading ? 'mt-4' : ''} space-y-3`}>{page.items.map(renderRoom)}</div>
          {page.pageCount > 1 && <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <button className={neutralButton} disabled={page.page === 1} onClick={() => setPages((current) => ({ ...current, [section.key]: page.page - 1 }))} type="button">上一页</button>
            <span>{page.page} / {page.pageCount}</span>
            <button className={neutralButton} disabled={page.page === page.pageCount} onClick={() => setPages((current) => ({ ...current, [section.key]: page.page + 1 }))} type="button">下一页</button>
          </div>}
        </>}
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_35%)] px-4 py-6 text-slate-200 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-start justify-between gap-4 sm:mb-10">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">局域网阿瓦隆</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-6xl">今晚，谁值得信任？</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">在同一个局域网内创建圆桌、选择座位并开始一局阿瓦隆。角色与秘密始终由服务器守护。</p>
          </div>
          <PlayerProfileControl locked={roomAccessLocked} onSave={onSaveProfile} profile={profile} />
        </header>

        <section className="flex items-center justify-between gap-4 rounded-3xl border border-amber-300/20 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:gap-6 sm:p-7">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white sm:text-xl">创建新的圆桌</h2>
            <p className="mt-1 text-sm text-slate-400">选择人数并确认本局配置后创建房间。</p>
          </div>
          <div className="text-right">
            <button className={createButton} disabled={busy || roomAccessLocked} onClick={onCreate} type="button">{busy ? '处理中…' : '创建房间'}</button>
            {roomAccessLocked && <p className="mt-2 text-xs text-slate-400">{roomAccessMessage}</p>}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold text-white">进行中的圆桌</h2><p className="mt-1 text-sm text-slate-400">包含等待开局和游戏中的房间 · 每 3 秒自动更新</p></div><button aria-label="刷新房间列表" className={neutralIconButton} onClick={onRefresh} title="刷新房间列表" type="button"><svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 2 5.5M20 4v7h-7" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>
          <div className="mt-6">{renderSection(sections[0], { showHeading: false })}</div>
          <div className="mt-8">{renderSection(sections[1], { secondary: true })}</div>
        </section>

        <LobbyDevTools
          enabled={devToolsEnabled}
          error={devToolsError}
          onTokenChange={onDevTokenChange}
          token={devToken}
        />
      </div>
    </main>
  )
}
