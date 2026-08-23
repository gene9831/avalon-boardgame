import { useCallback, useEffect, useState } from 'react'

import { DevToolsHttpError, type DevToolsStatus } from './dev-tools'

interface DevToolsStatusClient {
  getStatus(): Promise<DevToolsStatus>
}

function developmentError(error: unknown) {
  if (error instanceof DevToolsHttpError) {
    if (error.status === 401) return '开发令牌无效。'
    if (error.status === 403) return '开发令牌没有执行此操作的权限。'
    if (error.status === 409) return '房间当前状态不允许执行此操作。'
  }
  return error instanceof Error ? error.message : '开发操作失败，请稍后重试。'
}

export function useDevTools(client: DevToolsStatusClient) {
  const [enabled, setEnabled] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void client
      .getStatus()
      .then((status) => {
        if (active) setEnabled(status.enabled)
      })
      .catch(() => {
        if (active) setEnabled(false)
      })

    return () => {
      active = false
    }
  }, [client])

  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
      return true
    } catch (actionError) {
      setError(developmentError(actionError))
      return false
    }
  }, [])

  return {
    enabled,
    error,
    run,
    setToken,
    token,
  }
}
