import { useMemo } from 'react'

import { webConfig } from './config'
import { createDevToolsClient } from './dev-tools'
import { FloatingDevTools } from './FloatingDevTools'
import type { LobbyPlayer } from './lobby'
import { useDevTools } from './use-dev-tools'

interface RoomDevToolsProps {
  matchID: string
  onClearLocalSession: () => void
  onDeleteRoom: (token: string) => Promise<void>
  onKickPlayer: (playerID: string, token: string) => Promise<void>
  phase: string | undefined
  players: readonly LobbyPlayer[]
}

export function RoomDevTools({
  matchID,
  onClearLocalSession,
  onDeleteRoom,
  onKickPlayer,
  phase,
  players,
}: RoomDevToolsProps) {
  const client = useMemo(() => createDevToolsClient(webConfig.lobbyURL), [])
  const { enabled, error, run, setToken, token } = useDevTools(client)

  return (
    <FloatingDevTools
      enabled={enabled}
      error={error}
      onTokenChange={setToken}
      token={token}
    >
      <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-violet-300">本地恢复</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          仅删除这台设备保存的座位凭据，不会释放服务器座位。
        </p>
        <button
          className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 font-semibold text-slate-200 transition hover:border-violet-300/60"
          onClick={onClearLocalSession}
          type="button"
        >
          清除本地凭据（测试）
        </button>
      </div>

      <button
        className="w-full rounded-xl border border-rose-300/30 px-4 py-3 font-semibold text-rose-200 transition hover:border-rose-300/70"
        onClick={() => {
          if (window.confirm(`确定删除房间 ${matchID} 吗？`)) {
            void run(() => onDeleteRoom(token))
          }
        }}
        type="button"
      >
        删除当前房间
      </button>

      {phase === 'lobby' && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-violet-300">大厅座位</p>
          {players
            .filter((player) => player.name !== undefined && player.name !== null)
            .map((player) => (
              <button
                className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-left text-slate-200 transition hover:border-violet-300/60"
                key={player.id}
                onClick={() => {
                  if (window.confirm(`确定踢出座位 ${player.id + 1} 的玩家吗？`)) {
                    void run(() => onKickPlayer(String(player.id), token))
                  }
                }}
                type="button"
              >
                <span>座位 {player.id + 1} · {player.name}</span>
                <span className="text-rose-200">踢出</span>
              </button>
            ))}
        </div>
      )}
    </FloatingDevTools>
  )
}
