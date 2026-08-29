import { getPlayerCountConfig, type PlayerID, type Role } from '@avalon/game'

export const ROLE_LABELS: Record<Role, string> = {
  assassin: '刺客',
  loyal_servant: '亚瑟的忠臣',
  merlin: '梅林',
  minion: '莫德雷德的爪牙',
}

export const LOYALTY_LABELS = {
  evil: '邪恶阵营',
  good: '正义阵营',
} as const

export const PHASE_LABELS = {
  assassination: '刺杀梅林',
  identityRecognition: '身份辨认',
  quest: '执行任务',
  teamProposal: '组建任务队伍',
  teamVote: '队伍表决',
} as const

export function getPhaseLabel(phase: string) {
  return PHASE_LABELS[phase as keyof typeof PHASE_LABELS] ?? phase
}

export function getQuestTeamSize(numPlayers: number, questIndex: number) {
  return getPlayerCountConfig(numPlayers).questTeamSizes[questIndex] ?? 0
}

export function toggleTeamMember(
  selectedTeam: readonly PlayerID[],
  playerID: PlayerID,
  maxSize: number,
) {
  if (selectedTeam.includes(playerID)) {
    return selectedTeam.filter((selectedID) => selectedID !== playerID)
  }

  if (selectedTeam.length >= maxSize) return [...selectedTeam]
  return [...selectedTeam, playerID]
}

export interface TeamSubmissionOptions {
  activeStage: string | undefined
  leaderID: PlayerID | null
  playerID: PlayerID
  requiredTeamSize: number
  selectedTeam: readonly PlayerID[]
}

export function canSubmitTeam({
  activeStage,
  leaderID,
  playerID,
  requiredTeamSize,
  selectedTeam,
}: TeamSubmissionOptions) {
  return (
    activeStage === 'leader' &&
    leaderID === playerID &&
    selectedTeam.length === requiredTeamSize
  )
}
