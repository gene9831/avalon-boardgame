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

export function nextPersonalRecognitionStage(
  currentStage: PersonalRecognitionStage,
  role: Role,
  roleConfiguration: AvalonRoleConfiguration,
): PersonalRecognitionStage | null {
  if (currentStage === 'complete') return null
  if (currentStage === 'clueRecognition') return 'complete'
  return roleRequiresClueRecognition(role, roleConfiguration)
    ? 'clueRecognition'
    : 'complete'
}
