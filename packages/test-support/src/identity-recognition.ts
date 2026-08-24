import {
  getIdentityRecognitionParticipantIDs,
  type AvalonG,
} from '@avalon/game'

import type { AvalonCommand } from './transcript'

export function getIdentityRecognitionCommands(
  G: AvalonG,
): AvalonCommand[] {
  const step = G.identityRecognition?.step
  if (step === undefined) return []

  return getIdentityRecognitionParticipantIDs(
    step,
    G.secret.roleByPlayer,
  ).map((actor) => ({ actor, command: 'confirmIdentityRecognition' }))
}
