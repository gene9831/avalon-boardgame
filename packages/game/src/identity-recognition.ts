import { loyaltyForRole } from './roles'
import type { IdentityRecognitionStep, PlayerID, Role } from './types'

export function getIdentityRecognitionParticipantIDs(
  step: IdentityRecognitionStep,
  roleByPlayer: Record<PlayerID, Role>,
) {
  const roleEntries = Object.entries(roleByPlayer)

  switch (step) {
    case 'roleReveal':
      return roleEntries.map(([playerID]) => playerID)
    case 'evilRecognition':
      return roleEntries
        .filter(([, role]) => loyaltyForRole(role) === 'evil')
        .map(([playerID]) => playerID)
    case 'merlinRecognition':
      return roleEntries
        .filter(([, role]) => role === 'merlin')
        .map(([playerID]) => playerID)
    case 'percivalRecognition':
      return roleEntries
        .filter(([, role]) => role === 'percival')
        .map(([playerID]) => playerID)
  }
}
