import type { AvalonG } from '@avalon/game'

import type { AvalonCommand } from './transcript'

export function getIdentityRecognitionCommands(
  G: AvalonG,
): AvalonCommand[] {
  if (G.identityRecognition === null) return []

  return Object.entries(G.secret.identityRecognitionStageByPlayerID)
    .filter(([, stage]) => stage !== 'complete')
    .map(([actor]) => ({ actor, command: 'confirmIdentityRecognition' }))
}
