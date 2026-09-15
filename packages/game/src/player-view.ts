import { loyaltyForRole } from './roles'
import type {
  AvalonG,
  AvalonPlayerView,
  PlayerID,
  Role,
} from './types'
import { normalizeRoleConfiguration } from './types'

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
  publicGame.rules = {
    ...publicGame.rules,
    roleConfiguration: normalizeRoleConfiguration(
      publicGame.rules.roleConfiguration,
    ),
  }
  const role = playerID === null ? undefined : secret.roleByPlayer[playerID]
  const loyalty = role === undefined ? null : loyaltyForRole(role)
  const evilPlayerIDs = findEvilPlayerIDs(secret.roleByPlayer)
  const personalRecognitionStage = playerID === null
    ? undefined
    : secret.identityRecognitionStageByPlayerID[playerID]
  const knowledgeReleased = G.identityRecognition === null || (
    G.identityRecognition.stage === 'clueRecognition' &&
    (
      personalRecognitionStage === 'clueRecognition' ||
      personalRecognitionStage === 'complete'
    )
  )
  const knownEvilPlayerIDs =
    role === 'merlin' && knowledgeReleased
      ? evilPlayerIDs
      : loyalty === 'evil' && knowledgeReleased
        ? evilPlayerIDs.filter((knownID) => knownID !== playerID)
        : []
  const knownMerlinCandidatePlayerIDs =
    role === 'percival' && knowledgeReleased
      ? Object.entries(secret.roleByPlayer)
        .filter(([, candidateRole]) =>
          candidateRole === 'merlin' || candidateRole === 'morgana',
        )
        .map(([candidatePlayerID]) => candidatePlayerID)
      : []

  const view: AvalonPlayerView = {
    ...publicGame,
    submittedTeamVotePlayerIDs: Object.keys(secret.pendingVotes).sort(
      (left, right) => Number(left) - Number(right),
    ),
    submittedQuestCardCount: Object.keys(secret.pendingQuestCards).length,
    viewer: {
      role: role ?? null,
      loyalty,
      knownEvilPlayerIDs,
      knownMerlinCandidatePlayerIDs,
      identityRecognition:
        G.identityRecognition === null || personalRecognitionStage === undefined
        ? undefined
        : {
            personalStage: personalRecognitionStage,
          },
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
