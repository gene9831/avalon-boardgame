import { loyaltyForRole } from './roles'
import type {
  AvalonG,
  AvalonPlayerView,
  PlayerID,
  Role,
} from './types'

function findEvilPlayerIDs(roleByPlayer: Record<PlayerID, Role>) {
  return Object.entries(roleByPlayer)
    .filter(([, role]) => loyaltyForRole(role) === 'evil')
    .map(([playerID]) => playerID)
}

export function getAvalonPlayerView(
  G: AvalonG,
  playerID: PlayerID | null,
): AvalonPlayerView {
  const { secret, ...publicGame } = G
  const role = playerID === null ? undefined : secret.roleByPlayer[playerID]
  const loyalty = role === undefined ? null : loyaltyForRole(role)
  const evilPlayerIDs = findEvilPlayerIDs(secret.roleByPlayer)
  const knownEvilPlayerIDs =
    role === 'merlin'
      ? evilPlayerIDs
      : loyalty === 'evil'
        ? evilPlayerIDs.filter((knownID) => knownID !== playerID)
        : []

  const view: AvalonPlayerView = {
    ...publicGame,
    viewer: {
      role: role ?? null,
      loyalty,
      knownEvilPlayerIDs,
      submittedVote:
        playerID === null ? undefined : secret.pendingVotes[playerID],
      submittedQuestCard:
        playerID === null ? undefined : secret.pendingQuestCards[playerID],
    },
  }

  if (G.status === 'finished') {
    view.revealedRoles = { ...secret.roleByPlayer }
  }

  return view
}
