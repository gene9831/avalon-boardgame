export function LobbyDevTools({
  enabled,
  onTokenChange,
  token,
}: {
  enabled: boolean
  onTokenChange: (value: string) => void
  token: string
}) {
  if (!enabled) return null

  return (
    <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">开发工具</summary>
      <label className="mt-4 block text-sm text-slate-300" htmlFor="dev-token">
        开发管理员 Token
      </label>
      <input
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm text-white"
        id="dev-token"
        onChange={(event) => onTokenChange(event.target.value)}
        placeholder="仅保存在当前页面内"
        type="password"
        value={token}
      />
      <p className="mt-2 text-xs text-slate-500">开发工具状态：已启用</p>
    </details>
  )
}
