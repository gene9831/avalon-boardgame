import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'

/** Development-only deterministic route for the formal loading scene. */
export function RoomLoadingPreview() {
  return (
    <RoomScreenPreviewShell
      actions={null}
      controls={<><h1>加载场景预览</h1><p>此预览不连接服务端，也不持有业务状态。</p></>}
      scene={{
        kind: 'loading',
        matchID: 'loading-preview',
        playerCount: null,
        players: [],
        questProgress: [],
        message: '正在进入房间，请稍候。',
      }}
    />
  )
}
