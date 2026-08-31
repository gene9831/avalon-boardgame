import { loyaltyForRole } from './roles'
import { getIdentityRecognitionParticipantIDs } from './identity-recognition'
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
  serverInstanceID?: string,
  serverNow = Date.now(),
  identityRecognitionDeadlineEnabled = false,
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
  const recognitionStep = G.identityRecognition?.step
  const evilKnowledgeReleased =
    recognitionStep === undefined || recognitionStep !== 'roleReveal'
  const merlinKnowledgeReleased =
    recognitionStep === undefined || recognitionStep === 'merlinRecognition'
  const knownEvilPlayerIDs =
    role === 'merlin' && merlinKnowledgeReleased
      ? evilPlayerIDs
      : loyalty === 'evil' && evilKnowledgeReleased
        ? evilPlayerIDs.filter((knownID) => knownID !== playerID)
        : []
  const percivalKnowledgeReleased =
    recognitionStep === undefined || recognitionStep === 'percivalRecognition'
  const knownMerlinCandidatePlayerIDs =
    role === 'percival' && percivalKnowledgeReleased
      ? Object.entries(secret.roleByPlayer)
        .filter(([, candidateRole]) =>
          candidateRole === 'merlin' || candidateRole === 'morgana',
        )
        .map(([candidatePlayerID]) => candidatePlayerID)
      : []
  const recognitionParticipantIDs = recognitionStep === undefined
    ? []
    : getIdentityRecognitionParticipantIDs(
      recognitionStep,
      secret.roleByPlayer,
    )

  const view: AvalonPlayerView = {
    ...publicGame,
    submittedTeamVotePlayerIDs: Object.keys(secret.pendingVotes).sort(
      (left, right) => Number(left) - Number(right),
    ),
    viewer: {
      role: role ?? null,
      loyalty,
      knownEvilPlayerIDs,
      knownMerlinCandidatePlayerIDs,
      identityRecognition: recognitionStep === undefined
        ? undefined
        : {
            isParticipant:
              playerID !== null && recognitionParticipantIDs.includes(playerID),
            confirmed:
              playerID !== null &&
              secret.identityRecognitionConfirmedPlayerIDs.includes(playerID),
            deadlineRefreshRequired:
              identityRecognitionDeadlineEnabled &&
              serverInstanceID !== undefined &&
              secret.identityRecognitionServerInstanceID !== serverInstanceID,
            serverNow,
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
