import { LobbyClient } from 'boardgame.io/client'

type JoinArguments = Parameters<LobbyClient['joinMatch']>
type CreateArguments = Parameters<LobbyClient['createMatch']>

type RoomSession = {
  matchID: string
  playerID: string
  playerCredentials: string
}

export class AvalonTestLobbyClient extends LobbyClient {
  private joinSequence = 0
  private createSequence = 0
  private readonly ownerSessions = new Map<string, RoomSession>()

  override async createMatch(
    gameName: CreateArguments[0],
    body: CreateArguments[1],
    init?: CreateArguments[2],
  ) {
    this.createSequence += 1
    const created = await super.createMatch(gameName, {
      ...body,
      playerName: 'Alice',
      data: {
        avatarID: 'loyal-servant',
        clientID: `test-owner-client-${this.createSequence}`,
        sessionID: `test-owner-session-${this.createSequence}`,
      },
      roleConfiguration: { percivalMorgana: true },
    } as CreateArguments[1], init) as unknown as RoomSession
    this.ownerSessions.set(created.matchID, created)
    return created
  }

  override joinMatch(
    gameName: JoinArguments[0],
    matchID: JoinArguments[1],
    body: JoinArguments[2],
    init?: JoinArguments[3],
  ) {
    this.joinSequence += 1
    const submittedData = typeof body.data === 'object' && body.data !== null
      ? body.data as Record<string, unknown>
      : {}
    const playerID = body.playerID ?? 'unknown'
    const owner = this.ownerSessions.get(matchID)
    if (
      playerID === '0' &&
      owner !== undefined &&
      typeof body.playerName === 'string' &&
      body.playerName.trim().length > 0 &&
      body.playerName.trim().length <= 24
    ) {
      return Promise.resolve(owner)
    }
    const serverAssignedBody = { ...body }
    delete serverAssignedBody.playerID
    return super.joinMatch(gameName, matchID, {
      ...serverAssignedBody,
      data: {
        avatarID: 'loyal-servant',
        clientID: `test-client-${playerID}-${this.joinSequence}`,
        sessionID: `test-session-${playerID}-${this.joinSequence}`,
        ...submittedData,
      },
    }, init)
  }
}
