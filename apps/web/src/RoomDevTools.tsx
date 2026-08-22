import { useEffect, useMemo, useState } from 'react'

import { webConfig } from './config'
import { createDevToolsClient, DevToolsHttpError } from './dev-tools'
import type { LobbyPlayer } from './lobby'

interface RoomDevToolsProps {
  matchID: string
  onClearLocalSession: () => void
  onDeleteRoom: (token: string) => Promise<void>
  onKickPlayer: (playerID: string, token: string) => Promise<void>
  phase: string | undefined
  players: readonly LobbyPlayer[]
}

function developmentError(error: unknown) {
  if (error instanceof DevToolsHttpError) {
    if (error.status === 401) return '开发令牌无效。'
    if (error.status === 403) return '开发令牌没有执行此操作的权限。'
    if (error.status === 409) return '房间当前状态不允许执行此操作。'
  }
  return error instanceof Error ? error.message : '开发操作失败，请稍后重试。'
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
  const [enabled, setEnabled] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void client
      .getStatus()
      .then((status) => setEnabled(status.enabled))
      .catch(() => setEnabled(false))
  }, [client])

  if (!enabled) return null

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
    } catch (actionError) {
      setError(developmentError(actionError))
    }
  }

  return (
    <details className="pointer-events-auto ml-auto w-fit max-w-full rounded-3xl border border-violet-300/20 bg-violet-300/[0.06] p-6 text-sm open:w-full">
      <summary className="cursor-pointer font-semibold text-violet-200">开发控制</summary>
      <div className="mt-5 space-y-4">
        <label className="block text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-violet-300">
            开发令牌
          </span>
          <input
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-white outline-none focus:border-violet-300/60"
            onChange={(event) => setToken(event.target.value)}
            type="password"
            value={token}
          />
        </label>

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

        {error !== null && <p className="text-rose-200">{error}</p>}
      </div>
    </details>
  )
}
