export interface DialogJoinError {
  placement: 'dialog'
  message: string
}

export interface PageJoinError {
  placement: 'page'
  message: string
  refreshRooms: true
}

export type ClassifiedJoinError = DialogJoinError | PageJoinError

function errorDetails(error: unknown) {
  if (typeof error !== 'object' || error === null || !('details' in error)) return null
  const details = (error as { details?: unknown }).details
  return typeof details === 'string' ? details : null
}

export function classifyJoinError(error: unknown): ClassifiedJoinError {
  const details = errorDetails(error)

  if (details === 'Player name is already used in this match') {
    return {
      placement: 'dialog',
      message: '这个名字已被本房间的其他玩家使用。',
    }
  }

  if (details === 'Player name must contain 1 to 24 characters') {
    return {
      placement: 'dialog',
      message: '玩家名称需要包含 1–24 个字符。',
    }
  }

  if (error instanceof Error && error.message === 'HTTP status 404') {
    return {
      placement: 'page',
      message: '房间不存在或已被解散，请重新选择。',
      refreshRooms: true,
    }
  }

  if (error instanceof Error && error.message === 'HTTP status 409') {
    if (details?.startsWith('Player ') && details.endsWith(' not available')) {
      return {
        placement: 'page',
        message: '所选座位已被占用，请刷新房间列表后重新选择。',
        refreshRooms: true,
      }
    }

    if (details === 'Client has already joined this match') {
      return {
        placement: 'page',
        message: '当前浏览器已经在本局入座，请刷新房间列表。',
        refreshRooms: true,
      }
    }

    return {
      placement: 'page',
      message: '房间状态已经变化，请刷新房间列表后重新选择。',
      refreshRooms: true,
    }
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      placement: 'dialog',
      message: '网络请求失败，请检查连接后重试。',
    }
  }

  return {
    placement: 'dialog',
    message: error instanceof Error ? error.message : '请求失败，请稍后重试。',
  }
}
