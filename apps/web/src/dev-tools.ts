export interface DevToolsStatus {
  enabled: boolean
}

export class DevToolsHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP status ${status}`)
    this.name = 'DevToolsHttpError'
    this.status = status
  }
}

type Fetcher = typeof fetch

async function requireResponse(response: Response, acceptedStatuses: readonly number[] = []) {
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw new DevToolsHttpError(response.status)
  }
  return response
}

export function createDevToolsClient(baseURL: string, fetcher: Fetcher = fetch) {
  const request = (path: string, init?: RequestInit) =>
    fetcher(`${baseURL}${path}`, init).then((response) => requireResponse(response))

  return {
    async getStatus() {
      const response = await request('/dev/status')
      return (await response.json()) as DevToolsStatus
    },

    async deleteRoom(matchID: string, token: string) {
      const response = await fetcher(`${baseURL}/dev/rooms/${encodeURIComponent(matchID)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await requireResponse(response)
    },

    async kickPlayer(matchID: string, playerID: string, token: string) {
      const response = await fetcher(
        `${baseURL}/dev/rooms/${encodeURIComponent(matchID)}/players/${encodeURIComponent(playerID)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      return (await requireResponse(response)).json()
    },
  }
}
