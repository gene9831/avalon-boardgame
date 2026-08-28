export type RequestErrorContext = 'connection' | 'room' | 'room-directory'

const REQUEST_ERROR_MESSAGES: Record<RequestErrorContext, string> = {
  connection: '暂时无法连接房间，请稍后重试。',
  room: '暂时无法进入房间，请稍后重试。',
  'room-directory': '暂时无法加载房间列表，请稍后重试。',
}

export function getRequestErrorMessage(context: RequestErrorContext) {
  return REQUEST_ERROR_MESSAGES[context]
}

export function getRoomAccessValidationError(validationFailed: boolean) {
  return validationFailed
    ? '暂时无法确认部分房间状态，请刷新房间列表后重试。'
    : null
}
