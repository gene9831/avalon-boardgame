import { createAvalonRuleDriver } from './rule-driver'
import {
  AVALON_ACTION_RNG_ALGORITHM_VERSION,
  AVALON_RNG_ALGORITHM_VERSION,
} from './seed'
import { replayTranscript, type AvalonCommand } from './transcript'

export interface AvalonReplayArtifact {
  schemaVersion: 1
  rngAlgorithmVersion: typeof AVALON_RNG_ALGORITHM_VERSION
  actionRngAlgorithmVersion: typeof AVALON_ACTION_RNG_ALGORITHM_VERSION
  codeVersion: string
  masterSeed: string
  playerCount: number
  transcript: AvalonCommand[]
}

export function createAvalonReplayArtifact(options: {
  codeVersion: string
  masterSeed: string
  playerCount: number
  transcript: readonly AvalonCommand[]
}): AvalonReplayArtifact {
  return {
    schemaVersion: 1,
    rngAlgorithmVersion: AVALON_RNG_ALGORITHM_VERSION,
    actionRngAlgorithmVersion: AVALON_ACTION_RNG_ALGORITHM_VERSION,
    codeVersion: options.codeVersion,
    masterSeed: options.masterSeed,
    playerCount: options.playerCount,
    transcript: structuredClone([...options.transcript]),
  }
}

export async function replayAvalonArtifact(artifact: AvalonReplayArtifact) {
  if (artifact.schemaVersion !== 1) {
    throw new Error(`Unsupported replay schema: ${artifact.schemaVersion}`)
  }
  if (artifact.rngAlgorithmVersion !== AVALON_RNG_ALGORITHM_VERSION) {
    throw new Error(
      `Unsupported game RNG: ${artifact.rngAlgorithmVersion}`,
    )
  }
  if (
    artifact.actionRngAlgorithmVersion !==
    AVALON_ACTION_RNG_ALGORITHM_VERSION
  ) {
    throw new Error(
      `Unsupported action RNG: ${artifact.actionRngAlgorithmVersion}`,
    )
  }

  return replayTranscript(
    createAvalonRuleDriver({
      masterSeed: artifact.masterSeed,
      playerCount: artifact.playerCount,
    }),
    artifact.transcript,
  )
}
