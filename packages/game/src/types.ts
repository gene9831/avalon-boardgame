export type PlayerID = string

export type Role =
  | 'merlin'
  | 'assassin'
  | 'loyal_servant'
  | 'minion'

export type Loyalty = 'good' | 'evil'

export type QuestCard = 'success' | 'fail'

export type IdentityRecognitionStep =
  | 'roleReveal'
  | 'evilRecognition'
  | 'merlinRecognition'

export interface IdentityRecognitionState {
  step: IdentityRecognitionStep
  deadlineAt: number
  confirmedCount: number
  participantCount: number
}

export interface PlayerCountConfig {
  good: number
  evil: number
  questTeamSizes: readonly number[]
  questFailThresholds: readonly number[]
}

export interface PlayerInfo {
  name: string
}

export interface TimeoutConfig {
  enabled: boolean
  proposalMs?: number
  voteMs?: number
  questMs?: number
  assassinationMs?: number
}

export type TeamVote = 'approve' | 'reject'

export interface TeamVoteResult {
  proposerID?: PlayerID
  questIndex: number
  team: PlayerID[]
  votes: Record<PlayerID, TeamVote>
  approved: boolean
}

export interface QuestResult {
  questIndex: number
  team: PlayerID[]
  successCount: number
  failCount: number
  succeeded: boolean
}

export type VictoryWinner = 'good' | 'evil'

export type VictoryReason =
  | 'three_quests'
  | 'five_rejections'
  | 'assassination'

export interface AvalonResult {
  winner: VictoryWinner
  reason: VictoryReason
  targetID?: PlayerID
}

export interface AvalonSecret {
  roleByPlayer: Record<PlayerID, Role>
  identityRecognitionConfirmedPlayerIDs: PlayerID[]
  identityRecognitionServerInstanceID: string | null
  pendingVotes: Partial<Record<PlayerID, TeamVote>>
  pendingQuestCards: Partial<Record<PlayerID, QuestCard>>
}

export interface AvalonG {
  status: 'lobby' | 'playing' | 'finished'
  players: Record<PlayerID, PlayerInfo>
  secret: AvalonSecret
  identityRecognition: IdentityRecognitionState | null
  leaderID: PlayerID | null
  questIndex: number
  proposedTeam: PlayerID[] | null
  voteHistory: TeamVoteResult[]
  questHistory: QuestResult[]
  consecutiveRejectedTeams: number
  goodSuccesses: number
  evilFailures: number
  rules: {
    timeouts: TimeoutConfig
  }
  result?: AvalonResult
}

export interface AvalonSetupData {
  players?: Record<PlayerID, PlayerInfo>
  timeouts?: TimeoutConfig
}

export interface AvalonViewer {
  role: Role | null
  loyalty: Loyalty | null
  knownEvilPlayerIDs: PlayerID[]
  knownEvilRoles?: never
  identityRecognition?: {
    isParticipant: boolean
    confirmed: boolean
    deadlineRefreshRequired: boolean
    serverNow: number
  }
  submittedVote?: TeamVote
  submittedQuestCard?: QuestCard
}

export type AvalonPlayerView = Omit<AvalonG, 'secret'> & {
  submittedTeamVotePlayerIDs: PlayerID[]
  viewer: AvalonViewer
  revealedRoles?: Record<PlayerID, Role>
}
