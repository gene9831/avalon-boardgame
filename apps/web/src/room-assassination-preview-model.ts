import type { PlayerID, Role } from '@avalon/game'

import { ROLE_LABELS } from './room-game'
import type { RoomScreenModel } from './room-screen-model'

export type AssassinationOutcome = Readonly<{
  targetID: PlayerID
  targetRole: Role
  hit: boolean
  winner: 'good' | 'evil'
}>

export function withAssassinationOutcome(
  model: RoomScreenModel,
  outcome: AssassinationOutcome,
  targetName: string,
): RoomScreenModel {
  return {
    ...model,
    players: model.players.map((player) => player.playerID === outcome.targetID
      ? {
          ...player,
          emphasis: 'target',
          portrait: { kind: 'roleArtwork', role: outcome.targetRole },
          caption: { kind: 'none' },
        }
      : player),
    center: {
      kind: 'assassinationSummary', title: '刺杀梅林',
      status: outcome.hit ? '刺杀命中' : '刺杀未命中',
      detail: outcome.winner === 'evil' ? '邪恶阵营获胜' : '正义阵营获胜',
      statusTone: outcome.winner === 'evil' ? 'failure' : 'success',
    },
    phase: {
      kind: 'assassinationResult', title: '刺杀结果', hit: outcome.hit,
      targetName, targetRoleLabel: ROLE_LABELS[outcome.targetRole], winner: outcome.winner,
    },
  }
}
