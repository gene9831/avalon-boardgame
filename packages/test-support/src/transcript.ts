import type { PlayerID, QuestCard, TeamVote } from '@avalon/game'

export type AvalonCommand =
  | { actor: PlayerID; command: 'startGame' }
  | { actor: PlayerID; command: 'confirmIdentityRecognition' }
  | {
      actor: PlayerID
      command: 'proposeTeam'
      payload: { team: PlayerID[] }
    }
  | {
      actor: PlayerID
      command: 'castTeamVote'
      payload: { vote: TeamVote }
    }
  | {
      actor: PlayerID
      command: 'playQuestCard'
      payload: { card: QuestCard }
    }
  | {
      actor: PlayerID
      command: 'assassinate'
      payload: { targetID: PlayerID }
    }

export interface ReplayDriver<Snapshot> {
  dispatch(command: AvalonCommand): Promise<void> | void
  snapshot(): Promise<Snapshot> | Snapshot
}

export interface ReplayCommandProgress {
  completedCommands: number
  currentCommand: AvalonCommand['command']
  totalCommands: number
}

export interface ReplayTranscriptOptions {
  onCommandStart?: (progress: ReplayCommandProgress) => void
}

export async function replayTranscript<Snapshot>(
  driver: ReplayDriver<Snapshot>,
  transcript: readonly AvalonCommand[],
  options: ReplayTranscriptOptions = {},
) {
  for (const [index, command] of transcript.entries()) {
    options.onCommandStart?.({
      completedCommands: index,
      currentCommand: command.command,
      totalCommands: transcript.length,
    })
    await driver.dispatch(command)
  }
  return driver.snapshot()
}
