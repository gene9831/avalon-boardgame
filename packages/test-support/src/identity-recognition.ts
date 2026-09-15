import type { AvalonG } from '@avalon/game'

import type { AvalonCommand } from './transcript'

export function getIdentityRecognitionCommands(
  G: AvalonG,
): AvalonCommand[] {
  if (G.identityRecognition === null) return []
  const activeStage = G.identityRecognition.stage

  return Object.entries(G.secret.identityRecognitionStageByPlayerID)
    .filter(([, stage]) => stage === activeStage)
    .map(([actor]) => ({ actor, command: 'confirmIdentityRecognition' }))
}
