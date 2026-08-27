import { LobbyClient } from 'boardgame.io/client'

type JoinArguments = Parameters<LobbyClient['joinMatch']>

export class AvalonTestLobbyClient extends LobbyClient {
  private joinSequence = 0

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
    return super.joinMatch(gameName, matchID, {
      ...body,
      data: {
        avatarID: 'loyal-servant',
        clientID: `test-client-${playerID}-${this.joinSequence}`,
        sessionID: `test-session-${playerID}-${this.joinSequence}`,
        ...submittedData,
      },
    }, init)
  }
}
