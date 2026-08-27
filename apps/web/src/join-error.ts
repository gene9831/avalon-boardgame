export interface ClassifiedJoinError {
  message: string
  refreshRooms: boolean
}

function errorDetails(error: unknown) {
  if (typeof error !== 'object' || error === null || !('details' in error)) return null
  const details = (error as { details?: unknown }).details
  return typeof details === 'string' ? details : null
}

function errorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('details' in error)) return null
  const details = (error as { details?: unknown }).details
  if (typeof details !== 'object' || details === null || !('error' in details)) return null
  const bodyError = (details as { error?: unknown }).error
  if (typeof bodyError !== 'object' || bodyError === null || !('code' in bodyError)) return null
  const code = (bodyError as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export function classifyJoinError(error: unknown): ClassifiedJoinError {
  const details = errorDetails(error)
  const code = errorCode(error)

  if (code === 'seat_unavailable') {
    return {
      message: '所选座位已被占用，请刷新房间列表后重新选择。',
      refreshRooms: true,
    }
  }

  if (code === 'client_already_joined') {
    return {
      message: '当前浏览器已经在本局入座，请刷新房间列表。',
      refreshRooms: true,
    }
  }

  if (code === 'invalid_request') {
    return {
      message: '提交的数据格式无效，请检查后重试。',
      refreshRooms: false,
    }
  }

  if (details === 'Player name is already used in this match') {
    return {
      message: '这个名字已被本房间的其他玩家使用。',
      refreshRooms: false,
    }
  }

  if (details === 'Player name must contain 1 to 24 characters') {
    return {
      message: '玩家名称需要包含 1–24 个字符。',
      refreshRooms: false,
    }
  }

  if (error instanceof Error && error.message === 'HTTP status 404') {
    return {
      message: '房间不存在或已被解散，请重新选择。',
      refreshRooms: true,
    }
  }

  if (error instanceof Error && error.message === 'HTTP status 409') {
    if (details?.startsWith('Player ') && details.endsWith(' not available')) {
      return {
        message: '所选座位已被占用，请刷新房间列表后重新选择。',
        refreshRooms: true,
      }
    }

    if (details === 'Client has already joined this match') {
      return {
        message: '当前浏览器已经在本局入座，请刷新房间列表。',
        refreshRooms: true,
      }
    }

    return {
      message: '房间状态已经变化，请刷新房间列表后重新选择。',
      refreshRooms: true,
    }
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      message: '网络请求失败，请检查连接后重试。',
      refreshRooms: false,
    }
  }

  return {
    message: error instanceof Error ? error.message : '请求失败，请稍后重试。',
    refreshRooms: false,
  }
}
