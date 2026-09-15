import { loyaltyForRole } from './roles'
import type {
  AvalonRoleConfiguration,
  PersonalRecognitionStage,
  PlayerID,
  Role,
} from './types'

export function roleRequiresClueRecognition(
  role: Role,
  roleConfiguration: AvalonRoleConfiguration,
): boolean {
  return loyaltyForRole(role) === 'evil' ||
    role === 'merlin' ||
    (role === 'percival' && roleConfiguration.percivalMorgana)
}

export function createPersonalRecognitionStages(
  playerIDs: readonly PlayerID[],
): Record<PlayerID, PersonalRecognitionStage> {
  return Object.fromEntries(
    playerIDs.map((playerID) => [playerID, 'identityConfirmation']),
  )
}

export function createClueRecognitionStages(
  roleByPlayer: Record<PlayerID, Role>,
  roleConfiguration: AvalonRoleConfiguration,
): Record<PlayerID, PersonalRecognitionStage> {
  return Object.fromEntries(
    Object.entries(roleByPlayer).map(([playerID, role]) => [
      playerID,
      roleRequiresClueRecognition(role, roleConfiguration)
        ? 'clueRecognition'
        : 'complete',
    ]),
  )
}

export function nextPersonalRecognitionStage(
  currentStage: PersonalRecognitionStage,
): PersonalRecognitionStage | null {
  if (currentStage === 'identityConfirmation') {
    return 'waitingForClueRecognition'
  }
  if (currentStage === 'clueRecognition') return 'complete'
  return null
}
